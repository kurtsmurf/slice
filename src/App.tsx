import { AudioInput } from "./AudioInput";
import { Clip } from "./types";
import { Show } from "solid-js";
import { player } from "./player";
import { clearFlags, clip, dropFlag, setClip, setCursor } from "./signals";
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
