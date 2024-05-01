import { AudioInput } from "./AudioInput";
import { createSignal, For, JSX, onCleanup, onMount, Show } from "solid-js";
import { mapLinearToLogarithmic, player } from "../player";
import { download, share } from "../export";
import {
  busy,
  deleteSessions,
  dispatch,
  loadSession,
  Session,
  setBusy,
  state,
} from "../store";
import {
  contentElement,
  scrollElement,
  setZoomCenter,
  Waveform,
} from "./Waveform";
import { Controls } from "./Controls";
import { Details } from "./Details";
import { Trigger } from "./Trigger";
import "./style.css";
import { audioContext } from "../audioContext";
import { Clip } from "../types";
import { Curtain } from "./Curtain";
import localforage from "localforage";
import { formatOfChannels } from "../util/formatOf";
import debounce from "lodash.debounce";

const hashHex = async (inputBuffer: BufferSource) => {
  const hashBuffer = await crypto.subtle.digest("SHA-256", inputBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const hashAudioBuffer = (buffer: AudioBuffer) => {
  const channelsCombined = new Float32Array(
    buffer.length * buffer.numberOfChannels,
  );

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channelsCombined.set(buffer.getChannelData(i), i * buffer.length);
  }

  return hashHex(channelsCombined);
};

const clipOfFile = async (file: File): Promise<Clip> => {
  const buffer = await audioContext.decodeAudioData(
    await arrayBufferOfFile(file),
  );
  const hash = await hashAudioBuffer(buffer);

  return {
    name: file.name,
    buffer,
    hash,
  };
};

const arrayBufferOfFile = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = (e) => {
      if (!(e.target?.result instanceof ArrayBuffer)) {
        reject();
        return;
      }
      resolve(e.target.result);
    };
    reader.readAsArrayBuffer(file);
  });

const LoadAudio = () => {
  return (
    <div
      style={{
        "padding-inline": "1rem",
        display: "flex",
        "flex-direction": "column",
        "gap": "1rem",
        "align-items": "flex-start",
      }}
    >
      <h2>import audio</h2>
      <AudioInput
        onChange={async (file) => {
          setBusy(true);
          const clip = await clipOfFile(file)
            .catch((err) => {
              console.error(err);
              alert("failed to load audio");
              setBusy(false);
            });

          if (!clip) return;

          setBusy(false);

          dispatch({ type: "setClip", clip });
        }}
      />
      <UrlInput />
    </div>
  );
};

const Sessions = () => {
  const [sessions, setSessions] = createSignal<Session[] | undefined>();

  const tabSyncChannel = new BroadcastChannel("tab-sync");

  onCleanup(() => {
    tabSyncChannel.close();
  });

  const syncState = () => {
    localforage.getItem("sessions").then((sessionsMap) => {
      if (!sessionsMap) return;
      setSessions(
        [...(sessionsMap as Map<string, Session>).values()].sort((a, b) =>
          b.lastModified - a.lastModified
        ),
      );
    });
  };

  // read latest sessions from storage on every tab sync message
  tabSyncChannel.addEventListener("message", debounce(syncState, 1000));
  syncState();

  const length = () => sessions()?.length || 0;

  return (
    <div
      style={{
        "padding-inline": "1rem",
        "display": "flex",
        "flex-direction": "column",
        "gap": "1rem",
        "align-items": "flex-start",
      }}
    >
      <h2>sessions</h2>
      <Show
        when={sessions()}
        // fallback={() => <p>loading...</p>}
      >
        <For
          each={sessions()}
        >
          {(session) => (
            <div>
              <h3
                style={{ "line-break": "anywhere" }}
              >
                {session.alias}
              </h3>
              <p>{formatOfChannels(session.numberOfChannels)}</p>
              <p>{(session.length / session.sampleRate).toFixed(2)}s</p>
              <p>
                last modified {new Date(session.lastModified).toLocaleString()}
              </p>
              <button
                onClick={async () => {
                  setBusy(true);
                  await loadSession(session);
                  setBusy(false);
                }}
                aria-label={`open session ${session.alias}`}
              >
                open
              </button>
            </div>
          )}
        </For>
      </Show>
      <Show when={length()}>
        <button
          onClick={async () => {
            if (confirm("delete sessions permanently?")) {
              setBusy(true);
              await deleteSessions();
              setBusy(false);
              setSessions();
            }
          }}
        >
          delete sessions
        </button>
      </Show>
    </div>
  );
};

const UrlInput = () => {
  let input: HTMLInputElement | undefined;

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const url = urlParams.get("url");
    if (url && input) input.value = url;
  });

  return (
    <form
      style={{
        display: "flex",
        gap: "1ch",
        "align-items": "center",
        "flex-wrap": "wrap",
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (e.currentTarget.checkValidity() && input) {
          setBusy(true);
          const url = input.value;

          const buffer = await audioBufferOfUrl(url)
            .catch((err) => {
              console.error(err);
              alert("failed to load audio");
              setBusy(false);
            });

          if (!buffer) return;

          const name = nameOfUrl(url);
          const hash = await hashAudioBuffer(buffer);

          dispatch({ type: "setClip", clip: { name, buffer, hash } });
          setBusy(false);
        }
      }}
    >
      <button type="submit" aria-label="import audio from url">from url</button>
      <label for="url-input">
        url:
      </label>
      <input ref={input} type="url" id="url-input" name="url" required />
    </form>
  );
};

const nameOfUrl = (url: string) => url.slice(url.lastIndexOf("/") + 1);

const audioBufferOfUrl = (url: string) => {
  return fetch(url)
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer));
};

export const App = () => (
  <>
    <Show
      when={state.clip}
      fallback={() => (
        <div
          style={{
            display: "flex",
            "flex-direction": "column",
            "gap": "1rem",
            "padding-block": "1rem",
          }}
        >
          <LoadAudio />
          <Sessions />
        </div>
      )}
    >
      <div>
        <Details clip={state.clip!} />
        <Controls />
        <Waveform buffer={state.clip!.buffer} />
      </div>
      <BottomPanel />
      <FloatingControls />
      <SettingsDialog />
    </Show>
    <Show when={busy()}>
      <Curtain />
    </Show>
  </>
);

const SettingsDialog = () => {
  let dialog: HTMLDialogElement | undefined;

  return (
    <dialog
      id="settings-dialog"
      ref={dialog}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickWasOutside = e.x < rect.x || e.y < rect.y ||
          e.x > rect.x + rect.width || e.y > rect.y + rect.height;
        if (e.target === dialog && clickWasOutside) dialog?.close();
      }}
      style={{
        "max-height": "unset",
        "max-width": "100vw",
        "box-sizing": "border-box",
        height: "100vh",
        border: "none",
        "border-right": "2px solid",
      }}
    >
      <SettingsForm />
    </dialog>
  );
};

const SettingsForm = () => (
  <div>
    <button
      onClick={() => {
        const dialog = document.getElementById("settings-dialog");
        if (dialog instanceof HTMLDialogElement) dialog.close();
      }}
      style={{
        "align-self": "flex-start",
      }}
      aria-label="close playback settings"
    >
      close
    </button>
    <div>
      <fieldset>
        <legend>speed/pitch</legend>
        <RangeInput
          value={player.settings.pitchOffsetSemis}
          onInput={(e) => {
            player.updateSettings(
              "pitchOffsetSemis",
              parseFloat(e.currentTarget.value),
            );
          }}
          label="coarse"
          aria-label="speed/pitch coarse"
          id="speed-semis"
          min={-12}
          max={12}
          sign={true}
          unit="semis"
        />
        <RangeInput
          value={player.settings.pitchOffsetCents}
          onInput={(e) => {
            player.updateSettings(
              "pitchOffsetCents",
              parseFloat(e.currentTarget.value),
            );
          }}
          label="fine"
          aria-label="speed/pitch fine"
          id="speed-cents"
          min={-50}
          max={50}
          sign={true}
          unit="cents"
        />
      </fieldset>
    </div>
    <div>
      <fieldset>
        <legend>filter</legend>
        <RangeInput
          value={player.settings.loPass}
          transformDisplay={(x) => Math.floor(mapLinearToLogarithmic(x))}
          onInput={(e) => {
            const value = parseFloat(e.currentTarget.value);
            player.updateSettings("loPass", value);
            // nudge hiPass
            if (value < player.settings.hiPass) {
              player.updateSettings("hiPass", value);
            }
          }}
          label="low pass"
          aria-label="low pass filter"
          id="filter-low-pass"
          min={0}
          max={100}
          unit={"hz"}
        />
        <RangeInput
          value={player.settings.hiPass}
          transformDisplay={(x) => Math.floor(mapLinearToLogarithmic(x))}
          onInput={(e) => {
            const value = parseFloat(e.currentTarget.value);
            player.updateSettings("hiPass", value);
            // nudge loPass
            if (value > player.settings.loPass) {
              player.updateSettings("loPass", value);
            }
          }}
          label="high pass"
          aria-label="high pass filter"
          id="filter-high-pass"
          min={0}
          max={100}
          unit={"hz"}
        />
      </fieldset>
    </div>
    <div>
      <fieldset>
        <legend>compression</legend>
        <RangeInput
          value={player.settings.compressionThreshold}
          onInput={(e) => {
            player.updateSettings(
              "compressionThreshold",
              parseFloat(e.currentTarget.value),
            );
          }}
          label="threshold"
          aria-label="compression threshold"
          id="compression-threshold"
          min={-30}
          max={0}
          sign={true}
          unit={"dB"}
        />
      </fieldset>
    </div>
    <RangeInput
      value={player.settings.gain}
      onInput={(e) => {
        player.updateSettings("gain", parseFloat(e.currentTarget.value));
      }}
      label="gain"
      id="gain"
      min={-20}
      max={20}
      sign={true}
      unit={"dB"}
    />
  </div>
);

const RangeInput = (
  props: {
    min: number;
    max: number;
    value: number;
    onInput: JSX.EventHandlerUnion<HTMLInputElement, InputEvent>;
    id: string;
    label: string;
    "aria-label"?: string;
    transformDisplay?: (x: number) => number;
    sign?: boolean;
    unit?: string;
  },
) => {
  const display = () => {
    const transformedValue = props.transformDisplay
      ? props.transformDisplay(props.value)
      : props.value;
    const blah = props.sign
      ? `${props.value >= 0 ? "+" : "-"}${Math.abs(transformedValue)}`
      : transformedValue;

    return blah + (props.unit || "");
  };

  return (
    <div
      style={{
        width: "100%",
      }}
    >
      <p style={{ display: "flex", "font-family": "monospace" }}>
        <label for={props.id}>{props.label}</label>
        <span style={{ "margin-inline-start": "auto" }}>
          <span>
            {display()}
          </span>
        </span>
      </p>
      <input
        style={{ width: "100%" }}
        value={props.value}
        type="range"
        name={props.id}
        id={props.id}
        min={props.min}
        max={props.max}
        onInput={props.onInput}
        aria-label={props["aria-label"] || props.label}
      />
    </div>
  );
};

export const Pads = () => {
  return (
    <div
      style={{
        display: "grid",
        "grid-template-columns": "repeat( auto-fit, minmax(100px, 1fr) )",
        "grid-auto-rows": "100px",
        // compensate for hovering buttons
        "padding-bottom": "calc(var(--min-btn-dimension) * 2)",
        gap: "2px",
      }}
    >
      <For each={state.regions}>
        {(region, index) => (
          <div
            style="display: grid; position: relative;"
            id={`region-${index()}`}
          >
            <Trigger
              region={region}
              style={{
                height: "100%",
                width: "100%",
                "z-index": 0,
                "text-align": "start",
              }}
              onTrigger={() => {
                setZoomCenter(region.start);
                if (scrollElement && contentElement) {
                  scrollElement.scrollLeft =
                    region.start * contentElement.clientWidth -
                    scrollElement.clientWidth / 2;
                }
              }}
              text={(index() + 1).toString()}
            />
            <button
              data-details-link
              style={{
                position: "absolute",
                right: 0,
              }}
              onClick={() => {
                dispatch({ type: "selectRegion", index: index() });

                const region = state.regions[index()];
                if (!region) return;
                setZoomCenter(region.start);
                const focusTarget = document.querySelector(
                  "#region-details button",
                );
                if (focusTarget instanceof HTMLElement) focusTarget.focus();
                scrollRegionIntoView(region);
              }}
            >
              <svg
                viewBox="0 0 5 5"
                style={{
                  width: "10px",
                }}
                fill="currentColor"
              >
                <title>region {index() + 1} details</title>
                <rect stroke="none" x="0" y="2" width="1" height="1" />
                <rect stroke="none" x="2" y="2" width="1" height="1" />
                <rect stroke="none" x="4" y="2" width="1" height="1" />
              </svg>
            </button>
          </div>
        )}
      </For>
    </div>
  );
};

const RegionDetails = (props: { index: number }) => {
  const next = () => {
    const next = props.index + 1;
    const region = state.regions[next];
    if (!region) return;

    if (next < state.regions.length) {
      dispatch({ type: "selectRegion", index: next });
      setZoomCenter(region.start);
      scrollRegionIntoView(region);
    }
  };

  const prev = () => {
    const prev = props.index - 1;
    if (prev > -1) {
      dispatch({ type: "selectRegion", index: prev });
      const region = state.regions[prev];
      if (!region) return;

      setZoomCenter(region.start);
      scrollRegionIntoView(region);
    }
  };

  return (
    <>
      <div
        id="region-details"
        style={{
          display: "flex",
          "flex-direction": "column",
          gap: "1rem",
        }}
        onkeydown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            next();
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            prev();
          }
        }}
      >
        <div
          id="region-details-header"
          style={{
            display: "flex",
            "align-items": "center",
            position: "sticky",
            top: 0,
            background: "Canvas",
            "z-index": 1,
          }}
        >
          <button
            onClick={() => {
              const index = props.index;

              dispatch({ type: "selectRegion", index: undefined });
              // return focus to region details button
              const detailsBtn = document.querySelector(
                `#region-${index} [data-details-link]`,
              );
              if (detailsBtn instanceof HTMLElement) detailsBtn.focus();
            }}
          >
            back
          </button>
          <h2
            style={{ "margin-inline": "1rem", "margin-inline-start": "auto" }}
            aria-live="polite"
          >
            {props.index + 1}
          </h2>
          <div
            id="region-details-footer"
            style={{ display: "flex", "justify-content": "center", gap: "2px" }}
          >
            <button
              style={{ "font-size": "1rem" }}
              disabled={props.index === 0}
              onClick={prev}
              aria-label={"previous region"}
            >
              {"‹"}
            </button>
            <button
              style={{ "font-size": "1rem" }}
              disabled={props.index === state.regions.length - 1}
              onClick={next}
              aria-label={"next region"}
            >
              {"›"}
            </button>
          </div>
        </div>
        <div
          id="region-details-body"
          style={{
            display: "flex",
            "flex-wrap": "wrap",
            gap: "1rem",
            "margin-inline": "1rem",
            // compensate for hovering buttons
            "padding-bottom": "calc(var(--min-btn-dimension) * 2)",
          }}
        >
          <fieldset id="region-details-playback">
            <legend>playback</legend>
            <Trigger region={state.regions[props.index]} />
            <button
              onClick={() => {
                if (!state.clip) return;
                const region = state.regions[props.index];
                if (region) player.play(state.clip.buffer, region);
              }}
              aria-label="replay"
            >
              <span
                style={{
                  display: "grid",
                  "place-content": "center",
                }}
              >
                <svg
                  viewBox="0 0 1 1"
                  style={{
                    "font-size": "1rem",
                    "font-family": "monospace",
                    height: "1ch",
                  }}
                >
                  <polygon points="0.3,0.5 1,1 1,0" fill="currentColor" />
                  <rect
                    x="0"
                    y="0"
                    width="0.25"
                    height="1"
                    fill="currentColor"
                  />
                </svg>
              </span>
            </button>
          </fieldset>
          <fieldset>
            <legend>export</legend>
            <button
              onClick={async () => {
                const buffer = state.clip?.buffer;
                const region = state.regions[props.index];
                if (buffer && region) {
                  setBusy(true);
                  await download(
                    buffer,
                    region,
                    player.settings,
                  ).catch();
                  setBusy(false);
                }
              }}
            >
              download
            </button>
            <Show when={!!navigator.share}>
              <button
                onClick={async () => {
                  const buffer = state.clip?.buffer;
                  const region = state.regions[props.index];
                  if (buffer && region) {
                    setBusy(true);
                    await share(
                      buffer,
                      region,
                      player.settings,
                    ).catch();
                    setBusy(false);
                  }
                }}
              >
                share
              </button>
            </Show>
          </fieldset>
          <SegmentRegionForm index={props.index} />
        </div>
      </div>
    </>
  );
};

const SegmentRegionForm = (props: { index: number }) => {
  let input: HTMLInputElement | undefined;

  if (!state.clip) return;

  const duration = () => {
    const region = state.regions[props.index];
    if (!state.clip || !region) return 0;
    return (region.end - region.start) * state.clip.buffer.duration;
  };

  const max = () => {
    return Math.min(Math.floor(duration() / 0.01), 256);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (e.currentTarget.checkValidity() && input) {
          dispatch({
            type: "segmentRegion",
            index: props.index,
            pieces: parseInt(input.value),
          });
        }
      }}
    >
      <fieldset disabled={max() < 2}>
        <legend>segment region</legend>

        <label for="number-of-pieces-input">
          pieces:
        </label>
        <input
          ref={input}
          type="number"
          name="number of pieces"
          id="number-of-pieces-input"
          min={2}
          max={max()}
          required
          pattern="[0-9]*"
        />

        <button type="submit">
          chop
        </button>
      </fieldset>
    </form>
  );
};

const BottomPanel = () => (
  <div id="bottom-panel">
    <Show when={state.selectedRegion !== undefined} fallback={Pads}>
      <RegionDetails index={state.selectedRegion!} />
    </Show>
  </div>
);

const scrollRegionIntoView = (region: typeof state.regions[number]) => {
  if (scrollElement && contentElement) {
    scrollElement.scrollLeft = region.start * contentElement.clientWidth -
      scrollElement.clientWidth / 2;
  }
};

const FloatingControls = () => (
  <div
    class="floating-controls"
    // style={{
    //   position: "fixed",
    //   bottom: "0",
    //   left: "0",
    //   "min-width": "unset",
    //   "z-index": 2,
    //   // "border-radius": "2px",
    //   display: "flex",
    // }}
    style={{
      position: "fixed",
      bottom: "calc(var(--min-btn-dimension) * .25)",
      left: "calc(var(--min-btn-dimension) * .25)",
      "min-width": "unset",
      "z-index": 2,
      display: "flex",
      gap: "calc(var(--min-btn-dimension) * .25)",
    }}
  >
    <ToggleFxDialog />
    <ToggleLoop />
  </div>
);

const ToggleFxDialog = () => (
  <fieldset
    style={{
      width: "calc(var(--min-btn-dimension) * 1.25)",
      background: "canvas",
      padding: "0",
    }}
  >
    <button
      style={{
        width: "100%",
        height: "100%",
      }}
      onClick={() => {
        const dialog = document.getElementById("settings-dialog");
        if (dialog instanceof HTMLDialogElement) {
          dialog.showModal();
        }
      }}
      aria-label="open playback settings"
    >
      FX
    </button>
  </fieldset>
);

const ToggleLoop = () => (
  <fieldset
    style={{
      width: "calc(var(--min-btn-dimension) * 1.25)",
      height: "calc(var(--min-btn-dimension) * 1.25)",
    }}
  >
    <label for="loop-toggle">
      <span>loop</span>
      <input
        type="checkbox"
        id="loop-toggle"
        name="loop"
        checked={player.settings.loop}
        disabled={player.playing()}
        onChange={(e) => {
          // @ts-ignore
          player.updateSettings("loop", e.target.checked);
        }}
      />
    </label>
  </fieldset>
);
