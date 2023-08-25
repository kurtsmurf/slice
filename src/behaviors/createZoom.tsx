import { createSignal } from "solid-js";

export function createZoom() {
  const min = 1;
  const max = Math.pow(2, 10);
  const [samplesPerPixel, setSamplesPerPixel] = createSignal(32);
  const factor = 2;

  return {
    in: () => setSamplesPerPixel((prev) => Math.max(min, prev / factor)),
    out: () => setSamplesPerPixel((prev) => Math.min(max, prev * factor)),
    samplesPerPixel,
    inDisabled: () => samplesPerPixel() === min,
    outDisabled: () => samplesPerPixel() === max,
  };
}
