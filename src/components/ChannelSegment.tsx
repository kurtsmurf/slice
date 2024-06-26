import { Bucket } from "../types";
import { createEffect, createSignal, JSX, onCleanup } from "solid-js";
import workerpool from "workerpool";

const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

const [strokeColor, setStrokeColor] = createSignal<"black" | "white">(
  mediaQuery.matches ? "white" : "black",
);

// Register event listener
mediaQuery.addEventListener("change", (e) => {
  if (e.matches) {
    setStrokeColor("white");
  } else {
    setStrokeColor("black");
  }
});

export const ChannelSegment = (
  props: {
    data: Float32Array;
    width: number;
    height: number;
    numBuckets: number;
    style?: JSX.CSSProperties;
  },
) => {
  let canvas: HTMLCanvasElement | undefined;
  let workerTask: workerpool.Promise<void | Bucket[]> | undefined;

  onCleanup(() => {
    workerTask?.cancel();
  });

  createEffect(async () => {
    const color = strokeColor();
    workerTask?.cancel();
    workerTask = pool
      .exec(computeBuckets, [props.data, props.numBuckets])
      .then((buckets: Bucket[]) => {
        if (canvas) {
          drawBars(canvas, buckets, color);
        }
      })
      .catch((e) => {
        if (e.message !== "promise cancelled") {
          console.error(e);
        }
      });
  });

  return (
    <canvas
      ref={canvas}
      width={props.width}
      height={props.height}
      style={{
        width: "100%",
        height: "100%",
        ...props.style,
      }}
    >
    </canvas>
  );
};

// Pool of workers for computing buckets
const pool = workerpool.pool();

function computeBuckets(data: Float32Array, numBuckets: number): Bucket[] {
  const bucketSize = Math.ceil(data.length / numBuckets);
  const buckets = [];
  let startIndex = 0;

  for (let i = 0; i < numBuckets; i++) {
    const endIndex = startIndex + bucketSize;
    const bucket = data.subarray(startIndex, endIndex);

    let min = Infinity;
    for (const item of bucket) {
      min = Math.min(item, min);
    }
    let max = -Infinity;
    for (const item of bucket) {
      max = Math.max(item, max);
    }

    buckets.push({ min, max });
    startIndex = endIndex;
  }

  return buckets;
}

const drawBars = (
  canvas: HTMLCanvasElement,
  buckets: Bucket[],
  color: "black" | "white" = "black",
) => {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const LINE_WIDTH = 2;
  context.lineWidth = LINE_WIDTH;
  context.strokeStyle = color;
  context.clearRect(0, 0, canvas.width, canvas.height);

  // shift origin
  context.translate(0, canvas.height / 2);

  // draw buckets as vertical lines
  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    if (!bucket) return;
    const { min, max } = bucket;
    context.beginPath();
    context.moveTo(i, max * (canvas.height / 2) + LINE_WIDTH / 2);
    context.lineTo(i, min * (canvas.height / 2) - LINE_WIDTH / 2);
    context.stroke();
  }

  // shift origin back
  context.translate(0, -canvas.height / 2);
};
