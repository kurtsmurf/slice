import { Clip } from "./types";
import { createStore } from "solid-js/store";
import { range } from "./util/range";
import { player, Region } from "./player";
import { createSignal } from "solid-js";
import localforage from "localforage";
import { audioContext } from "./audioContext";
import debounce from "lodash.debounce";

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

const [undoStack, setUndoStack] = createSignal<UpdateRegionsEvent[]>([], {
  equals: false,
});
const [redoStack, setRedoStack] = createSignal<UpdateRegionsEvent[]>([], {
  equals: false,
});

let lastModified = Date.now();

// @ts-ignore
window.localforage = localforage;

export const dispatch = (event: Event) => {
  switch (event.type) {
    case "reset": {
      syncStorage().then(() => {
        setUndoStack([]);
        setRedoStack([]);
        setStore(defaultState);
      });
      break;
    }
    case "setClip": {
      setUndoStack([]);
      setRedoStack([]);
      setStore("clip", event.clip);

      localforage.getItem("sessions").then((result) => {
        const sessions = result as Map<string, Session>;
        const session = sessions.get(event.clip.hash)

        if (session) {
          loadSession(session)
        } else {
          sessions.set(event.clip.hash, {
            alias: event.clip.name,
            hash: event.clip.hash,
            lastModified: Date.now(),
            numberOfChannels: event.clip.buffer.numberOfChannels,
            sampleRate: event.clip.buffer.sampleRate
          })

          localforage.setItem("sessions", sessions)
        }
      })

      // every time? what if we have them already?
      saveChannels(event.clip);
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
        lastMigration?.type === "moveSlice" &&
        event.index === lastMigration?.index &&
        Date.now() - lastModified < 1000
      ) {
        setUndoStack((prev) => {
          prev[prev.length - 1] = event;
          return prev;
        });
      } else {
        setUndoStack((prev) => {
          prev.push(event);
          return prev;
        });
      }

      setRedoStack([]);

      updateRegions(event);
    }
  }
};

const inverseOfEvent = (event: UpdateRegionsEvent): UpdateRegionsEvent => {
  switch (event.type) {
    case "slice": {
      return {
        type: "healSlice",
        index: event.index + 1,
      };
    }
    case "segmentRegion": {
      return {
        type: "combineRegions",
        startIndex: event.index,
        endIndex: event.index + event.pieces - 1,
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
        type: "segmentRegion",
        index: event.startIndex,
        pieces: event.endIndex - event.startIndex,
      };
    }
    case "healSlice": {
      return {
        type: "slice",
        index: event.index - 1,
        // @ts-ignore ?????
        pos: state.regions[event.index].start,
      };
    }
    case "moveSlice": {
      return {
        ...event,
        // @ts-ignore ?????
        pos: state.regions[event.index].start,
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

  lastModified = Date.now();
  debounce(syncStorage)();
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

const tabSyncChannel = new BroadcastChannel("tab-sync");
tabSyncChannel.addEventListener("message", (e: MessageEvent) => {
  if (!state.clip?.hash || e.data !== state.clip.hash) return;
  debounce(syncState, 1000)();
});

export const undo = {
  execute: () => {
    const eventToUndo = undoStack().pop();

    console.log(eventToUndo);

    setUndoStack((prev) => prev);

    if (eventToUndo) {
      setRedoStack((prev) => {
        prev.push(eventToUndo);
        return prev;
      });

      updateRegions(inverseOfEvent(eventToUndo));

      if (
        state.selectedRegion && state.selectedRegion >= state.regions.length
      ) {
        setStore("selectedRegion", state.regions.length - 1);
      }
    }

    debounce(syncStorage)();
    lastModified = Date.now();
  },
  disabled: () => undoStack().length === 0,
};

export const redo = {
  execute: () => {
    const eventToRedo = redoStack().pop();

    console.log(eventToRedo);

    setRedoStack((prev) => prev);

    if (eventToRedo) {
      updateRegions(eventToRedo);
      undoStack().push(eventToRedo);
      setUndoStack((prev) => prev);
    }
    debounce(syncStorage)();
    lastModified = Date.now();
  },
  disabled: () => redoStack().length === 0,
};

export const [busy, setBusy] = createSignal(false);

const syncState = async () => {
  setBusy(true);
  try {
    const clip = state.clip;
    if (!clip) return;
    const sessions = await localforage.getItem("sessions") as Map<
      string,
      Session
    >;
    const session = sessions.get(clip.hash);
    if (!session) return;
    if (session.lastModified <= lastModified) return;

    await loadSession(session);
    lastModified = session.lastModified;
  } finally {
    setBusy(false);
  }
};

// @ts-ignore
window.syncState = syncState;

export async function loadSession(session: Session) {
  const sampleRate = session.sampleRate;
  const numberOfChannels = session.numberOfChannels;
  const name = session.alias;

  // load clip if not yet loaded
  if (state.clip?.hash !== session.hash) {
    const left = await localforage.getItem(session.hash + "_0");
    const right = await localforage.getItem(session.hash + "_0");

    const channels = [left, right].filter(Boolean) as Float32Array[];

    const length = channels[0]?.length;
    if (!length) throw new Error("no channel data for " + session.hash);

    const buffer = audioContext.createBuffer(
      numberOfChannels,
      length,
      sampleRate,
    );

    for (let i = 0; i < numberOfChannels; i++) {
      const channel = await localforage.getItem(
        session.hash + "_" + i,
      ) as Float32Array;
      buffer.copyToChannel(channel, i);
    }

    setStore("clip", { name, buffer, hash: session.hash });
  }

  await localforage.getItem(session.hash + "_regions").then((arr) => {
    if (!Array.isArray(arr)) return;
    const regions = arr.map((r, i, a) => {
      return { start: r, end: a[i + 1] || 1 };
    });
    setStore("regions", regions);
  });

  setUndoStack(await localforage.getItem(session.hash + "_undoStack") || []);
  setRedoStack(await localforage.getItem(session.hash + "_redoStack") || []);
}

export type Session = {
  hash: string;
  alias: string;
  sampleRate: number;
  numberOfChannels: number;
  lastModified: number;
};

const syncStorage = async () => {
  // persist channels, clip metadata
  const clip = state.clip;

  if (!clip) return;

  // persist undo/redo
  await localforage.setItem(clip.hash + "_redoStack", redoStack());
  await localforage.setItem(clip.hash + "_undoStack", undoStack());

  // persist regions
  await localforage.setItem(
    clip.hash + "_regions",
    store.regions.map((r) => r.start),
  );

  await localforage.getItem("sessions").then((result) => {
    const sessions = result === null
      ? new Map<string, Session>()
      : result as Map<string, Session>;

    const session: Session = {
      hash: clip.hash,
      alias: clip.name,
      sampleRate: clip.buffer.sampleRate,
      numberOfChannels: clip.buffer.numberOfChannels,
      lastModified: lastModified,
    };
    sessions.set(clip.hash, session);

    localforage.setItem("sessions", sessions);
  });

  tabSyncChannel.postMessage(clip.hash);
};

const saveChannels = (clip: Clip) => {
  for (let i = 0; i < clip.buffer.numberOfChannels; i++) {
    localforage.setItem(
      clip.hash + "_" + i,
      clip.buffer.getChannelData(i),
    );
  }
};

// @ts-ignore
window.syncStorage = syncStorage;

// initialize sessions if necessary
if (await localforage.keys().then((keys) => !keys.includes("sessions"))) {
  localforage.setItem("sessions", new Map());
}
