import { createSignal } from "solid-js";
import { audioContext } from "./audioContext";
import { useAnimationFrame } from "./behaviors/useAnimationFrame";
import audiobufferToWav from "audiobuffer-to-wav";

export const player = createPlayer(audioContext);

type NodeAssembly = { sourceNode: AudioBufferSourceNode; gainNode: GainNode };

function createPlayer(audioContext: AudioContext | OfflineAudioContext) {
  const [startedAt, setStartedAt] = createSignal<number | undefined>(undefined);
  const [region, setRegion] = createSignal<{ start: number; end: number }>({
    start: 0,
    end: 1,
  });
  let active:
    | NodeAssembly
    | undefined;

  const play = (buffer: AudioBuffer, region = { start: 0, end: 1 }) => {
    stop();
    setRegion(region);
    setStartedAt(audioContext.currentTime);
    active = schedulePlayback(audioContext, buffer, region, stop);
  };

  const stop = () => {
    if (!active) {
      return;
    }
    smoothStop(active);
    active = undefined;
    setStartedAt(undefined);
  };

  const playing = () => startedAt() !== undefined;

  const [progress, setProgress] = createSignal(0);
  useAnimationFrame(() => {
    const startedAt_ = startedAt();
    if (!startedAt_ || !active?.sourceNode.buffer) return;
    const timeSinceStart = audioContext.currentTime - startedAt_;
    const startOffset = active.sourceNode.buffer.duration * region().start;
    const elapsed = timeSinceStart + startOffset;
    setProgress(elapsed / active.sourceNode.buffer.duration);
  });

  return { play, playing, region, stop, progress };
}

// @ts-ignore
window.createPlayer = createPlayer;

const smoothStop = (assembly: NodeAssembly, ramp = 0.001) => {
  const end = audioContext.currentTime + ramp;
  assembly.gainNode.gain.cancelScheduledValues(audioContext.currentTime);
  assembly.gainNode.gain.setValueAtTime(1, audioContext.currentTime);
  assembly.gainNode.gain.linearRampToValueAtTime(0, end);

  assembly.sourceNode.onended = null;
  assembly.sourceNode.stop(end);
};

const schedulePlayback = (
  audioContext: AudioContext | OfflineAudioContext,
  buffer: AudioBuffer,
  region: { start: number; end: number },
  onended?: () => void,
): NodeAssembly => {
  const gainNode = audioContext.createGain();
  gainNode.connect(audioContext.destination);

  const envelope = {
    startSeconds: buffer.duration * region.start,
    endSeconds: buffer.duration * region.end,
    rampSeconds: 0.001,
  };

  scheduleEnvelope(gainNode, envelope);

  const sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.connect(gainNode);
  if (onended) sourceNode.onended = onended;
  sourceNode.start(
    0,
    envelope.startSeconds,
    envelope.endSeconds - envelope.startSeconds,
  );

  return { sourceNode, gainNode };
};

const scheduleEnvelope = (
  gainNode: GainNode,
  envelope: { startSeconds: number; endSeconds: number; rampSeconds: number },
) => {
  gainNode.gain.setValueAtTime(0, envelope.startSeconds);
  gainNode.gain.linearRampToValueAtTime(
    1,
    envelope.startSeconds + envelope.rampSeconds,
  );
  gainNode.gain.setValueAtTime(1, envelope.endSeconds - envelope.rampSeconds);
  gainNode.gain.linearRampToValueAtTime(0, envelope.endSeconds);
};

export const print = async (
  buffer: AudioBuffer,
  region: { start: number; end: number },
) => {
  // render audiobuffer of region
  const offlineAudioContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.duration * buffer.sampleRate *
      (region.end - region.start),
    buffer.sampleRate,
  );
  schedulePlayback(offlineAudioContext, buffer, region);
  const offlineResult = await offlineAudioContext
    .startRendering();

  // convert audiobuffer to an arraybuffer of wav-encoded bytes
  const wav = audiobufferToWav(offlineResult);

  // use hash digest as file name
  const hashBuffer = await crypto.subtle.digest("SHA-256", wav);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const fileName = hashHex + ".wav";

  return { wav, fileName };
};
