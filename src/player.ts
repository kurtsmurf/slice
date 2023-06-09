import { createSignal } from "solid-js";
import { audioContext } from "./audioContext";
import { useAnimationFrame } from "./useAnimationFrame";

export const player = (function createPlayer() {
  const ramp = 0.001;
  const [startedAt, setStartedAt] = createSignal<number | undefined>(undefined);
  const [startOffset, setStartOffset] = createSignal<number>(0);
  let sourceNode: AudioBufferSourceNode | undefined;
  let gainNode: GainNode | undefined;

  const play = (buffer: AudioBuffer, offset = 0, duration?: number) => {
    stop();
    setStartOffset(offset);
    setStartedAt(audioContext.currentTime);

    gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + ramp);

    if (duration) {
      const end = audioContext.currentTime + duration;
      gainNode.gain.setValueAtTime(1, end - ramp);
      gainNode.gain.linearRampToValueAtTime(0, end);
    }

    const node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.connect(gainNode);
    node.onended = stop;
    node.start(0, offset, duration);

    sourceNode = node;
  };

  const stop = () => {
    if (!sourceNode || !gainNode) {
      return;
    }

    const end = audioContext.currentTime + ramp;
    gainNode.gain.cancelScheduledValues(audioContext.currentTime);
    gainNode.gain.setValueAtTime(1, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, end);

    sourceNode.onended = null;
    sourceNode.stop(end);
    sourceNode = undefined;
    setStartedAt(undefined);
  };

  const playing = () => startedAt() !== undefined;

  const [progress, setProgress] = createSignal(0);
  useAnimationFrame(() => {
    const startedAt_ = startedAt();
    if (!startedAt_ || !sourceNode?.buffer) {
      return 0;
    }
    const timeSinceStart = audioContext.currentTime - startedAt_;
    const elapsed = timeSinceStart + startOffset();
    setProgress(elapsed / sourceNode.buffer.duration);
  });

  return { play, playing, stop, startedAt, progress };
})();
