import { AudioInput } from "./AudioInput";
import { clip, setClip } from "./signals";
import { onMount, Show } from "solid-js"

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
    <Wave></Wave>
  </Show>

const Wave = () => {
  let canvas: HTMLCanvasElement | undefined;
  
  onMount(() => {{
    if (!canvas) return;
    canvas.width = canvas.offsetWidth; // TODO: remove
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
    context.moveTo(0, samples[0] * canvas.height / 2)
    for (let i = 0; i < canvas.width; i++) {
      context.lineTo(i, samples[i] * canvas.height / 2)
    }
    context.stroke();
    context.closePath();
  }})


  return <canvas ref={canvas}></canvas>
}
