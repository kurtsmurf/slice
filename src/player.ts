import { createEffect, createSignal } from "solid-js";
import { audioContext } from "./audioContext";
import { useAnimationFrame } from "./behaviors/useAnimationFrame";
import audiobufferToWav from "audiobuffer-to-wav";
import { createStore, SetStoreFunction, Store } from "solid-js/store";

export const player = createPlayer(audioContext);

// @ts-ignore
window.player = player;

type SourceAssembly = {
  sourceNode: AudioBufferSourceNode;
  gainNode: GainNode;
};

type FxAssembly = {
  in: AudioNode;
  out: AudioNode;
  loPassFreq: AudioParam;
  hiPassFreq: AudioParam;
  compressionThreshold: AudioParam;
  gain: AudioParam;
};

/**
 * represents a region of an audio buffer
 */
export type Region = {
  /** start position within buffer range 0-1 */
  start: number;
  /** end position within buffer range 0-1 */
  end: number;
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

  const compressor = audioContext.createDynamicsCompressor();

  const gain = audioContext.createGain();

  loPassFilter.connect(hiPassFilter).connect(compressor).connect(gain);

  return {
    in: loPassFilter,
    out: gain,
    loPassFreq: loPassFilter.frequency,
    hiPassFreq: hiPassFilter.frequency,
    compressionThreshold: compressor.threshold,
    gain: gain.gain,
  };
}

type Source = {
  sourceAssembly: SourceAssembly;
  gainEnvelopeScheduler?: NodeJS.Timer;
};

function createPlayer(audioContext: AudioContext | OfflineAudioContext): {
  play: (
    buffer: AudioBuffer,
    region: Region,
  ) => void;
  playing: () => boolean;
  region: () => Region;
  stop: () => void;
  progress: () => number;
  settings: Store<PlayerSettings>;
  updateSettings: SetStoreFunction<PlayerSettings>;
} {
  const [settings, updateSettings] = createStore<PlayerSettings>({
    loop: false,
    // speed function converts semis/cents to playback rate multiplier

    pitchOffsetSemis: 0,
    pitchOffsetCents: 0,
    // 0-100, which is later mapped logarithmically to hz
    // hiPass < loPass is discouraged (results in silence)
    // create effect to nudge on pass
    loPass: 100,
    hiPass: 0,
    // dbs <= 0
    compressionThreshold: 0,
    // dbs
    gain: 0,
  });

  const [startedAt, setStartedAt] = createSignal<number | undefined>(undefined);
  const [region, setRegion] = createSignal<Region>({
    start: 0,
    end: 1,
  });
  let activeSource: Source | undefined;
  /**
   * @returns the speed at which to play audio based on the pitch offset
   */
  const speed = () =>
    speedFromChromatic(
      settings.pitchOffsetSemis,
      settings.pitchOffsetCents,
    );
  const fxAssembly = createFxAssembly(audioContext);
  fxAssembly.out.connect(audioContext.destination);

  createEffect(() => {
    rampTo(fxAssembly.gain, Math.pow(10, settings.gain / 20));
  });

  createEffect(() => {
    // when hiPass changes
    // update the filter by mapping hiPass to hz
    rampTo(fxAssembly.hiPassFreq, mapLinearToLogarithmic(settings.hiPass));
  });

  createEffect(() => {
    // when loPass changes
    // update the filter by mapping loPass to hz
    rampTo(fxAssembly.loPassFreq, mapLinearToLogarithmic(settings.loPass));
  });

  createEffect(() => {
    // when compression threshold changes
    // update the dynamics compressor node threshold
    rampTo(fxAssembly.compressionThreshold, settings.compressionThreshold);
  });

  createEffect(() => {
    // when speed changes
    speed();

    const currentBuffer = activeSource?.sourceAssembly.sourceNode.buffer;

    // if playing
    if (currentBuffer) {
      // restart player
      stop();
      play(currentBuffer, region());
    }
  });

  const play = (
    buffer: AudioBuffer,
    region = { start: 0, end: 1 },
  ) => {
    stop();
    setRegion(region);
    setStartedAt(audioContext.currentTime);
    if (settings.loop) {
      activeSource = schedulePlaybackLoop(
        audioContext,
        buffer,
        region,
        speed(),
        fxAssembly.in,
      );
    } else {
      activeSource = {
        sourceAssembly: schedulePlaybackSingle(
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
    if (!activeSource) {
      return;
    }
    clearInterval(activeSource.gainEnvelopeScheduler);
    smoothStop(activeSource.sourceAssembly);
    activeSource = undefined;
    setStartedAt(undefined);
  };

  const playing = () => startedAt() !== undefined;

  const [progress, setProgress] = createSignal(0);

  // sync progress
  useAnimationFrame(() => {
    const startedAt_ = startedAt();
    if (!startedAt_ || !activeSource?.sourceAssembly.sourceNode.buffer) return;

    const regionDuration = (region().end - region().start) *
      activeSource.sourceAssembly.sourceNode.buffer.duration;
    const timeSinceStart = audioContext.currentTime - startedAt_;
    const loopTime = timeSinceStart * speed() % regionDuration;
    const regionOffset =
      activeSource.sourceAssembly.sourceNode.buffer.duration *
      region().start;
    const elapsed = loopTime + regionOffset;

    setProgress(
      elapsed / activeSource.sourceAssembly.sourceNode.buffer.duration,
    );
  });

  return {
    play,
    playing,
    region,
    stop,
    progress,
    settings,
    updateSettings,
  };
}

export type PlayerSettings = {
  loop: boolean;
  pitchOffsetSemis: number;
  pitchOffsetCents: number;
  // 0-100, which is later mapped logarithmically to hz
  // hiPass < loPass is discouraged (results in silence)
  // create effect to nudge on pass
  loPass: number;
  hiPass: number;
  // dbs <= 0
  compressionThreshold: number;
  // dbs
  gain: number;
};

// @ts-ignore
window.createPlayer = createPlayer;

function rampTo(param: AudioParam, value: number, ramp = 0.001) {
  param.cancelScheduledValues(audioContext.currentTime);
  param.value = param.value;
  param.linearRampToValueAtTime(value, audioContext.currentTime + ramp);
}

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
  region: Region,
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
  region: Region,
  speed: number,
  out: AudioNode,
): Source => {
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

  const sourceAssembly = { sourceNode, gainNode };

  const gainEnvelopeScheduler = startEnvelopeScheduler(
    sourceAssembly,
    region,
    now,
    speed,
  );

  sourceNode.start(now, bufferStartOffset);

  return { sourceAssembly, gainEnvelopeScheduler };
};

const startEnvelopeScheduler = (
  sourceAssembly: SourceAssembly,
  region: Region,
  when: number,
  speed: number,
) => {
  const regionDuration = (region.end - region.start) *
    (sourceAssembly.sourceNode.buffer?.duration || 1) / speed;

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
        sourceAssembly.gainNode,
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
  region: Region,
  settings: PlayerSettings,
) => {
  // render audiobuffer of region
  const offlineAudioContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.duration * buffer.sampleRate *
      (region.end - region.start) /
      speedFromChromatic(settings.pitchOffsetSemis, settings.pitchOffsetCents),
    buffer.sampleRate,
  );

  const fxPipeline = createFxAssembly(offlineAudioContext);
  fxPipeline.hiPassFreq.value = mapLinearToLogarithmic(settings.hiPass);
  fxPipeline.loPassFreq.value = mapLinearToLogarithmic(settings.loPass);
  fxPipeline.compressionThreshold.value = settings.compressionThreshold;
  fxPipeline.gain.value = Math.pow(10, settings.gain / 20);
  fxPipeline.out.connect(offlineAudioContext.destination);

  schedulePlaybackSingle(
    offlineAudioContext,
    buffer,
    region,
    speedFromChromatic(settings.pitchOffsetSemis, settings.pitchOffsetCents),
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

export function speedFromChromatic(semis: number, cents: number) {
  const totalCents = cents + (100 * semis);
  return Math.pow(2, totalCents / 1200);
}
