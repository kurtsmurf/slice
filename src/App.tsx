import { AudioInput } from "./AudioInput";
import { clip, setClip } from "./signals";
import { onMount, Show, For } from "solid-js"
const CHUNK_SIZE = 100;

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
    <p>{clip()?.buffer.length} samples</p>
    <div class="wave">
      <For each={divisions()}>{
        (start) => <Wave start={start} width={CHUNK_SIZE}></Wave>
      }</For>
    </div>
  </Show>

const divisions = () => {
  const buffer = clip()?.buffer;
  const output: number[]=  [];
  if (!buffer) return output;

  for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
    output.push(i)
  }

  return output
}

const Wave = (props: {start: number, width: number}) => {
  let canvas: HTMLCanvasElement | undefined;
  
  onMount(() => {{
    if (!canvas) return;
    const clip_ = clip();
    if (!clip_) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    // shift origin
    context.translate(0, canvas.height / 2)
 
    // draw baseline
    context.beginPath();
    context.lineWidth = 1;
    context.setLineDash([2])
    context.moveTo(0,0)
    context.lineTo(canvas.width, 0)
    context.stroke();
    context.closePath()

    // draw waveform
    context.beginPath();
    context.setLineDash([])
    context.strokeStyle = "black"
    context.lineWidth = 2
    const samples = clip_.buffer.getChannelData(0);
    const overlap = 5;
    // context.moveTo(0, samples[0] * canvas.height / 2)
    for (let i = -overlap; i < props.width + overlap; i++) {
      context.lineTo(i, samples[props.start + i] * canvas.height / 2)
    }
    context.stroke();
    context.closePath();
  }})


  return <canvas ref={canvas} width={props.width}></canvas>
}
