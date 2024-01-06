import { Region, print } from "./player";

export const download = async (
  buffer: AudioBuffer,
  region: Region,
  speed: number,
  loPass: number,
  hiPass: number,
) => {
  const { wav, fileName } = await print(buffer, region, speed, hiPass, loPass);
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
  region: Region,
  speed: number,
  loPass: number,
  hiPass: number,
) => {
  const { wav, fileName } = await print(buffer, region, speed, hiPass, loPass);
  const file = new File([wav], fileName, { type: "audio/wav" });
  navigator.share({
    files: [file],
  });
};
