import {
  createMemo,
  createSignal,
  For,
  JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { player } from "../player";
import { dispatch, same, state } from "../store";
import { ChannelSegment } from "./ChannelSegment";
import { useAnimationFrame } from "../behaviors/useAnimationFrame";
import { createDrag } from "../behaviors/createDrag";
import { range } from "../util/range";
import { Stick } from "./Stick";
import { Trigger } from "./Trigger";
import { createZoom } from "../behaviors/createZoom";
import { debounce as myDebounce } from "../util/debounce";
import debounce from "lodash.debounce";

const TILE_WIDTH = 400;
const TILE_HEIGHT = 100;

// the scrollable element
export let scrollElement: HTMLDivElement | undefined;
// the content wrapper
export let contentElement: HTMLDivElement | undefined;

export const zoom = createZoom();

export const Waveform = (props: { buffer: AudioBuffer }) => {
  const zoomWithWheel = myDebounce((e: WheelEvent) => {
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
      onkeypress={(e) => {
        switch (e.key) {
          case "s":
            return dispatch.setMode("slice");
          case "e":
            return dispatch.setMode("edit");
          case "d":
            return dispatch.setMode("delete");
        }
      }}
    >
      <div style={{ height: "calc(var(--min-btn-dimension) + 20px)" }} />
      <WaveformContent buffer={props.buffer} />
      <WaveformSummary buffer={props.buffer} />
    </div>
  );
};

export const [zoomCenter, setZoomCenter] = createSignal(0);

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
      ondblclick={(e) => {
        placeCursor(e);
        setZoomCenter(state.cursor);
      }}
    >
      <svg
        id="zoom-dot"
        viewBox="0 0 2 2"
        width="1ch"
        style={{
          transform: `translateX(${zoomCenter() * 100}cqi)`,
          position: "absolute",
          left: "-0.5ch",
          opacity: 0.8,
          top: "calc(var(--min-btn-dimension) * -1 - 15px)",
        }}
      >
        <circle cx="1" cy="1" r="1" />
        {/* <polygon points="0,0 1,2 2,0" fill="black" /> */}
      </svg>

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
      <ActiveRegion />
      <Cursor />
      <Playhead />
    </div>
  );
};

const ActiveRegion = () => {
  const region = createMemo(() =>
    state
      .regions[state.selectedRegion !== undefined ? state.selectedRegion : -1]
  );
  return (
    <Show when={region()}>
      <div
        data-active-region
        style={{
          position: "absolute",
          height: "100%",
          width: (region().end - region().start) * 100 + "cqi",
          left: region().start * 100 + "cqi",
          background: "hsl(39deg 100% 50% / 25%)",
          "pointer-events": "none",
        }}
      >
      </div>
    </Show>
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
      dispatch.moveSlice(props.index, dragPos());
      setZoomCenter(props.region.start);
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

    dispatch.moveSlice(props.index, next);
    setZoomCenter(next);
    document.getElementById(`slice-${next}`)?.focus();
  });

  return (
    <>
      <Stick
        pos={dragPos()}
        width={2}
        background="black"
        style={{
          "box-shadow": `1px 0px 0px white, -1px 0px 0px white`,
        }}
      >
      </Stick>

      <div
        class="hitbox"
        data-index={props.index}
        style={{
          position: "absolute",
          transform: `translateX(${props.region.start * 100}cqi)`,
          width: `${(props.region.end - props.region.start) * 100}cqi`,
          height: "100%",
        }}
      >
      </div>

      <Show when={state.mode === "edit" && props.index > 0}>
        <Stick
          pos={dragPos()}
          width={30}
          background="hsl(0deg 0% 25% / 30%)"
          onPointerDown={(e) => {
            drag.start(e);
          }}
          onFocus={() => setZoomCenter(dragPos())}
          tabIndex={0}
          onkeydown={onKeyDown}
          id={`slice-${props.region.start}`}
        >
        </Stick>
      </Show>

      <div
        style={{
          position: "absolute",
          transform: `translateX(${dragPos() * 100}cqi)`,
          display: "flex",
          top: "calc(-1 * var(--min-btn-dimension))",
        }}
        onFocusIn={() => setZoomCenter(dragPos())}
      >
        <Show when={state.mode === "delete" && props.index > 0}>
          <button
            onClick={() => {
              dispatch.healSlice(props.index);
              if (state.selectedRegion !== undefined) {
                if (props.index <= state.selectedRegion) {
                  dispatch.selectRegion(state.selectedRegion - 1);
                }
              }
            }}
          >
            delete
          </button>
        </Show>
        <Trigger
          region={props.region}
          text={(props.index + 1).toString()}
          onTrigger={() => {
            setZoomCenter(props.region.start);
            if (state.selectedRegion !== undefined) {
              dispatch.selectRegion(props.index);
            }
          }}
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
          e.target.scrollIntoView({ inline: "center", "block": "nearest" });
        }
      }
      if (e.key === "ArrowLeft") {
        move(-step);
        if (
          e.target.getBoundingClientRect().left <
            scrollElement.getBoundingClientRect().left
        ) {
          e.target.scrollIntoView({ inline: "center", "block": "nearest" });
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
      setZoomCenter(state.cursor);
    },
  });

  const dragPos = () => {
    if (contentElement) {
      const pos = state.cursor + drag.offset() / contentElement.clientWidth;
      return Math.max(0, Math.min(1, pos));
    }
    return state.cursor;
  };

  const onKeyDown = createKeyboardMovementHandler((delta) => {
    dispatch.showCursorControls();
    dispatch.setCursor(state.cursor + delta);
    setZoomCenter(state.cursor);
  });

  let ref: HTMLDivElement | undefined;

  const [region, setRegion] = createSignal(0);
  const active = createMemo(() =>
    player.playing() &&
    same(
      player.region(),
      {
        start: state.cursor,
        end: state.regions[region()].end,
      },
    )
  );

  const syncRegion = () => {
    const cursor = document.getElementById("cursor");
    if (!cursor) return;
    const hitbox = document.elementsFromPoint(
      cursor.getBoundingClientRect().x,
      cursor.getBoundingClientRect().y,
    ).find((el) => el.classList.contains("hitbox"));
    if (!hitbox || !(hitbox instanceof HTMLElement)) return;
    const index = parseInt(hitbox.dataset.index || "");
    setRegion(index);
  };

  return (
    <>
      <div style={{ "pointer-events": "none" }}>
        <Stick
          id="cursor"
          pos={dragPos()}
          width={2}
          background="repeating-linear-gradient(orange 0px, orange 4px, transparent 4px, transparent 8px)"
        >
        </Stick>
      </div>

      <Show when={state.mode === "slice"}>
        <Stick
          ref={ref}
          pos={dragPos()}
          width={30}
          background="hsl(39deg 100% 50% / 50%)"
          onPointerDown={drag.start}
          onKeyDown={onKeyDown}
          onFocus={() => setZoomCenter(dragPos())}
          tabIndex={0}
        >
        </Stick>
      </Show>
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
          onFocusIn={() => setZoomCenter(state.cursor)}
        >
          <Show when={state.mode === "slice"}>
            <button
              onClick={() => {
                syncRegion();
                dispatch.slice(region(), state.cursor);
                dispatch.hideCursorControls();
                ref?.focus();
                setZoomCenter(state.cursor);
                if (state.selectedRegion !== undefined) {
                  dispatch.selectRegion(region() + 1);
                }
              }}
            >
              slice
            </button>
          </Show>
          <button
            onClick={() => {
              if (active()) {
                player.stop();
              } else {
                setZoomCenter(state.cursor);
                syncRegion();

                player.play(state.clip!.buffer, {
                  start: state.cursor,
                  end: state.regions[region()].end,
                });
              }
            }}
            style={{
              "font-family": "monospace",
              "font-size": "1rem",
            }}
          >
            {active() ? <>&#9632;</> : <>&#9654;</>}
          </button>
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
          bottom: 0,
          height: "39px",
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

  const [width, setWidth] = createSignal(800);

  // @ts-ignore
  window.setWidth = setWidth;

  const resizeObserver = new ResizeObserver(debounce(
    () => {
      if (root) setWidth(root.clientWidth);
    },
    300,
    { trailing: true },
  ));

  onMount(() => {
    if (root) resizeObserver.observe(root);
  });

  onCleanup(() => {
    if (root) resizeObserver.unobserve(root);
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
            width={width()}
            height={25}
            numBuckets={width()}
            style={{
              position: "absolute",
              bottom: 0,
              height: "39px",
            }}
          />
        )}
      </For>
      <PositionIndicator />
      <Stick
        pos={state.cursor}
        width={2}
        background="repeating-linear-gradient(orange 0px, orange 2px, transparent 2px, transparent 4px)"
        style={{
          height: "50px",
          top: "unset",
          bottom: 0,
        }}
      >
      </Stick>
      <For each={state.regions}>
        {(region) => (
          <Stick
            pos={region.start}
            background="black"
            style={{
              height: "10px",
            }}
            width={2}
          >
          </Stick>
        )}
      </For>
      <ActiveRegion />
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
