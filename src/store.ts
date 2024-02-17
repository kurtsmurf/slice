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

let undoStack: Event[] = [];
let redoStack: Event[] = [];

export const dispatch = (event: Event, isRedo=false) => {
  console.log("dispatching:", event);

  const undoableEvents: Event["type"][] = [
    "slice",
    "segmentRegion",
    "healSlice",
    "moveSlice",
    "setCursor",
  ];

  if (undoableEvents.includes(event.type)) {
    undoStack.push(event);
    if (!isRedo) redoStack = [];
  }

  if (["reset", "setClip"].includes(event.type)) {
    undoStack = [];
    redoStack = [];
  }

  console.log("undo stack:", undoStack);
  console.log("redo stack:", redoStack);

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

      if (!region) return;

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

      if (!region) return;

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
window.dispatch = dispatch;

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

export const same = (a: Region, b: Region) =>
  a.start === b.start && a.end === b.end;

const roughUndo = () => {
  console.log(undoStack, redoStack)

  const eventsCopy = undoStack.slice();
  const eventToUndo = eventsCopy.pop();
  if (eventToUndo) {
    setStore("regions", [{ start: 0, end: 1 }]);
    setStore("cursor", 0);
    undoStack = [];
    console.log("undoing:", eventToUndo);
    redoStack.push(eventToUndo)
    eventsCopy.forEach(e => dispatch(e, true));
    if (state.selectedRegion && state.selectedRegion >= state.regions.length) {
      setStore("selectedRegion", state.regions.length - 1);
    }
  }
};

const roughRedo = () => {
  console.log(undoStack, redoStack)

  const eventToRedo = redoStack.pop();
  if (eventToRedo) {
    dispatch(eventToRedo, true)
  }
}

// @ts-ignore
window.undo = roughUndo;

// @ts-ignore
window.redo = roughRedo;