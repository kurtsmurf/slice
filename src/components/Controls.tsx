import { Clip } from "../types";
import { player } from "../player";
import { dispatch, state } from "../store";
import { zoom } from "./Waveform";

export const Controls = (props: { clip: Clip; }) => (
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
