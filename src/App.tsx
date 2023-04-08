import { AudioInput } from "./AudioInput";
import { Clip } from "./types";
import { createEffect, createSignal, For, Show } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 100;
// samples per pixel
const [spx, setSpx] = createSignal(1);
let root: HTMLDivElement | undefined;

// TODO: consolidate zoom functions
const zoomIn = () => {
  const currentSpx = spx();
  const nextSpx = Math.max(1, currentSpx / 2);
  if (currentSpx === nextSpx) return;
  setSpx(nextSpx);

  const currentScrollLeft = root?.scrollLeft || 0;
  const nextScrollLeft = currentScrollLeft * 2;
  if (root) root.scrollLeft = nextScrollLeft;
};
const zoomOut = () => {
  const currentSpx = spx();
  const nextSpx = Math.min(512, currentSpx * 2);
  if (currentSpx === nextSpx) return;
  setSpx(nextSpx);

  const currentScrollLeft = root?.scrollLeft || 0;
  const nextScrollLeft = currentScrollLeft / 2;
  if (root) root.scrollLeft = nextScrollLeft;
};

export const App = () => {
  const [clip, setClip] = createSignal<Clip | undefined>();

  return (
    <Show
      when={clip()}
      fallback={<AudioInput onChange={setClip} />}
    >
      <button onClick={() => setClip(undefined)}>clear</button>
      <button onClick={zoomOut}>ZOOM OUT</button>
      <button onClick={zoomIn}>ZOOM IN</button>
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
    <p>{spx()} samples per pixel</p>
  </>
);

const Waveform = (props: { clip: Clip }) => {
  const tileManager = createVirtualizer({
    count: range(0, props.clip.buffer.length / spx(), CANVAS_WIDTH).length,
    getScrollElement: () => root,
    estimateSize: () => CANVAS_WIDTH,
    horizontal: true,
  });

  return (
    <div ref={root} style={{ overflow: "auto" }}>
      <div
        style={{
          width: `${props.clip.buffer.length / spx()}px`,
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
          start={props.start * spx()}
          length={props.length * spx()}
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

  createEffect(() => {
    const context = canvas?.getContext("2d");
    if (!context) return;
    // TODO: drawBars async
    drawBars(context, props.channelData, props.start, props.length);
  });

  return (
    <canvas ref={canvas} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}></canvas>
  );
};

// util

const range = (start: number, end: number, step = 1) =>
  [...new Array(Math.ceil((end - start) / step))].map((_, i) => i * step);

const drawBars = (
  context: CanvasRenderingContext2D,
  channelData: Float32Array,
  start: number,
  length: number,
) => {
  const LINE_WIDTH = 2;
  context.lineWidth = LINE_WIDTH;

  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // shift origin
  context.translate(0, CANVAS_HEIGHT / 2);

  // draw waveform
  let bucket: number[] = [];
  for (let i = 0; i < length; i++) {
    bucket.push(channelData[i + start]);
    if (bucket.length === spx()) {
      const min = Math.min(...bucket) * (CANVAS_HEIGHT / 2);
      const max = Math.max(...bucket) * (CANVAS_HEIGHT / 2);
      bucket = [];
      // draw line from bucket min to bucket max
      // along the y axis
      // at x = i
      context.beginPath();
      context.moveTo(i / spx(), max + LINE_WIDTH / 2);
      context.lineTo(i / spx(), min - LINE_WIDTH / 2);
      context.stroke();
    }
  }

  // shift origin back
  context.translate(0, -CANVAS_HEIGHT / 2);
};
