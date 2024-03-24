import { AudioInput } from "./AudioInput";
import { createSignal, For, JSX, onCleanup, Show } from "solid-js";
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
            <div
              style={{
                border: "1px solid",
                padding: "0.8rem",
                "border-radius": "2px",
              }}
            >
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
              await deleteSessions();
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

          const buffer = await fetch(url)
            .then((response) => response.arrayBuffer())
            .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
            .catch((err) => {
              console.error(err);
              alert("failed to load audio");
              setBusy(false);
            });

          if (!buffer) return;

          const name = url.slice(url.lastIndexOf("/") + 1);

          const hash = await hashAudioBuffer(buffer);

          dispatch({ type: "setClip", clip: { name, buffer, hash } });
          setBusy(false);
        }
      }}
    >
      <button type="submit">from url</button>
      <label for="url-input">
        url:
      </label>
      <input ref={input} type="url" id="url-input" name="url" required />
    </form>
  );
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
        "box-shadow": "0px 0px 10px",
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
    >
      X
    </button>
    <fieldset>
      <legend>speed/pitch</legend>
      <RangeInput
        value={player.pitchOffsetSemis()}
        onInput={(e) => {
          player.setPitchOffsetSemis(parseFloat(e.currentTarget.value));
        }}
        label="coarse"
        id="speed-semis"
        min={-12}
        max={12}
        sign={true}
        unit="semis"
      />
      <RangeInput
        value={player.pitchOffsetCents()}
        onInput={(e) => {
          player.setPitchOffsetCents(parseFloat(e.currentTarget.value));
        }}
        label="fine"
        id="speed-cents"
        min={-50}
        max={50}
        sign={true}
        unit="cents"
      />
    </fieldset>
    <fieldset>
      <legend>filter</legend>
      <RangeInput
        value={player.loPass()}
        transformDisplay={(x) => Math.floor(mapLinearToLogarithmic(x))}
        onInput={(e) => {
          player.setLoPass(parseFloat(e.currentTarget.value));
        }}
        label="low pass"
        id="filter-low-pass"
        min={0}
        max={100}
        unit={"hz"}
      />
      <RangeInput
        value={player.hiPass()}
        transformDisplay={(x) => Math.floor(mapLinearToLogarithmic(x))}
        onInput={(e) => {
          player.setHiPass(parseFloat(e.currentTarget.value));
        }}
        label="high pass"
        id="filter-high-pass"
        min={0}
        max={100}
        unit={"hz"}
      />
    </fieldset>
    <fieldset>
      <legend>compression</legend>
      <RangeInput
        value={player.compressionThreshold()}
        onInput={(e) => {
          player.setCompressionThreshold(parseFloat(e.currentTarget.value));
        }}
        label="threshold"
        id="compression-threshold"
        min={-30}
        max={0}
        sign={true}
        unit={"dB"}
      />
    </fieldset>
    <RangeInput
      value={player.gain()}
      onInput={(e) => {
        player.setGain(parseFloat(e.currentTarget.value));
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
    id: string;
    label: string;
    value: number;
    onInput: JSX.EventHandlerUnion<HTMLInputElement, InputEvent>;
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
              ...
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
          >
            {props.index + 1}
          </h2>
          <div
            id="region-details-footer"
            style={{ display: "flex", "justify-content": "center" }}
          >
            <button
              style={{ "font-size": "1rem" }}
              disabled={props.index === 0}
              onClick={prev}
            >
              {"‹"}
            </button>
            <button
              style={{ "font-size": "1rem" }}
              disabled={props.index === state.regions.length - 1}
              onClick={next}
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
          <fieldset
            id="region-details-playback"
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
            <legend>playback</legend>
            <Trigger region={state.regions[props.index]} />
            <button
              onClick={() => {
                if (!state.clip) return;
                player.play(state.clip.buffer, state.regions[props.index]);
              }}
            >
              spam
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
                    player.speed(),
                    player.loPass(),
                    player.hiPass(),
                    player.compressionThreshold(),
                    player.gain(),
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
                      player.speed(),
                      player.loPass(),
                      player.hiPass(),
                      player.compressionThreshold(),
                      player.gain(),
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
  <button
    style={{
      width: "calc(var(--min-btn-dimension) * 1.25)",
      height: "calc(var(--min-btn-dimension) * 1.25)",
    }}
    onClick={() => {
      const dialog = document.getElementById("settings-dialog");
      if (dialog instanceof HTMLDialogElement) {
        dialog.showModal();
      }
    }}
  >
    FX
  </button>
);

const ToggleLoop = () => (
  <label
    for="loop-toggle"
    style={{
      // background: "Canvas",
      width: "calc(var(--min-btn-dimension) * 1.25)",
      height: "calc(var(--min-btn-dimension) * 1.25)",
      // border: "1px solid",
    }}
  >
    <span>loop</span>
    <input
      type="checkbox"
      id="loop-toggle"
      name="loop"
      checked={player.loop()}
      disabled={player.playing()}
      onChange={(e) => {
        // @ts-ignore
        player.setLoop(e.target.checked);
      }}
    />
  </label>
);
