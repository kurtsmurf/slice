import { sortedIndex } from "./sortedIndex";
import { Clip } from "./types";
import { createSignal } from "solid-js";

export const [clip, setClip] = createSignal<Clip | undefined>();
// @ts-ignore
window.setClip = setClip;

export const [cursor, setCursor] = createSignal<number>(0);

const defaultSlices = [0];
const [slices, setSlices] = createSignal<number[]>(defaultSlices);

export const slice = (position: number) => {
  setSlices((prev) => {
    const i = sortedIndex(prev, position);
    if (prev[i] === position) return prev;
    return [...prev.slice(0, i), position, ...prev.slice(i)];
  });
};

// @ts-ignore
window.slice = slice;

export const healSlice = (index: number) =>
  setSlices((prev) => prev.filter((_, i) => index !== i));

export const regions = () =>
  slices().map((slice, i, arr) => {
    const end = arr[i + 1] || 1;
    return { start: slice, end };
  });

// @ts-ignore
window.regions = regions;

export const clearRegions = () => setSlices(defaultSlices);

export const [deleting, setDeleting] = createSignal(false);
export const [editing, setEditing] = createSignal(false);
