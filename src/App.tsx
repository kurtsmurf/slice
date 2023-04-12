import { AudioInput } from "./AudioInput";
import { Clip } from "./types";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import workerpool from "workerpool";

// TYPES --------------------------
// --------------------------------
// --------------------------------

type Bucket = { min: number; max: number };

// GLOBALS ------------------------
// --------------------------------
// --------------------------------

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 100;

// samples per pixel
const [spx, setSpx] = createSignal(32);

// the root (scrollable) element
let root: HTMLDivElement | undefined;

// Pool of workers for computing buckets
const pool = workerpool.pool();

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

// COMPONENTS ---------------------
// --------------------------------
// --------------------------------

export const App = () => {
  const [clip, setClip] = createSignal<Clip | undefined>();

  return (
    <Show
      when={clip()}
      fallback={<AudioInput onChange={setClip} />}
    >
      <button onClick={() => setClip(undefined)}>clear</button>
      <button onClick={zoomOut} disabled={spx() === 512}>ZOOM OUT</button>
      <button onClick={zoomIn} disabled={spx() === 1}>ZOOM IN</button>
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
  // not sure if I'm supposed to be passing a function to createVirtualizer
  // TypeScript says not
  // but it seems to make things stay in sync better...
  // @ts-ignore
  const tileManager = createVirtualizer(() => ({
    count: range(0, props.clip.buffer.length / spx(), CANVAS_WIDTH).length,
    getScrollElement: () => root,
    estimateSize: () => CANVAS_WIDTH,
    horizontal: true,
  }));

  return (
    <div ref={root} style={{ overflow: "auto" }}>
      <div
        style={{
          width: `${props.clip.buffer.length / spx()}px`,
          display: "flex",
          position: "relative",
          "overflow": "hidden",
          height: props.clip.buffer.numberOfChannels * CANVAS_HEIGHT + "px",
          "background-image":
            "linear-gradient(to right, #fff 0%, #e0e0e0 50%, #fff 100%)",
          "background-size": "8000px 100%",
          "background-repeat": "repeat-x",
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
          data={props.clip.buffer.getChannelData(channelNumber)
            .slice(
              props.start * spx(),
              (props.start + props.length) * spx(),
            )}
        />
      )}
    </For>
  </div>
);

const ChannelSegment = (
  props: { data: Float32Array },
) => {
  let canvas: HTMLCanvasElement | undefined;
  const [loading, setLoading] = createSignal(true);
  let workerTask: workerpool.Promise<void | Bucket[]> | undefined;

  onCleanup(() => {
    workerTask?.cancel();
  });

  createEffect(async () => {
    workerTask?.cancel();
    const context = canvas?.getContext("2d");
    if (!context) return;
    workerTask = pool
      .exec(computeBuckets, [props.data, props.data.length / spx()])
      .then((buckets: Bucket[]) => {
        drawBars(context, buckets);
        setLoading(false);
      });
  });

  return (
    <canvas
      ref={canvas}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{
        "background-color": loading() ? "transparent" : "white",
      }}
    >
    </canvas>
  );
};

// MISC----------------------------
// --------------------------------
// --------------------------------

const range = (start: number, end: number, step = 1) =>
  [...new Array(Math.ceil((end - start) / step))].map((_, i) => i * step);

function computeBuckets(data: Float32Array, numBuckets: number): Bucket[] {
  const bucketSize = Math.ceil(data.length / numBuckets);
  const buckets = [];
  let startIndex = 0;

  for (let i = 0; i < numBuckets; i++) {
    const endIndex = startIndex + bucketSize;
    const bucket = data.subarray(startIndex, endIndex);
    const min = Math.min(...bucket);
    const max = Math.max(...bucket);
    buckets.push({ min, max });
    startIndex = endIndex;
  }

  return buckets;
}

const drawBars = (
  context: CanvasRenderingContext2D,
  buckets: Bucket[],
) => {
  const LINE_WIDTH = 2;
  context.lineWidth = LINE_WIDTH;

  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // shift origin
  context.translate(0, CANVAS_HEIGHT / 2);

  // draw buckets as vertical lines
  for (let i = 0; i < buckets.length; i++) {
    const { min, max } = buckets[i];
    context.beginPath();
    context.moveTo(i, max * (CANVAS_HEIGHT / 2) + LINE_WIDTH / 2);
    context.lineTo(i, min * (CANVAS_HEIGHT / 2) - LINE_WIDTH / 2);
    context.stroke();
  }

  // shift origin back
  context.translate(0, -CANVAS_HEIGHT / 2);
};
