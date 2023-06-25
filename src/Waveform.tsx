import {
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
import { player } from "./player";
import { cursor, flags, setCursor } from "./signals";
import { ChannelSegment } from "./ChannelSegment";

const TILE_WIDTH = 400;
const TILE_HEIGHT = 100;

// the scrollable element
let scrollElement: HTMLDivElement | undefined;
// the content wrapper
let contentElement: HTMLDivElement | undefined;

export const zoom = (function createZoom() {
  const min = 1, max = 1024;
  const [samplesPerPixel, setSamplesPerPixel] = createSignal(32);

  const zoom = (direction: "in" | "out") => {
    if (!scrollElement) {
      return;
    }
    const factor = 2;
    const currentSpx = samplesPerPixel();
    const currentScrollLeft = scrollElement.scrollLeft;

    setSamplesPerPixel(
      direction === "in"
        ? Math.max(min, currentSpx / factor)
        : Math.min(max, currentSpx * factor),
    );

    scrollElement.scrollLeft = direction === "in"
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

export const Waveform = (props: { buffer: AudioBuffer }) => (
  <div ref={scrollElement} data-scroll-element style={{ overflow: "auto" }}>
    <Triggers buffer={props.buffer} />
    <WaveformContent buffer={props.buffer} />
    <WaveformSummary buffer={props.buffer} />
  </div>
);

const WaveformContent = (props: { buffer: AudioBuffer }) => {
  // in TS createVirtualizer rejects function parameter
  // but it works
  // and it makes the virtualizer reactive to samples per pixel
  // @ts-ignore
  const tileManager = createVirtualizer(() => ({
    count: range(0, props.buffer.length / zoom.samplesPerPixel(), TILE_WIDTH)
      .length,
    getScrollElement: () => scrollElement,
    estimateSize: () => TILE_WIDTH,
    horizontal: true,
  }));

  const playFromPointer = (e: MouseEvent) => {
    if (!contentElement) {
      return;
    }
    const contentRect = contentElement.getBoundingClientRect();
    const offsetPx = e.clientX - contentRect.left;
    const offsetRatio = offsetPx / contentRect.width;
    const offsetSeconds = props.buffer.duration * offsetRatio;
    player.play(props.buffer, offsetSeconds);
    setCursor(offsetPx / contentElement.clientWidth);
  };

  return (
    <div
      ref={contentElement}
      data-content-element
      style={{
        width: `${props.buffer.length / zoom.samplesPerPixel()}px`,
        display: "flex",
        position: "relative",
        "overflow": "hidden",
        height: props.buffer.numberOfChannels * TILE_HEIGHT + "px",
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
            length={TILE_WIDTH}
          />
        )}
      </For>
      <For each={flags()}>
        {(position) => <Flag pos={position} />}
      </For>
      <Cursor />
      <Playhead />
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
      if (scrollElement && contentElement) {
        setLeft(
          scrollElement.scrollLeft / contentElement.clientWidth * 100,
        );
        setWidth(
          scrollElement.clientWidth / contentElement.clientWidth * 100,
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
    if (!root || !contentElement || !scrollElement) {
      return;
    }
    const rect = root.getBoundingClientRect();
    const offsetPx = e.clientX - rect.left;
    const offsetRatio = offsetPx / rect.width;

    scrollElement.scrollLeft =
      contentElement.getBoundingClientRect().width * offsetRatio -
      scrollElement.getBoundingClientRect().width / 2;
  };

  const startDrag: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = (
    e,
  ) => {
    updateScrollPosition(e);
    dragging = true;
  };

  const drag: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = (e) => {
    if (dragging) {
      updateScrollPosition(e);
    }
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
      width: TILE_WIDTH + "px",
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
            width={TILE_WIDTH}
            height={TILE_HEIGHT}
            numBuckets={data().length / zoom.samplesPerPixel()}
          />
        );
      }}
    </For>
  </div>
);

const range = (start: number, end: number, step = 1) =>
  [...new Array(Math.ceil((end - start) / step))].map((_, i) => i * step);

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
