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
  splitProps,
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

// the scrollable element
let scrollRoot: HTMLDivElement | undefined;
// the content wrapper
let contentRoot: HTMLDivElement | undefined;
// Pool of workers for computing buckets
const pool = workerpool.pool();

const [clip, setClip] = createSignal<Clip | undefined>();
const [flags, setFlags] = createSignal<number[]>([]);
const [cursor, setCursor] = createSignal<number>(0);

const zoom = (function createZoom() {
  const min = 1, max = 1024;
  const [samplesPerPixel, setSamplesPerPixel] = createSignal(32);

  const zoom = (direction: "in" | "out") => {
    if (!scrollRoot) return;
    const factor = 2;
    const currentSpx = samplesPerPixel();
    const currentScrollLeft = scrollRoot.scrollLeft;

    setSamplesPerPixel(
      direction === "in"
        ? Math.max(min, currentSpx / factor)
        : Math.min(max, currentSpx * factor),
    );

    scrollRoot.scrollLeft = direction === "in"
      ? currentScrollLeft * factor
      : currentScrollLeft / factor;
  };

  return {
    in: () => zoom("in"),
    out: () => zoom("out"),
    samplesPerPixel,
    inDisabled: () => samplesPerPixel() === min,
    outDisabled: () => samplesPerPixel() === max,
  };
})();

const player = (function createPlayer() {
  const ramp = 0.01;
  const [startedAt, setStartedAt] = createSignal<number | undefined>(undefined);
  const [startOffset, setStartOffset] = createSignal<number>(0);
  let sourceNode: AudioBufferSourceNode | undefined;
  let gainNode: GainNode | undefined;

  const play = (buffer: AudioBuffer, offset = 0) => {
    stop();
    setStartOffset(offset);
    setStartedAt(audioContext.currentTime);

    gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + ramp);

    const node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.connect(gainNode);
    node.onended = stop;
    node.start(0, offset);

    sourceNode = node;
  };

  const stop = () => {
    if (!sourceNode || !gainNode) return;

    const end = audioContext.currentTime + ramp;
    gainNode.gain.setValueAtTime(1, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, end);

    sourceNode.onended = null;
    sourceNode.stop(end);
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

// COMPONENTS ---------------------
// --------------------------------
// --------------------------------

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
        setFlags([]);
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
          // "alt: play from current cursor position"
          // const offsetSeconds = clip()!.buffer.duration * cursor();
          // player.play(clip()!.buffer, offsetSeconds);
          player.play(props.clip.buffer);
        }
      }}
    >
      {player.playing() ? "stop" : "play"}
    </button>
    <button
      onClick={() => {
        setFlags((prev) => {
          const i = sortedIndex(prev, cursor());
          if (prev[i] === cursor()) return prev;
          return [...prev.slice(0, i), cursor(), ...prev.slice(i)];
        });
      }}
    >
      drop a flag
    </button>
  </>
);

const Details = (props: { clip: Clip }) => (
  <>
    <p>{props.clip.name}</p>
    <p>{props.clip.buffer.numberOfChannels} channels</p>
    <p>
      {((props.clip.buffer.length || 0) /
        (props.clip.buffer.sampleRate || 1)).toFixed(2)} seconds
    </p>
    <p>{props.clip.buffer.length} samples</p>
    <p>{zoom.samplesPerPixel()} samples per pixel</p>
  </>
);

const Waveform = (props: { buffer: AudioBuffer }) => {
  // in TS createVirtualizer rejects function parameter
  // but it works
  // and it makes the virtualizer reactive to samples per pixel
  // @ts-ignore
  const tileManager = createVirtualizer(() => ({
    count: range(0, props.buffer.length / zoom.samplesPerPixel(), CANVAS_WIDTH)
      .length,
    getScrollElement: () => scrollRoot,
    estimateSize: () => CANVAS_WIDTH,
    horizontal: true,
  }));

  const playFromPointer = (e: MouseEvent) => {
    if (!contentRoot) return;
    const contentRect = contentRoot.getBoundingClientRect();
    const offsetPx = e.clientX - contentRect.left;
    const offsetRatio = offsetPx / contentRect.width;
    const offsetSeconds = props.buffer.duration * offsetRatio;
    player.play(props.buffer, offsetSeconds);
    setCursor(offsetPx / contentRoot.clientWidth);
  };

  return (
    <div ref={scrollRoot} style={{ overflow: "auto" }}>
      <Triggers buffer={props.buffer} />
      <div
        ref={contentRoot}
        style={{
          width: `${props.buffer.length / zoom.samplesPerPixel()}px`,
          display: "flex",
          position: "relative",
          "overflow": "hidden",
          height: props.buffer.numberOfChannels * CANVAS_HEIGHT + "px",
          // JSX.CSSProperties doesn't recognize container-type yet
          // @ts-ignore
          "container-type": "inline-size",
        }}
        ondblclick={playFromPointer}
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
          {(position) => <Flag pos={position} />}
        </For>
        <Cursor />
        <Playhead />
      </div>
      <WaveformSummary buffer={props.buffer} />
    </div>
  );
};

const Triggers = (props: { buffer: AudioBuffer }) => {
  return (
    <div
      style={{
        width: `${props.buffer.length / zoom.samplesPerPixel()}px`,
        // JSX.CSSProperties doesn't recognize container-type yet
        // @ts-ignore
        "container-type": "inline-size",
        height: "40px",
      }}
    >
      <For each={flags()}>
        {(position) => (
          <button
            style={{
              position: "absolute",
              transform: `translateX(${position * 100}cqi)`,
              height: "100%",
            }}
            onClick={() => {
              const offsetSeconds = props.buffer.duration * position;
              player.play(props.buffer, offsetSeconds);
            }}
            ondblclick={(e) => e.stopPropagation()}
          >
            &#9654; {position.toFixed(5)}
          </button>
        )}
      </For>
    </div>
  );
};

const useAnimationFrame = (callback: () => void) => {
  let animationFrame: number;

  const tick = () => {
    callback();
    animationFrame = requestAnimationFrame(tick);
  };

  onMount(() => {
    animationFrame = requestAnimationFrame(tick);
  });

  onCleanup(() => {
    cancelAnimationFrame(animationFrame);
  });
};

const Flag = (
  props: JSX.HTMLAttributes<HTMLDivElement> & {
    pos: number;
  },
) => {
  const [, htmlAttrs] = splitProps(props, ["pos"]);
  return (
    <div
      {...htmlAttrs}
      data-flag
      style={{
        position: "absolute",
        top: 0,
        left: "-1px",
        transform: `translateX(${props.pos * 100}cqi)`,
        width: "2px",
        height: "100%",
        background: "purple",
      }}
    >
      {props.children}
    </div>
  );
};

const Cursor = () => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: "-1px",
      transform: `translateX(${cursor() * 100}cqi)`,
      width: "2px",
      height: "100%",
      background: "orange",
      opacity: 0.5,
    }}
  >
  </div>
);

const Playhead = () => {
  const [left, setLeft] = createSignal(0);
  useAnimationFrame(() => setLeft(player.progress() * 100));

  return (
    <Show when={player.playing()}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "-1px",
          transform: `translateX(${left()}cqi)`,
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
    const [left, setLeft] = createSignal(0);
    const [width, setWidth] = createSignal(0);

    useAnimationFrame(() => {
      if (scrollRoot && contentRoot) {
        setLeft(
          scrollRoot.scrollLeft / contentRoot.clientWidth * 100,
        );
        setWidth(
          scrollRoot.clientWidth / contentRoot.clientWidth * 100,
        );
      }
    });

    return (
      <div
        style={{
          position: "absolute",
          height: "50px",
          width: `min(100cqi, max(${width()}cqi, 2px))`,
          left: left() + "cqi",
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
      <For each={flags()}>
        {(position) => <Flag pos={position}></Flag>}
      </For>
      <Cursor />
      <Playhead />
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
              props.start * zoom.samplesPerPixel(),
              (props.start + props.length) * zoom.samplesPerPixel(),
            )
        );
        return (
          <ChannelSegment
            data={data()}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            numBuckets={data().length / zoom.samplesPerPixel()}
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

const sortedIndex = (arr: number[], value: number) => {
  let low = 0;
  let high = arr.length;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid] < value) low = mid + 1;
    else if (arr[mid] > value) high = mid - 1;
    else return mid;
  }
  return low;
};
