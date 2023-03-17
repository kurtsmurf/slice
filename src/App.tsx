import { AudioInput } from "./AudioInput";
import { clip, setClip } from "./signals";
import { createEffect, createSignal, Show } from "solid-js"
import { FFT_SIZE } from "./FFT_SIZE";

const [offsetX, setOffsetX] = createSignal(0)

createEffect(() => console.log(offsetX))


const [dragging, setDragging] = createSignal(false)
const [dragStart, setDragStart] = createSignal(-1)

export const App = () =>
  <Show
    when={clip()}
    fallback={<AudioInput onChange={setClip} />}
  >
    <button onClick={() => setClip(undefined)}>clear</button>
    <p>{clip()?.name}</p>
    <p>{clip()?.buffer.numberOfChannels} channels</p>
    <p>{
      ((clip()?.buffer.length || 0) /
        (clip()?.buffer.sampleRate || 1)).toFixed(2)
    } seconds</p>
    <svg
      viewBox={`0 -5 ${FFT_SIZE} 10`}
      onwheel={(e) => {
        e.preventDefault();
        // @ts-ignore
        if (e.wheelDelta < 0) {
          // console.log("DOWN")
          setOffsetX(prev => Math.min(prev + 100, ((clip()?.buffer.length || Number.MAX_VALUE) - FFT_SIZE)))
        } else {
          // console.log("UP")
          setOffsetX(prev => Math.max(prev - 100, 0))
        }
      }}
      onPointerDown={e => {
        setDragging(true)
        setDragStart(e.clientX)
      }}
      onPointerLeave={() => {
        setDragging(false)
        setDragStart(-1)
      }}
      onPointerUp={() => {
        setDragging(false)
        setDragStart(-1)
      }}
      onPointerMove={e => {
        if (dragging()) {
          const deltaX = e.clientX - dragStart()
          setDragStart(e.clientX)
          setOffsetX(prev => prev - deltaX * 10)
          console.log("dragging")
        }
      }}
    >
      <path id="blah" d="M 0 0 H 1000"></path>
      <path d={
        pathOfFloat32Array(
          clip()?.buffer.getChannelData(0).slice(
            offsetX(), offsetX() + 7000
          )
          || new Float32Array()
        )}
      ></path>

    </svg>
  </Show>





type Point = { x: number; y: number };

const move = (path: string, { x, y }: Point) => `${path} M ${x}, ${y} `;
const lineTo = (path: string, { x, y }: Point) => `${path} L ${x}, ${y} `;

export const pathOfFloat32Array = (floats: Float32Array): string => {
  const [first, ...rest] = floats;
  return rest.reduce(
    (path, float, index) =>
      lineTo(
        path,
        {
          x: (index + 1) / 100,
          y: float * 5,
        },
      ),
    move("", { x: 0, y: first }),
  );
};
