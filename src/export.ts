import { print } from "./player";

export const download = async (
  buffer: AudioBuffer,
  region: { start: number; end: number },
  speed: number,
) => {
  const { wav, fileName } = await print(buffer, region, speed);
  const url = URL.createObjectURL(
    new Blob([wav], { type: "audio/wav" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  link.click();
  URL.revokeObjectURL(url);
};

export const share = async (
  buffer: AudioBuffer,
  region: { start: number; end: number },
  speed: number,
) => {
  const { wav, fileName } = await print(buffer, region, speed);
  const file = new File([wav], fileName, { type: "audio/wav" });
  navigator.share({
    files: [file],
  });
};
