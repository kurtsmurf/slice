import { AudioInput } from "./AudioInput";
import { Clip } from "./types";
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
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

// the scrollable element
let scrollRoot: HTMLDivElement | undefined;

// the content wrapper
let contentRoot: HTMLDivElement | undefined;

// Pool of workers for computing buckets
const pool = workerpool.pool();

// TODO: consolidate zoom functions
const zoomIn = () => {
  const currentSpx = spx();
  const nextSpx = Math.max(1, currentSpx / 2);
  if (currentSpx === nextSpx) return;
  setSpx(nextSpx);

  const currentScrollLeft = scrollRoot?.scrollLeft || 0;
  const nextScrollLeft = currentScrollLeft * 2;
  if (scrollRoot) scrollRoot.scrollLeft = nextScrollLeft;
};
const zoomOut = () => {
  const currentSpx = spx();
  const nextSpx = Math.min(512, currentSpx * 2);
  if (currentSpx === nextSpx) return;
  setSpx(nextSpx);

  const currentScrollLeft = scrollRoot?.scrollLeft || 0;
  const nextScrollLeft = currentScrollLeft / 2;
  if (scrollRoot) scrollRoot.scrollLeft = nextScrollLeft;
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
      <WaveformSummary clip={clip()!} />
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
  // @ts-ignore
  const tileManager = createVirtualizer(() => ({
    count: range(0, props.clip.buffer.length / spx(), CANVAS_WIDTH).length,
    getScrollElement: () => scrollRoot,
    estimateSize: () => CANVAS_WIDTH,
    horizontal: true,
  }));

  return (
    <div ref={scrollRoot} style={{ overflow: "auto" }}>
      <div
        ref={contentRoot}
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

const WaveformSummary = (props: { clip: Clip }) => {
  const PositionIndicator = () => {
    let animationFrame: number;
    const [left, setLeft] = createSignal(0);
    const [width, setWidth] = createSignal(0);

    const tick = () => {
      if (scrollRoot && contentRoot && root) {
        setLeft(
          scrollRoot.scrollLeft / contentRoot.clientWidth * root.clientWidth,
        );
        setWidth(
          scrollRoot.clientWidth / contentRoot.clientWidth * root?.clientWidth,
        );
      }
      animationFrame = requestAnimationFrame(tick);
    };

    onMount(() => {
      animationFrame = requestAnimationFrame(tick);
    });

    onCleanup(() => {
      cancelAnimationFrame(animationFrame);
    });

    return (
      <div
        style={{
          position: "absolute",
          height: "50px",
          width: width() + "px",
          left: left() + "px",
          background: "#3333",
        }}
      >
      </div>
    );
  };

  let root: HTMLDivElement | undefined;

  return (
    <div
      ref={root}
      style={{
        position: "sticky",
        left: "0",
        height: "50px",
      }}
    >
      <PositionIndicator />
      <ChannelSegment
        // TODO: smoosh together all channels into single summary waveform
        data={props.clip.buffer.getChannelData(0)}
        width={800}
        height={50}
        numBuckets={800}
      />
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
      {(channelNumber) => {
        const data = props.clip.buffer.getChannelData(channelNumber)
          .slice(
            props.start * spx(),
            (props.start + props.length) * spx(),
          );
        return (
          <ChannelSegment
            data={data}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            numBuckets={data.length / spx()}
          />
        );
      }}
    </For>
  </div>
);

const ChannelSegment = (
  props: {
    data: Float32Array;
    width: number;
    height: number;
    numBuckets: number;
  },
) => {
  let canvas: HTMLCanvasElement | undefined;
  const [loading, setLoading] = createSignal(true);
  let workerTask: workerpool.Promise<void | Bucket[]> | undefined;

  onCleanup(() => {
    workerTask?.cancel();
  });

  createEffect(async () => {
    workerTask?.cancel();
    workerTask = pool
      .exec(computeBuckets, [props.data, props.numBuckets])
      .then((buckets: Bucket[]) => {
        if (!canvas) return;
        drawBars(canvas, buckets);
        setLoading(false);
      });
  });

  return (
    <canvas
      ref={canvas}
      width={props.width}
      height={props.height}
      style={{
        "background-color": loading() ? "transparent" : "white",
        width: "100%",
        height: "100%",
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
  canvas: HTMLCanvasElement,
  buckets: Bucket[],
) => {
  const context = canvas.getContext("2d");
  if (!context) return;

  const LINE_WIDTH = 2;
  context.lineWidth = LINE_WIDTH;
  context.clearRect(0, 0, canvas.width, canvas.height);

  // shift origin
  context.translate(0, canvas.height / 2);

  // draw buckets as vertical lines
  for (let i = 0; i < buckets.length; i++) {
    const { min, max } = buckets[i];
    context.beginPath();
    context.moveTo(i, max * (canvas.height / 2) + LINE_WIDTH / 2);
    context.lineTo(i, min * (canvas.height / 2) - LINE_WIDTH / 2);
    context.stroke();
  }

  // shift origin back
  context.translate(0, -canvas.height / 2);

};
