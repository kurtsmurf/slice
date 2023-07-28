import { For } from "solid-js";
import { player } from "../player";
import { state } from "../store";
import { contentElement, scrollElement } from "./Waveform";

export const Pads = (props: { buffer: AudioBuffer; }) => {
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
          <button
            style={{
              height: "100%",
              width: "100%",
            }}
            onClick={() => {
              player.play(props.buffer, region);
              if (scrollElement && contentElement) {
                scrollElement.scrollLeft =
                  region.start * contentElement.clientWidth -
                  scrollElement.clientWidth / 2;
              }
            }}
          >
            &#9654; {region.start.toFixed(5)}
          </button>
        )}
      </For>
    </div>
  );
};
