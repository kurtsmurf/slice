import { AudioInput } from "./AudioInput";
import { createSignal, For, Show } from "solid-js";
import { player } from "../player";
import { dispatch, state } from "../store";
import { contentElement, scrollElement, Waveform } from "./Waveform";
import { Controls } from "./Controls";
import { Details } from "./Details";
import { Trigger } from "./Trigger";
import "./style.css";

export const App = () => (
  <Show
    when={state.clip}
    fallback={<AudioInput onChange={dispatch.setClip} />}
  >
    <div
      class="fixed-top"
  >
      <Details clip={state.clip!} />
      <Controls clip={state.clip!} />
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
          <div style="display: grid; position: relative;" id={`region-${index()}`}>
            <Trigger
              region={region}
              style={{
                height: "100%",
                width: "100%",
                display: "flex",
                "align-items": "end",
                "padding": "0.5rem",
                "z-index": 0,
              }}
              onTrigger={() => {
                if (scrollElement && contentElement) {
                  scrollElement.scrollLeft =
                    region.start * contentElement.clientWidth -
                    scrollElement.clientWidth / 2;
                }
              }}
              text={index().toString()}
            />
            <button
              data-details-link
              style={{
                position: "absolute",
                right: 0,
                background: "#0003",
                border: "none",
              }}
              onClick={() => {
                setSelectedRegion(index());
                const focusTarget = document.querySelector(
                  "#region-details button",
                );
                if (focusTarget instanceof HTMLElement) focusTarget.focus();
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
          style={{
            display: "flex",
            "align-items": "center",
          }}
        
        >
          <button
            onClick={() => {
              const index = props.index;
              setSelectedRegion(undefined);
              // return focus to region details button
              const detailsBtn = document.querySelector(
                `#region-${index} [data-details-link]`,
              );
              if (detailsBtn instanceof HTMLElement) detailsBtn.focus();
            }}
          >
            back
          </button>
          <h2 style={{ "margin-inline": "1rem", "margin-inline-start": "auto"}}>{props.index}</h2>
          <div style="margin-top: auto;">
        <button
          style={{ "font-size": "1rem"}}
          disabled={props.index === 0}
          onClick={() => {
            const prev = props.index - 1;
            setSelectedRegion(prev);
            scrollRegionIntoView(state.regions[prev]);
          }}
        >
          &#8249;
        </button>
        <button
          style={{ "font-size": "1rem"}}
          disabled={props.index === state.regions.length - 1}
          onClick={() => {
            const next = props.index + 1;
            setSelectedRegion(next);
            scrollRegionIntoView(state.regions[next]);
          }}
        >
          &#8250;
        </button>
      </div>
        </div>
        <div style={{ "flex-grow": 1, display: "grid", "place-content": "center"}}>
          <Trigger region={state.regions[props.index]} />
        </div>
      </div>
    </>
  );
};

const [selectedRegion, setSelectedRegion] = createSignal<number | undefined>(
  undefined,
);

const BottomPanel = () => (
    <div id="bottom-panel">
      <Show when={selectedRegion() !== undefined} fallback={Pads}>
        <RegionDetails index={selectedRegion()!} />
      </Show>
    </div>
);

const scrollRegionIntoView = (region: typeof state.regions[number]) => {
  if (scrollElement && contentElement) {
    scrollElement.scrollLeft = region.start * contentElement.clientWidth -
      scrollElement.clientWidth / 2;
  }
};
