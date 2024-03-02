import { Clip } from "./types";
import { createStore } from "solid-js/store";
import { range } from "./util/range";
import { player, Region } from "./player";
import { createEffect, createSignal } from "solid-js";
import localforage from "localforage";
import { audioContext } from "./audioContext";

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

let [undoStack, setUndoStack] = createSignal<RegionsMigration[]>([], {
  equals: false,
});
let [redoStack, setRedoStack] = createSignal<RegionsMigration[]>([], {
  equals: false,
});

let lastDispatchTime = Date.now();

// @ts-ignore
window.localforage = localforage;

export const dispatch = (event: Event) => {
  switch (event.type) {
    case "reset": {
      setUndoStack([]);
      setRedoStack([]);
      setStore(defaultState);
      break;
    }
    case "setClip": {
      setUndoStack([]);
      setRedoStack([]);
      setStore("clip", event.clip);
      break;
    }
    case "setCursor": {
      setStore("cursor", Math.max(0, Math.min(event.pos, 1)));
      break;
    }
    case "showCursorControls": {
      setStore("cursorControlsVisible", true);
      break;
    }
    case "hideCursorControls": {
      setStore("cursorControlsVisible", false);
      break;
    }
    case "setMode": {
      setStore("mode", event.mode);
      break;
    }
    case "selectRegion": {
      setStore("selectedRegion", event.index);
      break;
    }
    default: {
      const lastMigration = undoStack()[undoStack().length - 1];

      // deduplicate rapid moveSlice events on the undo stack
      if (
        event.type === "moveSlice" &&
        lastMigration?.forward.type === "moveSlice" &&
        event.index === lastMigration?.forward.index &&
        Date.now() - lastDispatchTime < 1000
      ) {
        setUndoStack((prev) => {
          prev[prev.length - 1] = {
            forward: event,
            backward: lastMigration.backward,
          };
          return prev;
        });
      } else {
        setUndoStack((prev) => {
          prev.push(migrationOfEvent(event));
          return prev;
        });
      }

      setRedoStack([]);

      updateRegions(event);
    }
  }

  lastDispatchTime = Date.now();
};

const migrationOfEvent = (event: UpdateRegionsEvent): RegionsMigration => {
  switch (event.type) {
    case "slice": {
      return {
        forward: event,
        backward: {
          type: "healSlice",
          index: event.index + 1,
        },
      };
    }
    case "segmentRegion": {
      return {
        forward: event,
        backward: {
          type: "combineRegions",
          startIndex: event.index,
          endIndex: event.index + event.pieces - 1,
        },
      };
    }
    case "combineRegions": {
      // bad? - segmentRegions is not equivalent to reversing combine
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
        },
      };
    }
    case "healSlice": {
      return {
        forward: event,
        backward: {
          type: "slice",
          index: event.index - 1,
          // @ts-ignore ?????
          pos: state.regions[event.index].start,
        },
      };
    }
    case "moveSlice": {
      return {
        forward: event,
        backward: {
          ...event,
          // @ts-ignore ?????
          pos: state.regions[event.index].start,
        },
      };
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
      setStore("regions", (prev) => [
        ...prev.slice(0, event.index),
        { start: region.start, end: event.pos },
        { start: event.pos, end: region.end },
        ...prev.slice(event.index + 1),
      ]);
      break;
    }
    case "segmentRegion": {
      const region = store.regions[event.index];

      if (!region) return;

      const segmentLength = (region.end - region.start) / event.pieces;
      if (same(player.region(), region)) player.stop();
      setStore("regions", (prev) => [
        ...prev.slice(0, event.index),
        ...range(0, event.pieces).map((n) => ({
          start: region.start + segmentLength * n,
          end: region.start + segmentLength * (n + 1),
        })),
        ...prev.slice(event.index + 1),
      ]);
      break;
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

      setStore("regions", (prev) => {
        const first = prev[event.startIndex];
        const last = prev[event.endIndex];

        if (!first || !last) return prev;

        return [
          ...prev.slice(0, event.startIndex),
          { start: first.start, end: last.end },
          ...prev.slice(event.endIndex + 1),
        ];
      });

      break;
    }
    case "healSlice": {
      const target = store.regions[event.index];
      const leftNeighbor = store.regions[event.index - 1];

      if (!target || !leftNeighbor) return;

      if (
        same(player.region(), target) ||
        same(player.region(), leftNeighbor)
      ) {
        player.stop();
      }

      setStore("regions", (prev) => [
        ...prev.slice(0, event.index).map((v, i) =>
          // update right bound of removed region left neighbor
          i === event.index - 1
            ? { start: v.start, end: prev[event.index + 1]?.start || 1 }
            : v
        ),
        // omit region
        ...prev.slice(event.index + 1),
      ]);
      break;
    }
    case "moveSlice": {
      const region = store.regions[event.index];
      const leftNeighbor = store.regions[event.index - 1];
      if (!region || !leftNeighbor) return;
      if (event.pos <= leftNeighbor.start || event.pos >= region.end) return;
      if (
        same(player.region(), region) ||
        same(player.region(), leftNeighbor)
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
      break;
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
  forward: UpdateRegionsEvent;
  backward: UpdateRegionsEvent;
};

// @ts-ignore
window.state = state;

export const same = (a: Region, b: Region) =>
  a.start === b.start && a.end === b.end;

const roughUndo = () => {
  const eventToUndo = undoStack().pop();
  setUndoStack((prev) => prev);

  if (eventToUndo) {
    setRedoStack((prev) => {
      prev.push(eventToUndo);
      return prev;
    });

    updateRegions(eventToUndo.backward);

    if (state.selectedRegion && state.selectedRegion >= state.regions.length) {
      setStore("selectedRegion", state.regions.length - 1);
    }
  }
};

const roughRedo = () => {
  const eventToRedo = redoStack().pop();
  setRedoStack((prev) => prev);

  if (eventToRedo) {
    updateRegions(eventToRedo.forward);
    undoStack().push(eventToRedo);
    setUndoStack((prev) => prev);
  }
};

export const undo = {
  execute: roughUndo,
  disabled: () => undoStack().length === 0,
};
export const redo = {
  execute: roughRedo,
  disabled: () => redoStack().length === 0,
};

export const [busy, setBusy] = createSignal(false);

(async () => {
  setBusy(true);
  try {
    const name = sessionStorage.getItem("name");
    const lengthStr = sessionStorage.getItem("length");
    const sampleRateStr = sessionStorage.getItem("sampleRate");
    const numberOfChannelsStr = sessionStorage.getItem("numberOfChannels");

    if (!name || !lengthStr || !sampleRateStr || !numberOfChannelsStr) return;

    const length = parseInt(lengthStr);
    const sampleRate = parseInt(sampleRateStr);
    const numberOfChannels = parseInt(numberOfChannelsStr);

    const buffer = audioContext.createBuffer(
      numberOfChannels,
      length,
      sampleRate,
    );

    for (let i = 0; i < numberOfChannels; i++) {
      const channel = await localforage.getItem(name + "_" + i) as Float32Array;
      buffer.copyToChannel(channel, i);
    }

    setStore("clip", { name, buffer });

    await localforage.getItem("regions").then((arr) => {
      console.log(arr);

      if (!Array.isArray(arr)) return;

      const regions = arr.map((r, i, a) => {
        return { start: r, end: a[i + 1] || 1 };
      });

      setStore("regions", regions);
    });

    setUndoStack(get("undoStack") || []);
    setRedoStack(get("redoStack") || []);
  } finally {
    setBusy(false);
  }
})().then(() => {
  // persist undo/redo
  createEffect(() =>
    localStorage.setItem("redoStack", JSON.stringify(redoStack()))
  );
  createEffect(() =>
    localStorage.setItem("undoStack", JSON.stringify(undoStack()))
  );

  // persist regions
  createEffect(() => {
    localforage.setItem("regions", store.regions.map((r) => r.start));
  });

  // persist channels, clip metadata
  createEffect(() => {
    const clip = state.clip;

    if (clip) {
      sessionStorage.setItem("name", clip.name);
      sessionStorage.setItem("length", clip.buffer.length.toString());
      sessionStorage.setItem(
        "sampleRate",
        clip.buffer.sampleRate.toString(),
      );
      sessionStorage.setItem(
        "numberOfChannels",
        clip.buffer.numberOfChannels.toString(),
      );

      for (let i = 0; i < clip.buffer.numberOfChannels; i++) {
        localforage.setItem(
          clip.name + "_" + i,
          clip.buffer.getChannelData(i),
        );
      }
    } else {
      sessionStorage.clear();
    }
  });
});

function get(key: string) {
  const stored = localStorage.getItem(key);
  if (stored === null) return;
  let parsed;
  try {
    parsed = JSON.parse(stored);
  } catch {}
  return parsed;
}
