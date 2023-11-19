import { createSignal } from "solid-js";
import { audioContext } from "./audioContext";
import { useAnimationFrame } from "./behaviors/useAnimationFrame";
import audiobufferToWav from "audiobuffer-to-wav";

export const player = createPlayer(audioContext);

type NodeAssembly = { sourceNode: AudioBufferSourceNode; gainNode: GainNode };

function createPlayer(audioContext: AudioContext | OfflineAudioContext) {
  const [startedAt, setStartedAt] = createSignal<number | undefined>(undefined);
  const [startOffset, setStartOffset] = createSignal<number>(0);
  const [region, setRegion] = createSignal<{ start: number; end: number }>({
    start: 0,
    end: 1,
  });
  let active:
    | NodeAssembly
    | undefined;

  const play = (buffer: AudioBuffer, region = { start: 0, end: 1 }) => {
    setRegion(region);
    const startSeconds = buffer.duration * region.start;

    stop();
    setStartOffset(startSeconds);
    setStartedAt(audioContext.currentTime);

    active = attackRelease(audioContext, buffer, region, stop);
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
    if (!startedAt_ || !active?.sourceNode.buffer) {
      return 0;
    }
    const timeSinceStart = audioContext.currentTime - startedAt_;
    const elapsed = timeSinceStart + startOffset();
    setProgress(elapsed / active.sourceNode.buffer.duration);
  });

  return { play, playing, region, stop, progress };
}

const smoothStop = (blah: NodeAssembly, ramp = 0.001) => {
  const end = audioContext.currentTime + ramp;
  blah.gainNode.gain.cancelScheduledValues(audioContext.currentTime);
  blah.gainNode.gain.setValueAtTime(1, audioContext.currentTime);
  blah.gainNode.gain.linearRampToValueAtTime(0, end);

  blah.sourceNode.onended = null;
  blah.sourceNode.stop(end);
};

// @ts-ignore
window.createPlayer = createPlayer;

const attackRelease = (
  audioContext: AudioContext | OfflineAudioContext,
  buffer: AudioBuffer,
  region: { start: number; end: number },
  onended?: () => void,
): NodeAssembly => {
  const ramp = 0.001;
  const gainNode = audioContext.createGain();
  gainNode.connect(audioContext.destination);
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + ramp);

  const startSeconds = buffer.duration * region.start;
  const endSeconds = buffer.duration * region.end;
  const durationSeconds = endSeconds - startSeconds;

  const end = audioContext.currentTime + durationSeconds;
  gainNode.gain.setValueAtTime(1, end - ramp);
  gainNode.gain.linearRampToValueAtTime(0, end);

  const sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.connect(gainNode);
  if (onended) sourceNode.onended = onended;
  sourceNode.start(0, startSeconds, durationSeconds);

  return { sourceNode, gainNode };
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
  attackRelease(offlineAudioContext, buffer, region);
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
