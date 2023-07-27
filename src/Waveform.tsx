import { createMemo, createSignal, For, JSX, Show, splitProps } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { player } from "./player";
import { dispatch, state } from "./signals";
import { ChannelSegment } from "./ChannelSegment";
import { useAnimationFrame } from "./useAnimationFrame";
import { sortedIndex } from "./sortedIndex";
import { createDrag } from "./createDrag";

const TILE_WIDTH = 400;
const TILE_HEIGHT = 100;

// the scrollable element
export let scrollElement: HTMLDivElement | undefined;
// the content wrapper
export let contentElement: HTMLDivElement | undefined;

export const zoom = (function createZoom() {
  const min = 1, max = Math.pow(2, 10);
  const [samplesPerPixel, setSamplesPerPixel] = createSignal(32);
  const factor = 2;

  const zoom = (direction: "in" | "out") => {
    if (!scrollElement) {
      return;
    }
    const currentCenter = scrollElement.scrollLeft +
      scrollElement.clientWidth / 2;
    const nextCenter = direction === "in"
      ? currentCenter * factor
      : currentCenter / factor;

    setSamplesPerPixel((prev) =>
      direction === "in"
        ? Math.max(min, prev / factor)
        : Math.min(max, prev * factor)
    );
    scrollElement.scrollLeft = nextCenter - scrollElement.clientWidth / 2;
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
  <div
    ref={scrollElement}
    data-scroll-element
    style={{ overflow: "auto" }}
  >
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

  const placeCursor = (e: MouseEvent) => {
    if (!contentElement) {
      return;
    }
    const contentRect = contentElement.getBoundingClientRect();
    const offsetPx = e.clientX - contentRect.left;
    dispatch.setCursor(offsetPx / contentElement.clientWidth);
    dispatch.showCursorControls();
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
        // @ts-ignore
        "container-type": "inline-size",
      }}
      ondblclick={placeCursor}
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
      <For each={state.regions}>
        {(region, index) => (
          <Slice
            pos={region.start}
            index={index()}
            id={region.start.toString()}
          />
        )}
      </For>
      <Cursor />
      <Playhead />
    </div>
  );
};

const Triggers = (props: { buffer: AudioBuffer }) => {
  const cursorRegion = createMemo(() =>
    state.regions[sortedIndex(state.regions.map((r) => r.start), state.cursor)]
      ?.start || 1
  );

  return (
    <div
      style={{
        width: `${props.buffer.length / zoom.samplesPerPixel()}px`,
        // @ts-ignore
        "container-type": "inline-size",
        height: "var(--min-btn-dimension",
      }}
    >
      <For each={state.regions}>
        {(region, index) => (
          <div
            style={{
              position: "absolute",
              transform: `translateX(${region.start * 100}cqi)`,
              height: "100%",
              display: "flex",
            }}
          >
            <Show when={state.deleting}>
              <button
                onClick={() => {
                  dispatch.healSlice(index());
                }}
              >
                delete
              </button>
            </Show>
            <button
              style="flex-grow: 1;"
              onClick={() => {
                player.play(props.buffer, region);
              }}
              ondblclick={(e) => e.stopPropagation()}
            >
              &#9654; {region.start.toFixed(5)}
            </button>
          </div>
        )}
      </For>
      <Show
        when={state.cursorControlsVisible}
      >
        <div
          style={{
            position: "absolute",
            transform: `translateX(${state.cursor * 100}cqi)`,
            height: "100%",
            display: "flex",
          }}
        >
          <button
            onClick={() => {
              dispatch.slice(state.cursor);
              dispatch.hideCursorControls();
            }}
          >
            slice
          </button>
          <button
            onClick={() => {
              player.play(
                props.buffer,
                {
                  start: state.cursor,
                  end: cursorRegion(),
                },
              );
            }}
          >
            play
          </button>
        </div>
      </Show>
    </div>
  );
};

const Stick = (
  props: Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
    pos: number;
    width: number;
    background: string;
    opacity?: number;
  },
) => {
  const [, htmlAttrs] = splitProps(props, ["pos"]);

  return (
    <div
      {...htmlAttrs}
      style={{
        position: "absolute",
        top: 0,
        left: `${props.width / -2}px`,
        transform: `translateX(${props.pos * 100}cqi)`,
        width: `${props.width}px`,
        height: "100%",
        background: props.background,
        opacity: props.opacity,
      }}
    >
    </div>
  );
};

const Slice = (
  props: JSX.HTMLAttributes<HTMLDivElement> & {
    pos: number;
    index: number;
  },
) => {
  const preventDefault = (e: Event) => e.preventDefault();
  const drag = createDrag({
    onStart: () => {
      scrollElement?.addEventListener("touchmove", preventDefault);
    },
    onFinished: () => {
      dispatch.healSlice(props.index);
      dispatch.slice(dragPos());
      scrollElement?.removeEventListener("touchmove", preventDefault);
    },
  });

  const dragPos = () => {
    if (contentElement) {
      return props.pos + drag.offset() / contentElement.clientWidth;
    }
    return props.pos;
  };

  return (
    <>
      <Show when={state.editing}>
        <Stick
          pos={dragPos()}
          width={30}
          opacity={0.5}
          background="purple"
          onPointerDown={drag.start}
        >
        </Stick>
      </Show>
      <Stick
        pos={dragPos()}
        width={2}
        background="purple"
        opacity={0.75}
        onPointerDown={state.editing ? drag.start : undefined}
      >
      </Stick>
    </>
  );
};

const Cursor = () => (
  <div style={{ "pointer-events": "none" }}>
    <Stick
      pos={state.cursor}
      width={2}
      background="repeating-linear-gradient(orange 0px, orange 4px, transparent 4px, transparent 8px)"
    >
    </Stick>
  </div>
);

const Playhead = () => {
  return (
    <Show when={player.playing()}>
      <Stick
        pos={player.progress()}
        width={2}
        background="orange"
      >
      </Stick>
    </Show>
  );
};

const WaveformSummary = (props: { buffer: AudioBuffer }) => {
  let root: HTMLDivElement | undefined;

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

  const drag = createDrag({
    onStart: updateScrollPosition,
    onDrag: updateScrollPosition,
  });

  return (
    <div
      ref={root}
      data-summary-element
      style={{
        position: "sticky",
        left: "0",
        height: "50px",
        "touch-action": "none",
        // @ts-ignore
        "container-type": "inline-size",
      }}
      onPointerDown={drag.start}
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
      <For each={state.regions}>
        {({ start }) => (
          <Stick
            pos={start}
            background="purple"
            opacity={0.75}
            width={2}
          >
          </Stick>
        )}
      </For>
      <PositionIndicator />
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
