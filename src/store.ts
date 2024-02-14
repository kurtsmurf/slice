import { Clip } from "./types";
import { createStore } from "solid-js/store";
import { range } from "./util/range";
import { player, Region } from "./player";

type Mode = "delete" | "edit" | "slice";

type State = {
  cursor: number;
  cursorControlsVisible: boolean;
  mode: Mode;
  clip: Clip | undefined;
  regions: Region[];
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
    if (same(player.region(), region)) player.stop();
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
    if (same(player.region(), region)) player.stop();
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
    if (
      same(player.region(), store.regions[index]) ||
      same(player.region(), store.regions[index - 1])
    ) {
      player.stop();
    }

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
    if (
      same(player.region(), store.regions[index]) ||
      same(player.region(), store.regions[index - 1])
    ) {
      player.stop();
    }

    setStore("regions", index - 1, (prev) => ({ start: prev.start, end: pos }));
    setStore("regions", index, (prev) => ({ start: pos, end: prev.end }));
  },
  selectRegion: (index: number | undefined) =>
    setStore("selectedRegion", index),
};

export const spicyDispatch = (event: Event) => {

  console.log(event)

  switch (event.type) {
    case "reset": {
      return setStore(defaultState);
    }
    case "setClip": {
      return setStore("clip", event.clip);
    }
    case "setCursor": {
      return setStore("cursor", Math.max(0, Math.min(event.pos, 1)));
    }
    case "showCursorControls": {
      return setStore("cursorControlsVisible", true);
    }
    case "hideCursorControls": {
      return setStore("cursorControlsVisible", false);
    }
    case "setMode": {
      return setStore("mode", event.mode);
    }
    case "slice": {
      const region = store.regions[event.index];
      if (event.pos <= region.start || event.pos >= region.end) return;
      if (same(player.region(), region)) player.stop();
      return setStore("regions", (prev) => [
        ...prev.slice(0, event.index),
        { start: region.start, end: event.pos },
        { start: event.pos, end: region.end },
        ...prev.slice(event.index + 1),
      ]);
    }
    case "segmentRegion": {
      const region = store.regions[event.index];
      const segmentLength = (region.end - region.start) / event.pieces;
      if (same(player.region(), region)) player.stop();
      return setStore("regions", (prev) => [
        ...prev.slice(0, event.index),
        ...range(0, event.pieces).map((n) => ({
          start: region.start + segmentLength * n,
          end: region.start + segmentLength * (n + 1),
        })),
        ...prev.slice(event.index + 1),
      ]);
    }
    case "healSlice": {
      if (
        same(player.region(), store.regions[event.index]) ||
        same(player.region(), store.regions[event.index - 1])
      ) {
        player.stop();
      }

      return setStore("regions", (prev) => [
        ...prev.slice(0, event.index).map((v, i) =>
          // update right bound of removed region left neighbor
          i === event.index - 1
            ? { start: v.start, end: prev[event.index + 1]?.start || 1 }
            : v
        ),
        // omit region
        ...prev.slice(event.index + 1),
      ]);
    }
    case "moveSlice": {
      const region = store.regions[event.index];
      const leftBound = store.regions[event.index - 1].start || 0;
      if (event.pos <= leftBound || event.pos >= region.end) return;
      if (
        same(player.region(), store.regions[event.index]) ||
        same(player.region(), store.regions[event.index - 1])
      ) {
        player.stop();
      }

      setStore(
        "regions",
        event.index - 1,
        (prev) => ({ start: prev.start, end: event.pos }),
      );
      setStore(
        "regions",
        event.index,
        (prev) => ({ start: event.pos, end: prev.end }),
      );
      return;
    }
    case "selectRegion": {
      return setStore("selectedRegion", event.index);
    }
  }
};

// @ts-ignore
window.spicyDispatch = spicyDispatch;

type Event =
  | { type: "reset" }
  | { type: "setClip"; clip: Clip }
  | { type: "setCursor"; pos: number }
  | { type: "showCursorControls" }
  | { type: "hideCursorControls" }
  | { type: "setMode"; mode: Mode }
  | { type: "slice"; index: number; pos: number }
  | { type: "segmentRegion"; index: number; pieces: number }
  | { type: "healSlice"; index: number }
  | { type: "moveSlice"; index: number; pos: number }
  | { type: "selectRegion"; index: number | undefined };

// @ts-ignore
window.state = state;
// @ts-ignore
window.dispatch = dispatch;

export const same = (a: Region, b: Region) =>
  a.start === b.start && a.end === b.end;
