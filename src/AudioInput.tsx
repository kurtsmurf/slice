import { audioContext } from "./audioContext";
import { Clip } from "./types";

type Props = { onChange: (clip: Clip) => void };

export const AudioInput = (props: Props) => {
  let input: HTMLInputElement | undefined;

  return (
    <label
      role="button"
      tabIndex="0"
      onKeyPress={(e) => {
        if (["Space", "Enter"].includes(e.code)) {
          e.preventDefault();
          input?.click();
        }
      }}
      class="audio-input"
    >
      <span>load audio</span>
      <input
        ref={input}
        type="file"
        style="display: none;"
        accept=".mp3, .wav, .m4a"
        onChange={(e) => {
          const [file] = [...(e.currentTarget.files || [])];
          clipOfFile(file).then(props.onChange);
        }}
      />
    </label>
  );
};

const clipOfFile = async (file: File): Promise<Clip> => ({
  name: file.name,
  buffer: await audioContext.decodeAudioData(await arrayBufferOfFile(file)),
});

const arrayBufferOfFile = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = (e) => {
      if (!(e.target?.result instanceof ArrayBuffer)) {
        reject();
        return;
      }
      resolve(e.target.result);
    };
    reader.readAsArrayBuffer(file);
  });
