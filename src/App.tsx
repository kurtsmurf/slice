import { AudioInput } from "./AudioInput";
import { Clip } from "./types";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import workerpool from "workerpool";
import { audioContext } from "./audioContext";

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
const [samplesPerPixel, setSamplesPerPixel] = createSignal(32);


const [flags, setFlags] = createSignal<number[]>([]);



// the scrollable element
let scrollRoot: HTMLDivElement | undefined;

// the content wrapper
let contentRoot: HTMLDivElement | undefined;

// Pool of workers for computing buckets
const pool = workerpool.pool();

// TODO: consolidate zoom functions
const zoomIn = () => {
  const currentSpx = samplesPerPixel();
  const nextSpx = Math.max(1, currentSpx / 2);
  if (currentSpx === nextSpx) return;
  setSamplesPerPixel(nextSpx);

  const currentScrollLeft = scrollRoot?.scrollLeft || 0;
  const nextScrollLeft = currentScrollLeft * 2;
  if (scrollRoot) scrollRoot.scrollLeft = nextScrollLeft;
};
const zoomOut = () => {
  const currentSpx = samplesPerPixel();
  const nextSpx = Math.min(512, currentSpx * 2);
  if (currentSpx === nextSpx) return;
  setSamplesPerPixel(nextSpx);

  const currentScrollLeft = scrollRoot?.scrollLeft || 0;
  const nextScrollLeft = currentScrollLeft / 2;
  if (scrollRoot) scrollRoot.scrollLeft = nextScrollLeft;
};

const player = (function createPlayer() {
  const [startedAt, setStartedAt] = createSignal<number | undefined>(undefined);
  const [startOffset, setStartOffset] = createSignal<number>(0);
  let sourceNode: AudioBufferSourceNode | undefined;

  const play = (buffer: AudioBuffer, offset = 0) => {
    stop();
    setStartOffset(offset);
    const node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.connect(audioContext.destination);
    node.onended = stop;
    node.start(0, offset);

    setStartedAt(audioContext.currentTime);
    sourceNode = node;
  };

  const stop = () => {
    if (!sourceNode) return;
    sourceNode.onended = null;
    sourceNode.stop();
    sourceNode = undefined;
    setStartedAt(undefined);
  };

  const playing = () => startedAt() !== undefined;

  const progress = () => {
    const startedAt_ = startedAt();
    if (!startedAt_ || !sourceNode?.buffer) return 0;
    const timeSinceStart = audioContext.currentTime - startedAt_;
    const elapsed = timeSinceStart + startOffset();
    return elapsed / sourceNode.buffer.duration;
  };

  return { play, playing, stop, startedAt, progress };
})();

const [cursor, setCursor] = createSignal<number>(0);

// COMPONENTS ---------------------
// --------------------------------
// --------------------------------

export const App = () => {
  const [clip, setClip] = createSignal<Clip | undefined>();

  createEffect(() => {
    if (!clip()) stop();
  });

  return (
    <Show
      when={clip()}
      fallback={<AudioInput onChange={setClip} />}
    >
      <button
        onClick={() => {
          setClip(undefined);
          setCursor(0)
          player.stop();
        }}
      >
        clear
      </button>
      <button onClick={zoomOut} disabled={samplesPerPixel() === 512}>
        ZOOM OUT
      </button>
      <button onClick={zoomIn} disabled={samplesPerPixel() === 1}>
        ZOOM IN
      </button>
      <button
        onClick={() => {
          if (player.playing()) {
            player.stop();
          } else {
            player.play(clip()!.buffer);
          }
        }}
      >
        {player.playing() ? "stop" : "play"}
      </button>
      <button
        onClick={() => {
          console.log("drop a flag at", cursor());
          setFlags(prev => [...prev, cursor()])
        }}
      >
        drop a flag
      </button>
      <Details clip={clip()!} />
      <Waveform buffer={clip()!.buffer} />
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
    <p>{samplesPerPixel()} samples per pixel</p>
  </>
);

const Waveform = (props: { buffer: AudioBuffer }) => {
  // in TS createVirtualizer rejects function parameter
  // but it works
  // and it makes the virtualizer reactive to samples per pixel
  // @ts-ignore
  const tileManager = createVirtualizer(() => ({
    count:
      range(0, props.buffer.length / samplesPerPixel(), CANVAS_WIDTH).length,
    getScrollElement: () => scrollRoot,
    estimateSize: () => CANVAS_WIDTH,
    horizontal: true,
  }));

  return (
    <div ref={scrollRoot} style={{ overflow: "auto" }}>
      <div
        ref={contentRoot}
        style={{
          width: `${props.buffer.length / samplesPerPixel()}px`,
          display: "flex",
          position: "relative",
          "overflow": "hidden",
          height: props.buffer.numberOfChannels * CANVAS_HEIGHT + "px",
        }}
        ondblclick={(e) => {
          if (!contentRoot) return;
          const contentRect = contentRoot.getBoundingClientRect();
          const offsetPx = e.clientX - contentRect.left;
          const offsetRatio = offsetPx / contentRect.width;
          const offsetSeconds = props.buffer.duration * offsetRatio;
          player.play(props.buffer, offsetSeconds);
          setCursor(offsetPx / contentRoot.clientWidth);
        }}
      >
        <For each={tileManager.getVirtualItems()}>
          {(virtualItem) => (
            <WaveformTile
              buffer={props.buffer}
              start={virtualItem.start}
              length={CANVAS_WIDTH}
            />
          )}
        </For>
        <For each={flags()}>
            {(position) => <Blah parent={contentRoot} pos={position}></Blah>}
        </For>
        <Cursor parent={contentRoot}></Cursor>
        <Playhead parent={contentRoot} />
      </div>
      <WaveformSummary buffer={props.buffer} />
    </div>
  );
};

const Blah = (props: { parent: HTMLElement | undefined, pos: number }) => {

  return (
    <Show when={props.parent}>
      <div
        data-blah
        style={{
          position: "absolute",
          top: 0,
          left: "-1px",
          transform: `translateX(${props.pos * props.parent!.clientWidth}px)`,
          width: "2px",
          height: "100%",
          background: "purple"
        }}
      >
      </div>
    </Show>
  );
};

const Cursor = (props: { parent: HTMLElement | undefined }) => {
  let animationFrame: number;
  const [left, setLeft] = createSignal(0);

  const tick = () => {
    if (props.parent) setLeft(cursor() * props.parent.clientWidth);
    animationFrame = requestAnimationFrame(tick);
  };

  onMount(() => {
    animationFrame = requestAnimationFrame(tick);
  });

  onCleanup(() => {
    cancelAnimationFrame(animationFrame);
  });

  return (
    <Show when={props.parent}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "-1px",
          transform: `translateX(${left()}px)`,
          width: "0px",
          height: "100%",
          border: "1px dashed orange",
          "box-sizing": "border-box",
        }}
      >
      </div>
    </Show>
  );
};

const Playhead = (props: { parent: HTMLElement | undefined }) => {
  let animationFrame: number;
  const [left, setLeft] = createSignal(0);

  const tick = () => {
    if (props.parent) setLeft(player.progress() * props.parent.clientWidth);
    animationFrame = requestAnimationFrame(tick);
  };

  onMount(() => {
    animationFrame = requestAnimationFrame(tick);
  });

  onCleanup(() => {
    cancelAnimationFrame(animationFrame);
  });

  return (
    <Show when={player.playing() && props.parent}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "-1px",
          transform: `translateX(${left()}px)`,
          width: "2px",
          height: "100%",
          color: "orange",
          background: "currentColor",
        }}
      >
      </div>
    </Show>
  );
};

const WaveformSummary = (props: { buffer: AudioBuffer }) => {
  let root: HTMLDivElement | undefined;
  let dragging = false;

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
          Math.min(
            scrollRoot.clientWidth / contentRoot.clientWidth * root.clientWidth,
            root.clientWidth, // do not exceed container width
          ),
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
          width: Math.max(2, width()) + "px",
          left: left() + "px",
          background: "#8888",
        }}
      >
      </div>
    );
  };

  const updateScrollPosition = (e: PointerEvent) => {
    if (!root || !contentRoot || !scrollRoot) return;
    const rect = root.getBoundingClientRect();
    const offsetPx = e.clientX - rect.left;
    const offsetRatio = offsetPx / rect.width;

    scrollRoot.scrollLeft =
      contentRoot.getBoundingClientRect().width * offsetRatio -
      scrollRoot.getBoundingClientRect().width / 2;
  };

  const startDrag: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = (
    e,
  ) => {
    updateScrollPosition(e);
    dragging = true;
  };

  const drag: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = (e) => {
    if (dragging) updateScrollPosition(e);
  };

  const stopDrag: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = (e) => {
    dragging = false;
  };

  return (
    <div
      ref={root}
      style={{
        position: "sticky",
        left: "0",
        height: "50px",
        "touch-action": "none",
      }}
      onPointerDown={startDrag}
      onPointerMove={drag}
      onPointerUp={stopDrag}
      onPointerLeave={stopDrag}
      onPointerCancel={stopDrag}
    >
      <For each={range(0, props.buffer.numberOfChannels)}>
        {(channelNumber) => (
          <ChannelSegment
            data={props.buffer.getChannelData(channelNumber)}
            width={800}
            height={50}
            numBuckets={800}
            style={{
              position: "absolute",
            }}
          />
        )}
      </For>
      <PositionIndicator />
      <Cursor parent={root}></Cursor>
      <Playhead parent={root} />
    </div>
  );
};

const WaveformTile = (
  props: { start: number; length: number; buffer: AudioBuffer },
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
    <For each={range(0, props.buffer.numberOfChannels)}>
      {(channelNumber) => {
        const data = createMemo(() =>
          props.buffer.getChannelData(channelNumber)
            .slice(
              props.start * samplesPerPixel(),
              (props.start + props.length) * samplesPerPixel(),
            )
        );
        return (
          <ChannelSegment
            data={data()}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            numBuckets={data().length / samplesPerPixel()}
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
        if (canvas) drawBars(canvas, buckets);
      })
      .catch((e) => {
        if (e.message !== "promise cancelled") console.error(e);
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

// MISC----------------------------
// --------------------------------
// --------------------------------

const range = (start: number, end: number, step = 1) =>
  [...new Array(Math.ceil((end - start) / step))].map((_, i) => i * step);

function computeBuckets(data: Float32Array, numBuckets: number): Bucket[] {
  const min = (arr: Float32Array) => {
    let output = Infinity;
    for (const item of arr) {
      output = Math.min(item, output);
    }
    return output;
  };
  const max = (arr: Float32Array) => {
    let output = -Infinity;
    for (const item of arr) {
      output = Math.max(item, output);
    }
    return output;
  };
  const bucketSize = Math.ceil(data.length / numBuckets);
  const buckets = [];
  let startIndex = 0;

  for (let i = 0; i < numBuckets; i++) {
    const endIndex = startIndex + bucketSize;
    const bucket = data.subarray(startIndex, endIndex);
    buckets.push({ min: min(bucket), max: max(bucket) });
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
