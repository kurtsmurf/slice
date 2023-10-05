import { AudioInput } from "./AudioInput";
import { createSignal, For, Show } from "solid-js";
import { player } from "../player";
import { dispatch, state } from "../store";
import { contentElement, scrollElement, Waveform } from "./Waveform";
import { Controls } from "./Controls";
import { Details } from "./Details";
import { Trigger } from "./Trigger";

export const App = () => (
  <Show
    when={state.clip}
    fallback={<AudioInput onChange={dispatch.setClip} />}
  >
    <button
      onClick={() => {
        if (confirm("Are you sure?")) {
          dispatch.reset();
          player.stop();
        }
      }}
    >
      clear
    </button>
    <Details clip={state.clip!} />
    <div
      style={{
        position: "sticky",
        top: 0,
        background: "white",
      }}
    >
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
          <div style="display: grid; position: relative;">
                      <Trigger
            region={region}
            style={{
              height: "100%",
              width: "100%",
              display: "flex",
              "align-items": "end",
              "padding": "0.5rem",
              "z-index": 0
            }}
            onTrigger={() => {
              if (scrollElement && contentElement) {
                scrollElement.scrollLeft =
                  region.start * contentElement.clientWidth -
                  scrollElement.clientWidth / 2;
              }
            }}
            text={region.start.toFixed(5)}
          />
          <button
              data-details
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


const RegionDetails = (props: { region: number }) => {
  return (
    <>
      <div id="region-details">
        {props.region}
        <button
          onClick={() => {
            const index = props.region;
            setSelectedRegion(undefined);
            // return focus to region details button
            const detailsBtn = document.querySelector(
              `#region-row-${index} [data-details]`,
            );
            if (detailsBtn instanceof HTMLElement) detailsBtn.focus();
          }}
        >
          back
        </button>
        <Trigger region={state.regions[props.region]} />
      </div>
      <div>
        <button
          disabled={props.region === 0}
          onClick={() => {
            const prev = props.region - 1;
            setSelectedRegion(prev);
            scrollRegionIntoView(state.regions[prev]);
          }}
        >
          prev
        </button>
        <button
          disabled={props.region === state.regions.length - 1}
          onClick={() => {
            const next = props.region + 1;
            setSelectedRegion(next);
            scrollRegionIntoView(state.regions[next]);
          }}
        >
          next
        </button>
      </div>
    </>
  );
};

const [selectedRegion, setSelectedRegion] = createSignal<number | undefined>(
  undefined,
);

const BottomPanel = () => (
  <>
    <Show when={selectedRegion() !== undefined} fallback={Pads}>
      <RegionDetails region={selectedRegion()!} />
    </Show>
  </>
);

const Regions = () => {
  return (
    <div
      style={{
        padding: "1rem",
      }}
    >
      <For each={state.regions}>
        {(region, index) => (
          <div
            id={`region-row-${index()}`}
            style={{ display: "flex", gap: "1rem", "align-items": "center" }}
          >
            <span>{index()}</span>
            <Trigger
              region={region}
              onTrigger={() => {
                scrollRegionIntoView(region);
              }}
            />
          </div>
        )}
      </For>
    </div>
  );
};

const scrollRegionIntoView = (region: typeof state.regions[number]) => {
  if (scrollElement && contentElement) {
    scrollElement.scrollLeft = region.start * contentElement.clientWidth -
      scrollElement.clientWidth / 2;
  }
};
