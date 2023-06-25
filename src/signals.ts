import { Clip } from "./types";
import { createSignal } from "solid-js";

export const [clip, setClip] = createSignal<Clip | undefined>();
// exposing setClip on window so that we can setClip from tests
// @ts-ignore
window.setClip = setClip;
export const [flags, setFlags] = createSignal<number[]>([]);
export const [cursor, setCursor] = createSignal<number>(0);
