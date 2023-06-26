import { Clip } from "./types";
import { createSignal } from "solid-js";

export const [clip, setClip] = createSignal<Clip | undefined>();
// exposing setClip on window so that we can setClip from tests
// @ts-ignore
window.setClip = setClip;

export const [cursor, setCursor] = createSignal<number>(0);

const defaultFlags = [0];
const flagsSignal = createSignal<number[]>(defaultFlags);
export const flags = flagsSignal[0];
const setFlags = flagsSignal[1];
export const clearFlags = () => setFlags(defaultFlags);

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

export const dropFlag = () => {
  setFlags((prev) => {
    const i = sortedIndex(prev, cursor());
    if (prev[i] === cursor()) return prev;
    return [...prev.slice(0, i), cursor(), ...prev.slice(i)];
  });
};
