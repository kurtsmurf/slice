import { AudioInput } from "./AudioInput";
import { Clip } from "./types";
import { createSignal, For, onMount, Show } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 100;
const SAMPLES_PER_PX = 100;

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
  let root: HTMLDivElement | undefined;

  const tileManager = createVirtualizer({
    count: range(0, props.clip.buffer.length / SAMPLES_PER_PX, CANVAS_WIDTH).length,
    getScrollElement: () => root,
    estimateSize: () => CANVAS_WIDTH,
    horizontal: true,
  });

  return (
    <div ref={root} style={{ overflow: "auto" }}>
      <div
        style={{
          width: `${props.clip.buffer.length / SAMPLES_PER_PX}px`,
          display: "flex",
          position: "relative",
          "overflow": "hidden",
          height: props.clip.buffer.numberOfChannels * CANVAS_HEIGHT + "px",
        }}
      >
        <For each={tileManager.getVirtualItems()}>
          {(virtualItem) => (
            <WaveformTile
              clip={props.clip}
              start={virtualItem.start}
              length={CANVAS_WIDTH}
            />
          )}
        </For>
      </div>
    </div>
  );
};

const WaveformTile = (
  props: { start: number; length: number; clip: Clip },
) => (
  <div
    style={{
      display: "flex",
      "flex-direction": "column",
      position: "absolute",
      top: 0,
      left: 0,
      transform: `translateX(${props.start}px)`,
      width: CANVAS_WIDTH + "px",
    }}
  >
    <For each={range(0, props.clip.buffer.numberOfChannels)}>
      {(channelNumber) => (
        <ChannelSegment
          start={props.start * SAMPLES_PER_PX}
          length={props.length * SAMPLES_PER_PX}
          channelData={props.clip.buffer.getChannelData(channelNumber)}
        />
      )}
    </For>
  </div>
);

const ChannelSegment = (
  props: { start: number; length: number; channelData: Float32Array },
) => {
  let canvas: HTMLCanvasElement | undefined;

  onMount(() => {
    if (!canvas) return;
    if (SAMPLES_PER_PX <= 1) {
      drawPath(canvas, props.channelData, props.start, props.length);
    } else {
      drawBars(canvas, props.channelData, props.start, props.length);
    }
  });

  return (
    <canvas ref={canvas} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}></canvas>
  );
};

// util

const range = (start: number, end: number, step = 1) =>
  [...new Array(Math.ceil((end - start) / step))].map((_, i) => i * step);

const drawBars = (canvas: HTMLCanvasElement, channelData: Float32Array, start: number, length: number) => {
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
  context.setLineDash([]);
  context.closePath();

  // draw waveform
  let bucket: number[] = [];
  context.lineWidth = 1.5;

  for (let i = 0; i < length; i++) {
    bucket.push(channelData[i + start])
    if (bucket.length === SAMPLES_PER_PX) {
      const min = Math.min(...bucket) * (canvas.height / 2)
      const max = Math.max(...bucket) * (canvas.height / 2)
      bucket = [];
      // draw line from window min to window max
      // along the y axis
      // at x = i
      context.beginPath()
      context.moveTo(i / SAMPLES_PER_PX, max + 1)
      context.lineTo(i / SAMPLES_PER_PX, min - 1)
      context.stroke();
    }
  }
}

const drawPath = (canvas: HTMLCanvasElement, channelData: Float32Array, start: number, length: number) => {
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
  context.setLineDash([]);
  context.closePath();

  // draw waveform
  context.beginPath();
  context.lineWidth = 2;
  const overlap = 5;
  for (let i = -overlap; i < length + overlap; i++) {
    context.lineTo(i / SAMPLES_PER_PX, channelData[start + i] * canvas.height / 2);
  }
  context.stroke();
  context.closePath();
}