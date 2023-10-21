import { createMemo, JSX, Show, splitProps } from "solid-js";
import { player } from "../player";
import { state } from "../store";

export const Trigger = (props: {
  region: { start: number; end: number };
  text?: string;
  onTrigger?: () => void;
  onFocus?: () => void;
  style?: JSX.CSSProperties;
}) => {
  const active = createMemo(() =>
    player.playing() &&
    JSON.stringify(player.region()) === JSON.stringify(props.region)
  );

  return (
    <button
      onFocus={props.onFocus}
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
      <span>
        <span
          style={{
            "font-family": "monospace",
            "font-size": "1rem",
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
