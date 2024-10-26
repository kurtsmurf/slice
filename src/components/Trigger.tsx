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
      classList={{
        "trigger": true,
        "active": active(),
      }}
    >
      <span>
        <span
          style={{
            "font-family": "monospace",
            "font-size": "1rem",
          }}
        >
          {active() ? <StopIcon /> : <PlayIcon />}
        </span>
        <Show when={props.text}>&nbsp;</Show>
        {props.text}
      </span>
    </button>
  );
};

export const PlayIcon = () => (
  <svg
    height="1ch"
    viewBox="0 0 1 1"
  >
    <title>play</title>
    <polygon points="0,0 1,0.5 0,1" fill="currentColor" />
  </svg>
);

export const StopIcon = () => (
  <svg height="1ch" viewBox="0 0 1 1">
    <title>stop</title>
    <rect x="0" y="0" width="1" height="1" fill="currentColor" />
  </svg>
);
