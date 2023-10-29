import { Clip } from "./types";
import { createStore } from "solid-js/store";
import { range } from "./util/range";

type Mode = "delete" | "edit" | "slice";

type State = {
  cursor: number;
  cursorControlsVisible: boolean;
  mode: Mode;
  clip: Clip | undefined;
  regions: { start: number; end: number }[];
  selectedRegion: number | undefined;
};

// frozen to prevent mutation on store update
const defaultState: State = Object.freeze({
  cursor: 0,
  mode: "slice",
  cursorControlsVisible: false,
  clip: undefined,
  regions: [{ start: 0, end: 1 }],
  selectedRegion: undefined,
});

const [store, setStore] = createStore<State>(defaultState);

export const state = store;
export const dispatch = {
  reset: () => setStore(defaultState),
  setClip: (c: Clip) => setStore("clip", c),
  setCursor: (pos: number) => setStore("cursor", Math.max(0, Math.min(pos, 1))),
  showCursorControls: () => setStore("cursorControlsVisible", true),
  hideCursorControls: () => setStore("cursorControlsVisible", false),
  setMode: (mode: Mode) => setStore("mode", mode),
  slice: (index: number, pos: number) => {
    const region = store.regions[index];
    if (pos <= region.start || pos >= region.end) return;
    setStore("regions", (prev) => [
      ...prev.slice(0, index),
      { start: region.start, end: pos },
      { start: pos, end: region.end },
      ...prev.slice(index + 1),
    ]);
  },
  segmentRegion: (index: number, pieces: number) => {
    const region = store.regions[index];
    const segmentLength = (region.end - region.start) / pieces;
    setStore("regions", (prev) => [
      ...prev.slice(0, index),
      ...range(0, pieces).map((n) => ({
        start: region.start + segmentLength * n,
        end: region.start + segmentLength * (n + 1),
      })),
      ...prev.slice(index + 1),
    ]);
  },
  healSlice: (index: number) => {
    setStore("regions", (prev) => [
      ...prev.slice(0, index).map((v, i) =>
        // update right bound of removed region left neighbor
        i === index - 1
          ? { start: v.start, end: prev[index + 1]?.start || 1 }
          : v
      ),
      // omit region
      ...prev.slice(index + 1),
    ]);
  },
  moveSlice: (index: number, pos: number) => {
    const region = store.regions[index];
    const leftBound = store.regions[index - 1].start || 0;
    if (pos <= leftBound || pos >= region.end) return;
    setStore("regions", index - 1, (prev) => ({ start: prev.start, end: pos }));
    setStore("regions", index, (prev) => ({ start: pos, end: prev.end }));
  },
  selectRegion: (index: number | undefined) =>
    setStore("selectedRegion", index),
};

// @ts-ignore
window.state = state;
// @ts-ignore
window.dispatch = dispatch;
