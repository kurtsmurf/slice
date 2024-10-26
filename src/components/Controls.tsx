import { dispatch, redo, state, undo } from "../store";
import { zoom } from "./Waveform";

export const Controls = () => (
  <div class="controls-outer">
    <div class="controls">
      <fieldset>
        <button onClick={() => undo.execute()} disabled={undo.disabled()}>
          undo
        </button>
        <button onClick={() => redo.execute()} disabled={redo.disabled()}>
          redo
        </button>
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
        <div class="radio-item">
          <input
            type="radio"
            id="slice"
            value="slice"
            checked={state.mode === "slice"}
          />
          <label for="slice">slice</label>
        </div>
        <div class="radio-item">
          <input
            type="radio"
            id="edit"
            value="edit"
            checked={state.mode === "edit"}
          />
          <label for="edit">edit</label>
        </div>
        <div class="radio-item">
          <input
            type="radio"
            id="delete"
            value="delete"
            checked={state.mode === "delete"}
          />
          <label for="delete">delete</label>
        </div>
      </fieldset>
      <fieldset>
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
      </fieldset>
    </div>
  </div>
);
