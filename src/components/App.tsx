import { AudioInput } from "./AudioInput";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { download, player, share } from "../player";
import { dispatch, state } from "../store";
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

const LoadAudio = () => {
  let input: HTMLInputElement | undefined;

  return (
    <fieldset
      style={{
        "margin-inline": "1rem",
      }}
    >
      <legend>import audio</legend>
      <AudioInput onChange={dispatch.setClip} />
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
            const url = input.value;
            const response = await fetch(url);
            const buffer = await audioContext.decodeAudioData(
              await response.arrayBuffer(),
            );
            const name = url.slice(url.lastIndexOf("/") + 1);
            dispatch.setClip({ name, buffer });
          }
        }}
      >
        <button type="submit">from url</button>
        <label for="url">
          url:
        </label>
        <input ref={input} type="url" name="url" required />
      </form>
    </fieldset>
  );
};

export const App = () => (
  <Show
    when={state.clip}
    fallback={<LoadAudio />}
  >
    <div>
      <Details clip={state.clip!} />
      <Controls />
      <Waveform buffer={state.clip!.buffer} />
    </div>
    <BottomPanel />
  </Show>
);

export const Pads = () => {
  return (
    <div
      style={{
        display: "grid",
        "grid-template-columns": "repeat( auto-fit, minmax(100px, 1fr) )",
        "grid-auto-rows": "100px",
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
                dispatch.selectRegion(index());
                setZoomCenter(state.regions[index()].start);
                const focusTarget = document.querySelector(
                  "#region-details button",
                );
                if (focusTarget instanceof HTMLElement) focusTarget.focus();
                scrollRegionIntoView(state.regions[index()]);
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
    if (next < state.regions.length) {
      dispatch.selectRegion(next);
      setZoomCenter(state.regions[next].start);
      scrollRegionIntoView(state.regions[next]);
    }
  };

  const prev = () => {
    const prev = props.index - 1;
    if (prev > -1) {
      dispatch.selectRegion(prev);
      setZoomCenter(state.regions[prev].start);
      scrollRegionIntoView(state.regions[prev]);
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
          }}
        >
          <button
            onClick={() => {
              const index = props.index;
              dispatch.selectRegion(undefined);
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
              onClick={() => {
                const buffer = state.clip?.buffer;
                const region = state.regions[props.index];
                if (buffer && region) {
                  download(buffer, region);
                }
              }}
            >
              download
            </button>
            <Show when={!!navigator.share}>
              <button
                onClick={() => {
                  const buffer = state.clip?.buffer;
                  const region = state.regions[props.index];
                  if (buffer && region) {
                    share(buffer, region);
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

  const region = () => state.regions[props.index];

  const duration = () => {
    if (!state.clip) return 0;
    return (region().end - region().start) * state.clip.buffer.duration;
  };

  const max = () => {
    return Math.min(Math.floor(duration() / 0.01), 256);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (e.currentTarget.checkValidity() && input) {
          dispatch.segmentRegion(props.index, parseInt(input.value));
        }
      }}
    >
      <fieldset disabled={max() < 2}>
        <legend>segment region</legend>

        <label for="number of pieces">
          pieces:
        </label>
        <input
          ref={input}
          type="number"
          name="number of pieces"
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
