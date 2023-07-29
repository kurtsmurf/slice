import { AudioInput } from "./AudioInput";
import { Show } from "solid-js";
import { player } from "../player";
import { dispatch, state } from "../store";
import { Waveform } from "./Waveform";
import { Controls } from "./Controls";
import { Details } from "./Details";
import { Pads } from "./Pads";

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
    <Pads buffer={state.clip!.buffer} />
  </Show>
);
