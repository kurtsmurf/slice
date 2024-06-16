import { player } from "../player";
import { dispatch } from "../store";
import { Clip } from "../types";
import { formatOfAudioBuffer } from "../util/formatOf";

export const Details = (props: { clip: Clip }) => (
  <div
    style={{
      display: "flex",
      "align-items": "center",
      "word-break": "break-word",
    }}
  >
    <button
      onClick={() => {
        if (confirm("leave session?")) {
          dispatch({ type: "reset" });
          player.stop();
        }
      }}
      style={{
        "flex-shrink": 0,
      }}
    >
      home
    </button>
    <div
      style={{
        display: "flex",
        "flex-wrap": "wrap",
        gap: "1ch",
        "padding": "1ch",
        "margin-inline-start": "auto",
      }}
    >
      <p>{props.clip.name}</p>
      <p>
        {((props.clip.buffer.length) /
          (props.clip.buffer.sampleRate)).toFixed(2)}s
      </p>
      <p>
        {formatOfAudioBuffer(props.clip.buffer)}
      </p>
    </div>
  </div>
);
