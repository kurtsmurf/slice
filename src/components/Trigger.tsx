import { createMemo, JSX, Show, splitProps } from "solid-js";
import { player, Region } from "../player";
import { same, state } from "../store";

export const Trigger = (props: {
  region: Region | undefined;
  text?: string;
  onTrigger?: () => void;
  style?: JSX.CSSProperties;
}) => {
  const active = createMemo(() =>
    props.region &&
    player.playing() &&
    same(player.region(), props.region)
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
      disabled={!props.region}
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
