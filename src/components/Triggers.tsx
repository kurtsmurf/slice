import { createMemo, For, Show } from "solid-js";
import { player } from "../player";
import { dispatch, state } from "../store";
import { sortedIndex } from "../util/sortedIndex";
import { zoom } from "./Waveform";

export const Triggers = (props: { buffer: AudioBuffer }) => {
  const cursorRegion = createMemo(() =>
    state.regions[sortedIndex(state.regions.map((r) => r.start), state.cursor)]
      ?.start || 1
  );

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
      <Show
        when={state.cursorControlsVisible}
      >
        <div
          style={{
            position: "absolute",
            transform: `translateX(${state.cursor * 100}cqi)`,
            height: "100%",
            display: "flex",
          }}
        >
          <button
            onClick={() => {
              dispatch.slice(state.cursor);
              dispatch.hideCursorControls();
            }}
          >
            slice
          </button>
          <button
            onClick={() => {
              player.play(
                props.buffer,
                {
                  start: state.cursor,
                  end: cursorRegion(),
                },
              );
            }}
          >
            play
          </button>
        </div>
      </Show>
    </div>
  );
};
