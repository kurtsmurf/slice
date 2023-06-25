import { AudioInput } from "./AudioInput";
import { Clip } from "./types";
import { Show } from "solid-js";
import { player } from "./player";
import { clip, cursor, setClip, setCursor, setFlags } from "./signals";
import { Waveform, zoom } from "./Waveform";

export const App = () => (
  <Show
    when={clip()}
    fallback={<AudioInput onChange={setClip} />}
  >
    <Controls clip={clip()!} />
    <Details clip={clip()!} />
    <Waveform buffer={clip()!.buffer} />
  </Show>
);

const Controls = (props: { clip: Clip }) => (
  <>
    <button
      onClick={() => {
        setClip(undefined);
        setCursor(0);
        setFlags([]);
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
      onClick={() => {
        setFlags((prev) => {
          const i = sortedIndex(prev, cursor());
          if (prev[i] === cursor()) return prev;
          return [...prev.slice(0, i), cursor(), ...prev.slice(i)];
        });
      }}
    >
      drop a flag
    </button>
  </>
);

const sortedIndex = (arr: number[], value: number) => {
  let low = 0;
  let high = arr.length;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid] < value) {
      low = mid + 1;
    } else if (arr[mid] > value) {
      high = mid - 1;
    } else {
      return mid;
    }
  }
  return low;
};

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
