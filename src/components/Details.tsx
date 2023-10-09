import { player } from "../player";
import { dispatch } from "../store";
import { Clip } from "../types";
import { formatOf } from "../util/formatOf";

export const Details = (props: { clip: Clip }) => (
  <div style={{ display: "flex", gap: "1rem", "align-items": "center" }}>
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
    <p style={{ "margin-inline-start": "auto" }}>{props.clip.name}</p>
    <p>
      {((props.clip.buffer.length) /
        (props.clip.buffer.sampleRate)).toFixed(2)}s
    </p>
    <p style={{ "padding-inline-end": "1rem" }}>
      {formatOf(props.clip.buffer)}
    </p>
  </div>
);
