import { createMemo, createSignal, For, JSX, onMount, Show } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { player } from "../player";
import { dispatch, state } from "../store";
import { ChannelSegment } from "./ChannelSegment";
import { useAnimationFrame } from "../behaviors/useAnimationFrame";
import { createDrag } from "../behaviors/createDrag";
import { range } from "../util/range";
import { Stick } from "./Stick";
import { sortedIndex } from "../util/sortedIndex";
import { Trigger } from "./Trigger";
import { createZoom } from "../behaviors/createZoom";
import { debounce } from "../util/debounce";

const TILE_WIDTH = 400;
const TILE_HEIGHT = 100;

// the scrollable element
export let scrollElement: HTMLDivElement | undefined;
// the content wrapper
export let contentElement: HTMLDivElement | undefined;

export const zoom = createZoom();

export const Waveform = (props: { buffer: AudioBuffer }) => {
  const zoomWithWheel = debounce((e: WheelEvent) => {
    if (!scrollElement || !contentElement) return;

    const pointerLeftPx = e.clientX - scrollElement.clientLeft;
    const pointerPos = (pointerLeftPx + scrollElement.scrollLeft) /
      contentElement.clientWidth;

    if (e.deltaY > 0 && !zoom.outDisabled()) {
      zoom.out();
    }
    if (e.deltaY < 0 && !zoom.inDisabled()) {
      zoom.in();
    }
    if (!zoom.inDisabled() || !zoom.outDisabled()) {
      scrollElement.scrollLeft = contentElement.clientWidth * pointerPos -
        pointerLeftPx;
    }
  }, 100);

  return (
    <div
      ref={scrollElement}
      data-scroll-element
      style={{
        overflow: "auto",
      }}
      onKeyDown={(e) => {
        // handle zoom
        if (e.ctrlKey) {
          if ((e.key === "+" || e.key === "=")) {
            e.preventDefault();
            zoom.in();
            e.target.scrollIntoView({ inline: "center", "block": "nearest" });
          }
          if ((e.key === "-" || e.key === "_")) {
            e.preventDefault();
            zoom.out();
            e.target.scrollIntoView({ inline: "center", "block": "nearest" });
          }
        }
      }}
      onWheel={(e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        zoomWithWheel(e);
      }}
    >
      <div style={{ height: "var(--min-btn-dimension)" }} />
      <WaveformContent buffer={props.buffer} />
      <WaveformSummary buffer={props.buffer} />
    </div>
  );
};

const WaveformContent = (props: { buffer: AudioBuffer }) => {
  const tileManager = createMemo(() =>
    createVirtualizer({
      count: range(0, props.buffer.length / zoom.samplesPerPixel(), TILE_WIDTH)
        .length,
      getScrollElement: () => scrollElement,
      estimateSize: () => TILE_WIDTH,
      horizontal: true,
    })
  );

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
        height: props.buffer.numberOfChannels * TILE_HEIGHT + "px",
        // @ts-ignore
        "container-type": "inline-size",
      }}
      ondblclick={placeCursor}
    >
      <For each={tileManager().getVirtualItems()}>
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
            region={region}
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

const Slice = (
  props: JSX.HTMLAttributes<HTMLDivElement> & {
    region: { start: number; end: number };
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
      document.getElementById(`slice-${dragPos()}`)?.focus();
      scrollElement?.removeEventListener("touchmove", preventDefault);
    },
  });

  const dragPos = () => {
    if (contentElement) {
      const bounds = getBounds();

      const pos = props.region.start +
        drag.offset() / contentElement.clientWidth;

      const next = Math.max(
        bounds.left,
        Math.min(bounds.right, pos),
      );

      return next;
    }
    return props.region.start;
  };

  const getBounds = () => {
    const _clip = state.clip;
    if (!_clip || !contentElement) throw "AAAAAAH";

    const lengthSeconds = _clip.buffer.length / _clip.buffer.sampleRate;
    const marginSeconds = 0.005;

    const marginCqi = marginSeconds / lengthSeconds;
    const left = state.regions[props.index - 1]?.start + marginCqi || 0;
    const right = props.region.end - marginCqi;

    return { left, right };
  };

  const onKeyDown = createKeyboardMovementHandler((delta) => {
    const bounds = getBounds();

    const next = Math.max(
      bounds.left,
      Math.min(bounds.right, props.region.start + delta),
    );

    dispatch.healSlice(props.index);
    dispatch.slice(next);
    document.getElementById(`slice-${next}`)?.focus();
  });

  return (
    <>
      <Show when={state.editing}>
        <Stick
          pos={dragPos()}
          width={30}
          background="hsl(300deg 100% 25% / 50%)"
          onPointerDown={drag.start}
          tabIndex={0}
          onkeydown={onKeyDown}
          id={`slice-${props.region.start}`}
        >
        </Stick>
      </Show>
      <Stick
        pos={dragPos()}
        width={2}
        background="hsl(300deg 100% 25% / 75%)"
        onPointerDown={state.editing ? drag.start : undefined}
      >
      </Stick>

      <div
        style={{
          position: "absolute",
          transform: `translateX(${dragPos() * 100}cqi)`,
          display: "flex",
          top: "calc(-1 * var(--min-btn-dimension))",
        }}
      >
        <Show when={state.deleting}>
          <button
            onClick={() => {
              dispatch.healSlice(props.index);
            }}
          >
            delete
          </button>
        </Show>
        <Trigger
          region={props.region}
          text={props.region.start.toFixed(5)}
        />
      </div>
    </>
  );
};

const createKeyboardMovementHandler = (move: (deltaCqi: number) => void) => {
  return (e: KeyboardEvent) => {
    if (!scrollElement || !contentElement || !(e.target instanceof Element)) {
      return;
    }

    // handle movement
    if (
      [
        "ArrowRight",
        "ArrowLeft",
        "ArrowUp",
        "ArrowDown",
        "PageDown",
        "PageUp",
        "Home",
        "End",
      ].includes(e.key)
    ) {
      e.preventDefault();

      const stepPx = 10;
      const stepCqi = stepPx / contentElement.clientWidth;
      const step = e.ctrlKey ? stepCqi * 10 : stepCqi;

      if (e.key === "ArrowRight") {
        move(step);
        if (
          e.target.getBoundingClientRect().right >
            scrollElement.getBoundingClientRect().right
        ) {
          e.target.scrollIntoView({ inline: "start", "block": "nearest" });
        }
      }
      if (e.key === "ArrowLeft") {
        move(-step);
        if (
          e.target.getBoundingClientRect().left <
            scrollElement.getBoundingClientRect().left
        ) {
          e.target.scrollIntoView({ inline: "end", "block": "nearest" });
        }
      }

      const pagePx = scrollElement.clientWidth;
      const pageCqi = pagePx / contentElement.clientWidth;

      if (e.key === "PageDown") {
        move(pageCqi);
        e.target.scrollIntoView({ inline: "center", "block": "nearest" });
      }
      if (e.key === "PageUp") {
        move(-pageCqi);
        e.target.scrollIntoView({ inline: "center", "block": "nearest" });
      }
      if (e.key === "Home") {
        move(-1);
        e.target.scrollIntoView({ inline: "center", "block": "nearest" });
      }
      if (e.key === "End") {
        move(1);
        e.target.scrollIntoView({ inline: "center", "block": "nearest" });
      }
    }
  };
};

const Cursor = (
  props: JSX.HTMLAttributes<HTMLDivElement>,
) => {
  const preventDefault = (e: Event) => e.preventDefault();
  const drag = createDrag({
    onStart: () => {
      dispatch.showCursorControls();
      scrollElement?.addEventListener("touchmove", preventDefault);
    },
    onFinished: () => {
      dispatch.setCursor(dragPos());
      scrollElement?.removeEventListener("touchmove", preventDefault);
    },
  });

  const dragPos = () => {
    if (contentElement) {
      const pos = state.cursor + drag.offset() / contentElement.clientWidth;
      return Math.max(0, Math.min(1, pos));
    }
    return state.cursor;
  };

  const end = createMemo(() =>
    state.regions[sortedIndex(state.regions.map((r) => r.start), state.cursor)]
      ?.start || 1
  );

  const onKeyDown = createKeyboardMovementHandler((delta) => {
    dispatch.showCursorControls();
    dispatch.setCursor(state.cursor + delta);
  });

  let ref: HTMLDivElement | undefined;

  return (
    <>
      <Show when={!state.editing}>
        <Stick
          ref={ref}
          pos={dragPos()}
          width={30}
          background="hsl(39deg 100% 50% / 50%)"
          onPointerDown={drag.start}
          onKeyDown={onKeyDown}
          tabIndex={0}
        >
        </Stick>
      </Show>
      <div style={{ "pointer-events": "none" }}>
        <Stick
          id="cursor"
          pos={dragPos()}
          width={2}
          background="repeating-linear-gradient(orange 0px, orange 4px, transparent 4px, transparent 8px)"
        >
        </Stick>
      </div>
      <Show
        when={state.cursorControlsVisible}
      >
        <div
          style={{
            position: "absolute",
            transform: `translateX(${dragPos() * 100}cqi)`,
            display: "flex",
            top: "calc(-1 * var(--min-btn-dimension))",
          }}
          ondblclick={(e) => e.stopPropagation()}
          onKeyDown={onKeyDown}
        >
          <button
            onClick={() => {
              dispatch.slice(state.cursor);
              dispatch.hideCursorControls();
              ref?.focus();
            }}
          >
            slice
          </button>
          <Trigger
            region={{ start: state.cursor, end: end() }}
          />
        </div>
      </Show>
    </>
  );
};

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
            background="hsl(300deg 100% 25% / 75%)"
            width={2}
          >
          </Stick>
        )}
      </For>
      <PositionIndicator />
      <Stick
        pos={state.cursor}
        width={2}
        background="repeating-linear-gradient(orange 0px, orange 4px, transparent 4px, transparent 8px)"
      >
      </Stick>
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
