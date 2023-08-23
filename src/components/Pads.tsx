import { For } from "solid-js";
import { state } from "../store";
import { contentElement, scrollElement } from "./Waveform";
import { Trigger } from "./Trigger";

export const Pads = (props: { buffer: AudioBuffer }) => {
  return (
    <div
      style={{
        display: "grid",
        "grid-template-columns": "repeat( auto-fit, minmax(100px, 1fr) )",
        "grid-auto-rows": "100px",
      }}
    >
      <For each={state.regions}>
        {(region) => (
          <Trigger
            region={region}
            style={{ height: "100%", width: "100%" }}
            onTrigger={() => {
              if (scrollElement && contentElement) {
                scrollElement.scrollLeft =
                  region.start * contentElement.clientWidth -
                  scrollElement.clientWidth / 2;
              }
            }}
            text={region.start.toFixed(5)}
          />
        )}
      </For>
    </div>
  );
};
