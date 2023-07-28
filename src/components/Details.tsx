import { Clip } from "../types";
import { formatOf } from "../util/formatOf";

export const Details = (props: { clip: Clip; }) => (
  <div>
    <p>{props.clip.name}</p>
    <p>
      {((props.clip.buffer.length) /
        (props.clip.buffer.sampleRate)).toFixed(2)}s
    </p>
    <p>{formatOf(props.clip.buffer)}</p>
  </div>
);
