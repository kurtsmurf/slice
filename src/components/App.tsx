import { AudioInput } from "./AudioInput";
import { createSignal, For, Show } from "solid-js";
import { download, player } from "../player";
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

export const App = () => (
  <Show
    when={state.clip}
    fallback={<AudioInput onChange={dispatch.setClip} />}
  >
    <div class="fixed-top">
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
          <button
            onClick={() => {
              const buffer = state.clip?.buffer;
              const region = state.regions[props.index];
              if (buffer && region) {
                download(buffer, region);
              }
            }}
          >
            {!!navigator.share ? "share" : "download"}
          </button>
        </div>
        <div
          id="region-details-playback"
          style={{
            "flex-grow": 1,
            display: "grid",
            "place-content": "center",
            gap: "1rem",
            "grid-auto-flow": "column",
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
          <Trigger region={state.regions[props.index]} />
          <button
            onClick={() => {
              if (!state.clip) return;
              player.play(state.clip.buffer, state.regions[props.index]);
            }}
          >
            spam
          </button>
        </div>
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
    </>
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
