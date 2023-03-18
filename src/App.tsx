import { AudioInput } from "./AudioInput";
import { clip, setClip } from "./signals";
import { createSignal, Show } from "solid-js"

const [offsetSamples, setOffsetSamples] = createSignal(0)
const [dragging, setDragging] = createSignal(false)
const [dragStart, setDragStart] = createSignal(-1)

const WINDOW_SAMPLES = 7000;

const startDrag = (e: PointerEvent) => {
  setDragging(true)
  setDragStart(e.clientX)
}

const stopDrag = () => {
  setDragging(false)
  setDragStart(-1)
}

const drag = (e: PointerEvent) => {
  if (!dragging()) return; 
  const deltaX = e.clientX - dragStart()
  const min = 0;
  const max = (clip()?.buffer.length || 0) - WINDOW_SAMPLES;
  const target = offsetSamples() - deltaX * 10;
  const nextOffset = Math.min(Math.max(target, min), max);
  setOffsetSamples(nextOffset);
  setDragStart(e.clientX)
}

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
    <p>{offsetSamples} sample start</p>
    <p>{clip()?.buffer.length} samples</p>
    <svg
      viewBox={`0 -5 ${64} 10`}
      onPointerDown={startDrag}
      onPointerLeave={stopDrag}
      onPointerUp={stopDrag}
      onPointerMove={drag}
    >
      <path id="blah" d="M 0 0 H 1000"></path>
      <path d={
        pathOfFloat32Array(
          clip()?.buffer.getChannelData(0).slice(
            // FIXME: MAGIC NUMBER
            offsetSamples(), offsetSamples() + WINDOW_SAMPLES
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
          x: index / 100,
          y: float * 5,
        },
      ),
    move("", { x: 0, y: first }),
  );
};

// ======== TODO: keyboard controls ========

// key: 'ArrowUp'
// key: 'ArrowLeft'
// shuttle back

// key: 'ArrowDown'
// key: 'ArrowRight'
// shuttle forward

// key: 'PageUp'
// shuttle back more

// key: 'PageDown'
// shuttle forward more

// key: 'End'
// go to end

// key: 'Home'
// go to beginning