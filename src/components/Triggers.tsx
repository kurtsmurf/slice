import { createMemo, For, Show } from "solid-js";
import { player } from "../player";
import { dispatch, state } from "../store";
import { sortedIndex } from "../util/sortedIndex";
import { zoom } from "./Waveform";

export const Triggers = (props: { buffer: AudioBuffer }) => {

  return (
    <div
      style={{
        width: `${props.buffer.length / zoom.samplesPerPixel()}px`,
        // @ts-ignore
        "container-type": "inline-size",
        height: "var(--min-btn-dimension",
      }}
    >
      {/* region controls */}
      <For each={state.regions}>
        {(region, index) => (
          <div
            style={{
              position: "absolute",
              transform: `translateX(${region.start * 100}cqi)`,
              height: "100%",
              display: "flex",
            }}
            onKeyDown={
              console.log
            }
          >
            <Show when={state.deleting}>
              <button
                onClick={() => {
                  dispatch.healSlice(index());
                }}
              >
                delete
              </button>
            </Show>
            <button
              style="flex-grow: 1;"
              onClick={() => {
                player.play(props.buffer, region);
              }}
              ondblclick={(e) => e.stopPropagation()}
            >
              &#9654; {region.start.toFixed(5)}
            </button>
          </div>
        )}
      </For>
      {/* cursor controls */}

    </div>
  );
};
