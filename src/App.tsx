import { AudioInput } from "./AudioInput";
import { Clip } from "./types";
import { For, Show } from "solid-js";
import { player } from "./player";
import { dispatch, state } from "./signals";
import { contentElement, scrollElement, Waveform, zoom } from "./Waveform";

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
    <main
      style={{
        position: "sticky",
        top: 0,
        background: "white",
      }}
    >
      <Controls clip={state.clip!} />
      <Waveform buffer={state.clip!.buffer} />
    </main>
    <Pads buffer={state.clip!.buffer} />
  </Show>
);

const Controls = (props: { clip: Clip }) => (
  <div>
    <button
      onClick={() => {
        if (state.deleting) dispatch.stopDeleting();
        else dispatch.startDeleting();
      }}
    >
      {state.deleting ? "done deleting" : "delete"}
    </button>
    <button
      onClick={() => {
        if (state.editing) dispatch.stopEditing();
        else dispatch.startEditing();
      }}
    >
      {state.editing ? "done editing" : "edit"}
    </button>
    <button onClick={zoom.in} disabled={zoom.inDisabled()}>
      zoom in
    </button>
    <button onClick={zoom.out} disabled={zoom.outDisabled()}>
      zoom out
    </button>
    <button
      onClick={() => {
        if (player.playing()) {
          player.stop();
        } else {
          player.play(props.clip.buffer);
        }
      }}
    >
      {player.playing() ? "stop" : "play"}
    </button>
  </div>
);

const formatOf = (buffer: AudioBuffer) => {
  switch (buffer.numberOfChannels) {
    case (1):
      return "mono";
    case (2):
      return "stereo";
    default:
      return buffer.numberOfChannels + " channels";
  }
};

const Details = (props: { clip: Clip }) => (
  <div>
    <p>{props.clip.name}</p>
    <p>
      {((props.clip.buffer.length) /
        (props.clip.buffer.sampleRate)).toFixed(2)}s
    </p>
    <p>{formatOf(props.clip.buffer)}</p>
  </div>
);

const Pads = (props: { buffer: AudioBuffer }) => {
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
