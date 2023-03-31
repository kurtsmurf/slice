import { AudioInput } from "./AudioInput";
import { Clip } from "./types";
import { createSignal, For, onMount, Show } from "solid-js";

const CHUNK_SIZE = 200;

export const App = () => {
  const [clip, setClip] = createSignal<Clip | undefined>();

  return (
    <Show
      when={clip()}
      fallback={<AudioInput onChange={setClip} />}
    >
      <button onClick={() => setClip(undefined)}>clear</button>
      <Details clip={clip()!} />
      <Waveform clip={clip()!} />
    </Show>
  );
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
  </>
);

const Waveform = (props: { clip: Clip }) => {
  let scrollContainer: HTMLDivElement | undefined;
  let observer: IntersectionObserver;

  onMount(() => {
    observer = new IntersectionObserver(
      console.log,
      {
        root: scrollContainer,
        rootMargin: "0px",
        threshold: 0,
      }
    )
  })

  const WaveformChannel = (props: { channelData: Float32Array }) => {
    return (
      <div
        style={{
          width: `${props.channelData.length}px`,
          display: "flex",
          overflow: "hidden",
        }}
      >
        <For each={range(0, props.channelData.length, CHUNK_SIZE)}>
          {(start) => (
            <WaveformTile
              channelData={props.channelData}
              start={start}
              length={CHUNK_SIZE}
            />
          )}
        </For>
      </div>
    )
  }

  const WaveformTile = (
    props: { start: number; length: number; channelData: Float32Array },
  ) => {
    let canvas: HTMLCanvasElement | undefined;

    onMount(() => {
      observer.observe(canvas!)
    })

    onMount(() => {
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
  
      // shift origin
      context.translate(0, canvas.height / 2);
  
      // draw baseline
      context.beginPath();
      context.lineWidth = 1;
      context.setLineDash([2]);
      context.moveTo(0, 0);
      context.lineTo(canvas.width, 0);
      context.stroke();
      context.closePath();
  
      // draw waveform
      context.beginPath();
      context.setLineDash([]);
      context.lineWidth = 2;
      const overlap = 5;
      for (let i = -overlap; i < props.length + overlap; i++) {
        context.lineTo(i, props.channelData[props.start + i] * canvas.height / 2);
      }
      context.stroke();
      context.closePath();
    });
  
    return <canvas ref={canvas} width={props.length}></canvas>;
  };



  return (
    <div style={{ overflow: "auto" }} ref={scrollContainer}>
      <For each={range(0, props.clip.buffer.numberOfChannels)}>
        {(channelNumber) => (
          <WaveformChannel channelData={props.clip.buffer.getChannelData(channelNumber)} />
        )}
      </For>
    </div>
  );
};

// util

const range = (start: number, end: number, step = 1) =>
  [...new Array(Math.ceil((end - start) / step))].map((_, i) => i * step);
