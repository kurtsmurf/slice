import { dispatch, redo, state, undo } from "../store";
import { zoom } from "./Waveform";
import "./Controls.css";

export const Controls = () => (
  <div class="controls">
    <fieldset>
      <button onClick={() => undo()}>undo</button>
      <button onClick={() => redo()}>redo</button>
    </fieldset>
    <fieldset
      onChange={(e) => {
        // @ts-ignore
        switch (e.target.value) {
          case "slice":
            return dispatch({ type: "setMode", mode: "slice" });
          case "edit":
            return dispatch({ type: "setMode", mode: "edit" });
          case "delete":
            return dispatch({ type: "setMode", mode: "delete" });
        }
      }}
    >
      <legend>mode:</legend>

      <div>
        <input
          type="radio"
          id="slice"
          value="slice"
          checked={state.mode === "slice"}
        />
        <label for="slice">slice</label>
      </div>

      <div>
        <input
          type="radio"
          id="edit"
          value="edit"
          checked={state.mode === "edit"}
        />
        <label for="edit">edit</label>
      </div>

      <div>
        <input
          type="radio"
          id="delete"
          value="delete"
          checked={state.mode === "delete"}
        />
        <label for="delete">delete</label>
      </div>
    </fieldset>
    <button
      onClick={() => {
        zoom.in();
        document.getElementById("zoom-dot")?.scrollIntoView({
          inline: "center",
          block: "nearest",
        });
      }}
      disabled={zoom.inDisabled()}
    >
      zoom in
    </button>
    <button
      onClick={() => {
        zoom.out();
        document.getElementById("zoom-dot")?.scrollIntoView({
          inline: "center",
          block: "nearest",
        });
      }}
      disabled={zoom.outDisabled()}
    >
      zoom out
    </button>
  </div>
);
