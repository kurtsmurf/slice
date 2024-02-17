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

let undoStack: RegionsMigration[] = [];
let redoStack: RegionsMigration[] = [];

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
      const lastMigration = undoStack[undoStack.length - 1];



      // deduplicate rapid moveSlice events on the undo stack
      if (
        event.type === "moveSlice" &&
        lastMigration?.forward.type === "moveSlice" &&
        event.index === lastMigration?.forward.index &&
        Date.now() - lastDispatchTime < 1000
      ) {
        undoStack[undoStack.length - 1] = {
          forward: event,
          backward: lastMigration.backward,
        };

      } else {
        undoStack.push(migrationOfEvent(event));
      }

      redoStack = [];

      updateRegions(event);
    }
  }
};

const migrationOfEvent = (event: UpdateRegionsEvent): RegionsMigration => {
  switch (event.type) {
    case "slice": {
      return {
        forward: event,
        backward: {
          type: "healSlice",
          index: event.index + 1
        }
      };
    }
    case "segmentRegion": {
      return {
        forward: event,
        backward: {
          type: "combineRegions",
          startIndex: event.index,
          endIndex: event.index + event.pieces - 1,
        }
      };
    }
    case "combineRegions": {
      // bad - segmentRegions is not equivalent to reversing combine
      // because the combined regions may not be evenly spaced
      // but the segmented regions will be
      // solution: create an "replace" event that replaces a target region
      // by index with an arbitrary array of regions
      // use that to reverse combineRegions
      return {
        forward: event,
        backward: {
          type: "segmentRegion",
          index: event.startIndex,
          pieces: event.endIndex - event.startIndex,
        }
      };
    }
    case "healSlice": {
      return {
        forward: event,
        backward: {
          type: "slice",
          index: event.index - 1,
          pos: state.regions[event.index].start
        }
      };
    }
    case "moveSlice": {

      return {
        forward: event,
        backward: {
          ...event,
          pos: state.regions[event.index].start
        }
      };
    }
  }
}

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

type RegionsMigration = {
  forward: UpdateRegionsEvent,
  backward: UpdateRegionsEvent,
}

// @ts-ignore
window.state = state;

export const same = (a: Region, b: Region) =>
  a.start === b.start && a.end === b.end;

const roughUndo = () => {
  console.log(undoStack, redoStack);

  const eventToUndo = undoStack.pop();

  if (eventToUndo) {
    // setStore("regions", defaultState.regions);
    console.log("undoing:", eventToUndo);
    redoStack.push(eventToUndo);
    // undoStack.map(m => m.forward).forEach(updateRegions);

    updateRegions(eventToUndo.backward)

    if (state.selectedRegion && state.selectedRegion >= state.regions.length) {
      setStore("selectedRegion", state.regions.length - 1);
    }
  }
};

const roughRedo = () => {
  console.log(undoStack, redoStack);

  const eventToRedo = redoStack.pop();
  if (eventToRedo) {
    updateRegions(eventToRedo.forward);
    undoStack.push(eventToRedo);
  }
};

// @ts-ignore
window.undo = roughUndo;

// @ts-ignore
window.redo = roughRedo;
