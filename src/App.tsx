import { AudioInput } from "./AudioInput";
import { Clip } from "./types";
import { createEffect, createMemo, For, Show } from "solid-js";
import { player } from "./player";
import {
  clearFlags,
  clip,
  dropFlag,
  flags,
  setClip,
  setCursor,
} from "./signals";
import { Waveform, zoom } from "./Waveform";

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

const Regions = (props: { buffer: AudioBuffer }) => {
  const regions = () =>
    flags().map((flag, i, arr) => {
      const end = arr[i + 1] || 1;

      return { start: flag, end };
    });

  return (
    <div
      style={{
        // display: "flex",
      }}
    >
      <For each={regions()}>
        {(region) => (
          <div
            style={{ border: "1px solid" }}
            onClick={() => {
              const startSeconds = props.buffer.duration * region.start;
              const endSeconds = props.buffer.duration * region.end;
              const duration = endSeconds - startSeconds;
              player.play(props.buffer, startSeconds, duration);
            }}
          >
            <p>region.start: {region.start}</p>
            <p>region.end: {region.end}</p>
          </div>
        )}
      </For>
    </div>
  );
};

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

const Details = (props: { clip: Clip }) => (
  <>
    <p>{props.clip.name}</p>
    <p>{props.clip.buffer.numberOfChannels} channels</p>
    <p>
      {((props.clip.buffer.length || 0) /
        (props.clip.buffer.sampleRate || 1)).toFixed(2)} seconds
    </p>
    <p>{props.clip.buffer.length} samples</p>
    <p>{zoom.samplesPerPixel()} samples per pixel</p>
  </>
);
