import { AudioInput } from "./AudioInput";
import { Clip } from "./types";
import { createEffect, createSignal, For, Show } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import * as Comlink from "comlink";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 100;
// samples per pixel
const [spx, setSpx] = createSignal(32);
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
          "background-size": "4000px 100%",
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

  createEffect(async () => {
    const context = canvas?.getContext("2d");
    if (!context) return;
    // TODO: drawBars async
    await drawBars(context, props.data);
    setLoading(false);
  });

  return (
    <canvas
      ref={canvas}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{
        "background-color": loading() ? "transparent" : "white",
        "transition-property": "background-color",
        "transition-duration": "0.5s",
      }}
    >
    </canvas>
  );
};

// util

const range = (start: number, end: number, step = 1) =>
  [...new Array(Math.ceil((end - start) / step))].map((_, i) => i * step);

const bucketMaster = Comlink.wrap(new Worker("src/worker.js"));

const drawBars = async (
  context: CanvasRenderingContext2D,
  data: Float32Array,
) => {
  const LINE_WIDTH = 2;
  context.lineWidth = LINE_WIDTH;

  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // shift origin
  context.translate(0, CANVAS_HEIGHT / 2);

  // @ts-ignore
  const buckets = await bucketMaster.computeBuckets(
    Comlink.transfer(data, [data.buffer]),
    data.length / spx(),
  );

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
