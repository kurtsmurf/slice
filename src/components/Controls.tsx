import { Clip } from "../types";
import { dispatch, state } from "../store";
import { zoom } from "./Waveform";

export const Controls = (props: { clip: Clip }) => (
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
    <button
      onClick={() => {
        zoom.in();
        // document.getElementById("cursor-thumb")?.scrollIntoView({
        //   inline: "center",
        //   block: "nearest",
        // });
      }}
      disabled={zoom.inDisabled()}
    >
      zoom in
    </button>
    <button
      onClick={() => {
        zoom.out();
        // document.getElementById("cursor-thumb")?.scrollIntoView({
        //   inline: "center",
        //   block: "nearest",
        // });
      }}
      disabled={zoom.outDisabled()}
    >
      zoom out
    </button>
  </div>
);
