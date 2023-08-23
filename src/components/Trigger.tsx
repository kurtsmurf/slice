import { createMemo, JSX } from "solid-js";
import { player } from "../player";
import { state } from "../store";

export const Trigger = (props: {
  region: { start: number; end: number };
  style?: JSX.CSSProperties;
  text?: string;
  onTrigger?: () => void;
}) => {
  const active = createMemo(() =>
    player.playing() &&
    JSON.stringify(player.region()) === JSON.stringify(props.region)
  );

  return (
    <button
      onClick={() => {
        if (active()) {
          player.stop();
        } else {
          player.play(state.clip!.buffer, props.region);
          props.onTrigger?.();
        }
      }}
      ondblclick={(e) => e.stopPropagation()}
      style={props.style}
    >
      <span
        style={{
          display: "inline-block",
          width: "1.2em",
        }}
      >
        {active() ? <>&#9632;</> : <>&#9654;</>}
      </span>
      {props.text}
    </button>
  );
};
