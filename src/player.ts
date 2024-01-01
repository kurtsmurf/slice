import { createEffect, createSignal } from "solid-js";
import { audioContext } from "./audioContext";
import { useAnimationFrame } from "./behaviors/useAnimationFrame";
import audiobufferToWav from "audiobuffer-to-wav";

export const player = createPlayer(audioContext);

type SourceAssembly = {
  sourceNode: AudioBufferSourceNode;
  gainNode: GainNode;
};

// @ts-ignore
window.player = player;

type FxAssembly = {
  in: AudioNode;
  out: AudioNode;
  loPassFreq: AudioParam;
  hiPassFreq: AudioParam;
};

function createFxAssembly(
  audioContext: AudioContext | OfflineAudioContext,
): FxAssembly {
  const loPassFilter = audioContext.createBiquadFilter();
  loPassFilter.type = "lowpass";
  loPassFilter.Q.value = 0;

  const hiPassFilter = audioContext.createBiquadFilter();
  hiPassFilter.type = "highpass";
  hiPassFilter.Q.value = 0;

  loPassFilter.connect(hiPassFilter);

  return {
    in: loPassFilter,
    out: hiPassFilter,
    loPassFreq: loPassFilter.frequency,
    hiPassFreq: hiPassFilter.frequency,
  };
}

function createPlayer(audioContext: AudioContext | OfflineAudioContext) {
  const [startedAt, setStartedAt] = createSignal<number | undefined>(undefined);
  const [region, setRegion] = createSignal<{ start: number; end: number }>({
    start: 0,
    end: 1,
  });
  let active:
    | { nodeAssembly: SourceAssembly; gainEnvelopeScheduler?: NodeJS.Timer }
    | undefined;
  const [loop, setLoop] = createSignal(false);
  const [pitchOffsetSemis, setPitchOffsetSemis] = createSignal(0);
  const [pitchOffsetCents, setPitchOffsetCents] = createSignal(0);
  const [loPass, setLoPass] = createSignal(100);
  const [hiPass, setHiPass] = createSignal(0);
  const speed = () => {
    const totalCents = pitchOffsetCents() + (100 * pitchOffsetSemis());
    return Math.pow(2, totalCents / 1200);
  };

  const fxAssembly = createFxAssembly(audioContext);
  fxAssembly.out.connect(audioContext.destination);

  createEffect(() => {
    fxAssembly.hiPassFreq.value = mapLinearToLogarithmic(hiPass());
  });

  createEffect(() => {
    fxAssembly.loPassFreq.value = mapLinearToLogarithmic(loPass());
  });

  createEffect(() => {
    // when speed updates
    speed();

    const currentBuffer = active?.nodeAssembly.sourceNode.buffer;

    // if playing
    if (currentBuffer) {
      // restart player
      player.stop();
      player.play(currentBuffer, player.region());

      // restart where you left off
      // player.play(currentBuffer, player.region(), offset);

      // Variable "offset" is where to start playback
      // In units progress 0-1
      // If no offset is provided, then region.start is used
      // Example:
      // if buffer.duration is 1s
      // and region is { start: 0.5, end: 0.7}
      // and offset is 0.6
      // playback will start from 0.6
      // if loop, loop will resume from 0.5
      // else playback stops at 0.7
    }
  });

  const play = (
    buffer: AudioBuffer,
    region = { start: 0, end: 1 },
  ) => {
    stop();
    setRegion(region);
    setStartedAt(audioContext.currentTime);
    if (loop()) {
      active = schedulePlaybackLoop(
        audioContext,
        buffer,
        region,
        speed(),
        fxAssembly.in,
      );
    } else {
      active = {
        nodeAssembly: schedulePlaybackSingle(
          audioContext,
          buffer,
          region,
          speed(),
          fxAssembly.in,
          stop,
        ),
      };
    }
  };

  const stop = () => {
    if (!active) {
      return;
    }
    clearInterval(active.gainEnvelopeScheduler);
    smoothStop(active.nodeAssembly);
    active = undefined;
    setStartedAt(undefined);
  };

  const playing = () => startedAt() !== undefined;

  const [progress, setProgress] = createSignal(0);
  useAnimationFrame(() => {
    const startedAt_ = startedAt();
    if (!startedAt_ || !active?.nodeAssembly.sourceNode.buffer) return;

    const regionDuration = (region().end - region().start) *
      active.nodeAssembly.sourceNode.buffer.duration;
    const timeSinceStart = audioContext.currentTime - startedAt_;
    const loopTime = timeSinceStart * speed() % regionDuration;
    const regionOffset = active.nodeAssembly.sourceNode.buffer.duration *
      region().start;
    const elapsed = loopTime + regionOffset;

    setProgress(elapsed / active.nodeAssembly.sourceNode.buffer.duration);
  });

  return {
    play,
    playing,
    region,
    stop,
    progress,
    loop,
    setLoop,
    pitchOffsetSemis,
    setPitchOffsetSemis,
    pitchOffsetCents,
    setPitchOffsetCents,
    loPass,
    setLoPass: (v: number) => {
      if (v < hiPass()) {
        setHiPass(v);
      }
      setLoPass(v);
    },
    hiPass,
    setHiPass: (v: number) => {
      if (loPass() < v) {
        setLoPass(v);
      }
      setHiPass(v);
    },
    speed,
  };
}

// @ts-ignore
window.createPlayer = createPlayer;

const smoothStop = (assembly: SourceAssembly, ramp = 0.001) => {
  const end = audioContext.currentTime + ramp;
  assembly.gainNode.gain.cancelScheduledValues(audioContext.currentTime);
  assembly.gainNode.gain.setValueAtTime(1, audioContext.currentTime);
  assembly.gainNode.gain.linearRampToValueAtTime(0, end);

  assembly.sourceNode.onended = null;
  assembly.sourceNode.stop(end);
};

const schedulePlaybackSingle = (
  audioContext: AudioContext | OfflineAudioContext,
  buffer: AudioBuffer,
  region: { start: number; end: number },
  speed: number,
  out: AudioNode,
  onended?: () => void,
): SourceAssembly => {
  const now = audioContext.currentTime;
  const start = buffer.duration * region.start;
  const duration = buffer.duration * (region.end - region.start);

  const gainNode = audioContext.createGain();
  gainNode.connect(out);

  const sourceNode = audioContext.createBufferSource();
  sourceNode.playbackRate.value = speed;
  sourceNode.buffer = buffer;
  sourceNode.connect(gainNode);
  if (onended) sourceNode.onended = onended;

  scheduleEnvelope(gainNode, {
    start: now,
    end: now + duration / speed,
    ramp: 0.001,
  });

  sourceNode.start(now, start, duration);

  return { sourceNode, gainNode };
};

const schedulePlaybackLoop = (
  audioContext: AudioContext | OfflineAudioContext,
  buffer: AudioBuffer,
  region: { start: number; end: number },
  speed: number,
  out: AudioNode,
) => {
  const now = audioContext.currentTime;
  const bufferStartOffset = buffer.duration * region.start;
  const bufferEndOffset = buffer.duration * region.end;

  const gainNode = audioContext.createGain();
  gainNode.connect(out);

  const sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.loop = true;
  sourceNode.loopStart = bufferStartOffset;
  sourceNode.loopEnd = bufferEndOffset;
  sourceNode.playbackRate.value = speed;
  sourceNode.connect(gainNode);

  const nodeAssembly = { sourceNode, gainNode };

  const gainEnvelopeScheduler = startEnvelopeScheduler(
    nodeAssembly,
    region,
    now,
    speed,
  );

  sourceNode.start(now, bufferStartOffset);

  return { nodeAssembly, gainEnvelopeScheduler };
};

const startEnvelopeScheduler = (
  nodeAssembly: SourceAssembly,
  region: { start: number; end: number },
  when: number,
  speed: number,
) => {
  const regionDuration = (region.end - region.start) *
    (nodeAssembly.sourceNode.buffer?.duration || 1) / speed;

  let lastIterationScheduled = -1;

  // schedule upcoming envelopes in batches
  const intervalCallback = () => {
    // look ahead 1s
    const horizon = audioContext.currentTime + 1;

    for (
      let i = lastIterationScheduled + 1;
      i * regionDuration + when < horizon;
      i++
    ) {
      lastIterationScheduled = i;
      scheduleEnvelope(
        nodeAssembly.gainNode,
        {
          start: when + i * regionDuration,
          end: when + (i + 1) * regionDuration,
          ramp: 0.001,
        },
      );
    }
  };

  intervalCallback();

  return setInterval(intervalCallback, 300);
};

const scheduleEnvelope = (
  gainNode: GainNode,
  envelope: {
    start: number;
    end: number;
    ramp: number;
  },
) => {
  gainNode.gain.setValueAtTime(0, envelope.start);
  gainNode.gain.linearRampToValueAtTime(1, envelope.start + envelope.ramp);
  gainNode.gain.setValueAtTime(1, envelope.end - envelope.ramp);
  gainNode.gain.linearRampToValueAtTime(0, envelope.end);
};

export const print = async (
  buffer: AudioBuffer,
  region: { start: number; end: number },
  speed: number,
  hiPass: number,
  loPass: number,
) => {
  // render audiobuffer of region
  const offlineAudioContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.duration * buffer.sampleRate *
      (region.end - region.start) / speed,
    buffer.sampleRate,
  );

  const fxPipeline = createFxAssembly(offlineAudioContext);
  fxPipeline.hiPassFreq.value = mapLinearToLogarithmic(hiPass);
  fxPipeline.loPassFreq.value = mapLinearToLogarithmic(loPass);
  fxPipeline.out.connect(offlineAudioContext.destination);

  schedulePlaybackSingle(
    offlineAudioContext,
    buffer,
    region,
    speed,
    fxPipeline.in,
  );
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

export function mapLinearToLogarithmic(x: number) {
  const xMin = 0;
  const xMax = 100;
  const yMin = 20;
  const yMax = 20000;

  const logInterpolation = (Math.log10(yMax) - Math.log10(yMin)) *
    ((x - xMin) / (xMax - xMin));
  const y = Math.pow(10, Math.log10(yMin) + logInterpolation);

  return y;
}
