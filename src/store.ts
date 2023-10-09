import { sortedIndex } from "./util/sortedIndex";
import { Clip } from "./types";
import { createStore } from "solid-js/store";

type State = {
  cursor: number;
  cursorControlsVisible: boolean;
  deleting: boolean;
  editing: boolean;
  clip: Clip | undefined;
  regions: { start: number; end: number }[];
  selectedRegion: number | undefined;
};

// frozen to prevent mutation on store update
const defaultState: State = Object.freeze({
  cursor: 0,
  deleting: false,
  editing: false,
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
  startEditing: () => setStore("editing", true),
  stopEditing: () => setStore("editing", false),
  startDeleting: () => setStore("deleting", true),
  stopDeleting: () => setStore("deleting", false),
  slice: (pos: number) => {
    const index = sortedIndex(store.regions.map((r) => r.start), pos);
    if (store.regions[index]?.start === pos) return;
    setStore("regions", (prev) => [
      ...prev.slice(0, index).map((v, i) =>
        // update right bound of new region left neighbor
        i === index - 1 ? { start: v.start, end: pos } : v
      ),
      // insert region
      { start: pos, end: prev[index]?.start || 1 },
      ...prev.slice(index),
    ]);
    return index;
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
  selectRegion: (index: number | undefined) =>
    setStore("selectedRegion", index),
};

// @ts-ignore
window.state = state;
// @ts-ignore
window.dispatch = dispatch;
