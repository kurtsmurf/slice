import { onCleanup, onMount } from "solid-js";

export const useAnimationFrame = (callback: () => void) => {
  let animationFrame: number;

  const tick = () => {
    callback();
    animationFrame = requestAnimationFrame(tick);
  };

  onMount(() => {
    animationFrame = requestAnimationFrame(tick);
  });

  onCleanup(() => {
    cancelAnimationFrame(animationFrame);
  });
};
