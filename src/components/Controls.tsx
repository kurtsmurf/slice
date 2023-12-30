import { dispatch, state } from "../store";
import { zoom } from "./Waveform";
import "./Controls.css";

export const Controls = () => (
  <div class="controls">
    <button
      onClick={() => {
        const dialog = document.getElementById("settings-dialog");
        console.log(dialog);
        if (dialog instanceof HTMLDialogElement) {
          dialog.showModal();
        }
      }}
    >
      FX
    </button>
    <fieldset
      onChange={(e) => {
        // @ts-ignore
        switch (e.target.value) {
          case "slice":
            return dispatch.setMode("slice");
          case "edit":
            return dispatch.setMode("edit");
          case "delete":
            return dispatch.setMode("delete");
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
