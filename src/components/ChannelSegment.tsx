import { Bucket } from "../types";
import { createEffect, JSX, onCleanup } from "solid-js";
import workerpool from "workerpool";

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
    workerTask?.cancel();
    workerTask = pool
      .exec(computeBuckets, [props.data, props.numBuckets])
      .then((buckets: Bucket[]) => {
        if (canvas) {
          drawBars(canvas, buckets);
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
) => {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const LINE_WIDTH = 1;
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
