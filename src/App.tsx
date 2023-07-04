import { AudioInput } from "./AudioInput";
import { Clip } from "./types";
import { For, Show } from "solid-js";
import { player } from "./player";
import {
  clearFlags,
  clip,
  dropFlag,
  regions,
  setClip,
  setCursor,
} from "./signals";
import { contentElement, scrollElement, Waveform, zoom } from "./Waveform";

export const App = () => (
  <Show
    when={clip()}
    fallback={<AudioInput onChange={setClip} />}
  >
    <Controls clip={clip()!} />
    <Details clip={clip()!} />
    <Waveform buffer={clip()!.buffer} />
    <Regions buffer={clip()!.buffer} />
  </Show>
);

const Controls = (props: { clip: Clip }) => (
  <>
    <button
      onClick={() => {
        setClip(undefined);
        setCursor(0);
        clearFlags();
        player.stop();
      }}
    >
      clear
    </button>
    <button onClick={zoom.in} disabled={zoom.inDisabled()}>
      zoom in
    </button>
    <button onClick={zoom.out} disabled={zoom.outDisabled()}>
      zoom out
    </button>
    <button
      onClick={() => {
        if (player.playing()) {
          player.stop();
        } else {
          player.play(props.clip.buffer);
        }
      }}
    >
      {player.playing() ? "stop" : "play"}
    </button>
    <button
      onClick={dropFlag}
    >
      drop a flag
    </button>
  </>
);

const formatOf = (buffer: AudioBuffer) => {
  switch (buffer.numberOfChannels) {
    case (1):
      return "mono";
    case (2):
      return "stereo";
    default:
      return buffer.numberOfChannels + " channels";
  }
};

const Details = (props: { clip: Clip }) => (
  <>
    <p>{props.clip.name}</p>
    <p>
      {((props.clip.buffer.length || 0) /
        (props.clip.buffer.sampleRate || 1)).toFixed(2)}s
    </p>
    <p>{formatOf(props.clip.buffer)}</p>
  </>
);

const Regions = (props: { buffer: AudioBuffer }) => {
  return (
    <div style="
      display: grid;
      grid-template-columns: repeat( auto-fit, minmax(100px, 1fr) );
      grid-auto-rows: 100px;
    ">
      <For each={regions()}>
        {({ start, end }) => (
          <button
            style={{ height: "100%", width: "100%" }}
            onClick={() => {
              const startSeconds = props.buffer.duration * start;
              const endSeconds = props.buffer.duration * end;
              const durationSeconds = endSeconds - startSeconds;
              player.play(props.buffer, startSeconds, durationSeconds);
              if (scrollElement && contentElement) {
                scrollElement.scrollLeft = start * contentElement.clientWidth -
                  scrollElement.clientWidth / 2;
              }
            }}
          >
            &#9654; {start.toFixed(5)}
          </button>
        )}
      </For>
    </div>
  );
};
