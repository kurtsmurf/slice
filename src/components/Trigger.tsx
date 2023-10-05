import { createMemo, JSX, Show } from "solid-js";
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
      <span style={{ "font-size": "1rem"}}>
        <span
          style={{
            "font-family": "monospace",
          }}
        >
          {active() ? <>&#9632;</> : <>&#9654;</>}
        </span>
        <Show when={props.text}>&nbsp;</Show>
        {props.text}
      </span>
    </button>
  );
};
