import { For } from "solid-js";
import { state } from "../store";
import { contentElement, scrollElement } from "./Waveform";
import { Trigger } from "./Trigger";
import audiobufferToWav from "audiobuffer-to-wav";
import { attackRelease } from "../player";

export const Pads = (props: { buffer: AudioBuffer }) => {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        gap: "1rem",
        "padding-block": "1rem",
      }}
    >
      <For each={state.regions}>
        {(region) => (
          <div>
            <Trigger
              region={region}
              onTrigger={() => {
                // center region start in waveform viewer
                if (scrollElement && contentElement) {
                  scrollElement.scrollLeft =
                    region.start * contentElement.clientWidth -
                    scrollElement.clientWidth / 2;
                }
              }}
              text={region.start.toFixed(5)}
            />
            <button
              onClick={() => download(props.buffer, region)}
            >
              download
            </button>
          </div>
        )}
      </For>
    </div>
  );
};

const download = async (
  buffer: AudioBuffer,
  region: { start: number; end: number },
) => {
  // render audiobuffer of region
  const offlineAudioContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.duration * buffer.sampleRate *
      (region.end - region.start),
    buffer.sampleRate,
  );
  attackRelease(offlineAudioContext, buffer, region);
  const offlineResult = await offlineAudioContext
    .startRendering();

  // convert audiobuffer to an arraybuffer of wav-encoded bytes
  const wav = audiobufferToWav(offlineResult);

  // use hash digest as file name
  const hashBuffer = await crypto.subtle.digest("SHA-256", wav);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const fileName = hashHex + ".wav";

  // trigger download
  // @ts-ignore
  if (navigator.share) {
    // use Web Share API if available
    const file = new File([wav], fileName, { type: "audio/wav" });
    navigator.share({
      files: [file],
    });
  } else {
    // otherwise use download link
    const url = URL.createObjectURL(
      new Blob([wav], { type: "audio/wav" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    link.click();
    URL.revokeObjectURL(url);
  }
};
