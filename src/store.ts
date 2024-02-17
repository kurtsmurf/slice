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

let undoStack: UpdateRegionsEvent[] = [];
let redoStack: UpdateRegionsEvent[] = [];

let lastDispatchTime = Date.now();

export const dispatch = (event: Event) => {
  lastDispatchTime = Date.now();

  switch (event.type) {
    case "reset": {
      undoStack = [];
      redoStack = [];
      return setStore(defaultState);
    }
    case "setClip": {
      undoStack = [];
      redoStack = [];
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
    case "selectRegion": {
      return setStore("selectedRegion", event.index);
    }
    default: {
      const lastEvent = undoStack[undoStack.length - 1];

      // deduplicate rapid moveSlice events on the undo stack
      if (
        event.type === "moveSlice" &&
        lastEvent?.type === "moveSlice" &&
        event.index === lastEvent?.index &&
        Date.now() - lastDispatchTime < 1000
      ) {
        undoStack[undoStack.length - 1] = event;
      } else {
        undoStack.push(event);
      }

      redoStack = [];

      updateRegions(event);
    }
  }
};

const updateRegions = (event: UpdateRegionsEvent) => {
  switch (event.type) {
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
    case "combineRegions": {
      if (
        !state.regions[event.startIndex] ||
        !state.regions[event.endIndex] ||
        event.endIndex <= event.startIndex
      ) {
        return;
      }

      if (state.selectedRegion) {
        if (state.selectedRegion > event.startIndex) {
          if (state.selectedRegion <= event.endIndex) {
            setStore("selectedRegion", event.startIndex);
          } else {
            setStore(
              "selectedRegion",
              state.selectedRegion - (event.endIndex - event.startIndex),
            );
          }
        }
      }

      setStore("regions", (prev) => [
        ...prev.slice(0, event.startIndex),
        { start: prev[event.startIndex].start, end: prev[event.endIndex].end },
        ...prev.slice(event.endIndex + 1),
      ]);

      return;
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
  | { type: "selectRegion"; index: number | undefined }
  | UpdateRegionsEvent;

type UpdateRegionsEvent =
  | { type: "slice"; index: number; pos: number }
  | { type: "segmentRegion"; index: number; pieces: number }
  | { type: "combineRegions"; startIndex: number; endIndex: number }
  | { type: "healSlice"; index: number }
  | { type: "moveSlice"; index: number; pos: number };

// @ts-ignore
window.state = state;

export const same = (a: Region, b: Region) =>
  a.start === b.start && a.end === b.end;

const roughUndo = () => {
  console.log(undoStack, redoStack);

  const eventToUndo = undoStack.pop();

  if (eventToUndo) {
    setStore("regions", defaultState.regions);
    console.log("undoing:", eventToUndo);
    redoStack.push(eventToUndo);
    undoStack.forEach(updateRegions);
    if (state.selectedRegion && state.selectedRegion >= state.regions.length) {
      setStore("selectedRegion", state.regions.length - 1);
    }
  }
};

const roughRedo = () => {
  console.log(undoStack, redoStack);

  const eventToRedo = redoStack.pop();
  if (eventToRedo) {
    updateRegions(eventToRedo);
    undoStack.push(eventToRedo);
  }
};

// @ts-ignore
window.undo = roughUndo;

// @ts-ignore
window.redo = roughRedo;
