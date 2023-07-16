import { Clip } from "./types";
import { createEffect, createSignal } from "solid-js";

export const [clip, setClip] = createSignal<Clip | undefined>();
// exposing setClip on window so that we can setClip from tests
// @ts-ignore
window.setClip = setClip;

export const [cursor, setCursor] = createSignal<number>(0);

const defaultSlices = [0];
const [slices, setSlices] = createSignal<number[]>(defaultSlices);

const sortedIndex = (arr: number[], value: number) => {
  let low = 0;
  let high = arr.length;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid] < value) {
      low = mid + 1;
    } else if (arr[mid] > value) {
      high = mid - 1;
    } else {
      return mid;
    }
  }
  return low;
};

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
