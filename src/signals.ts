import { createSignal, createEffect } from "solid-js";

export type Clip = {
  buffer: AudioBuffer;
  name: string;
};

export const [clip, setClip] = createSignal<Clip | undefined>();
 
// @ts-ignore
createEffect(() => window.clip = clip())