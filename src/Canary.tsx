import { onCleanup, onMount } from "solid-js";

export const Canary = () => {
  let canvas: HTMLCanvasElement | undefined;
  let frame: number;

  onMount(() => {
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.translate(25, 25);
    context.fillStyle = "hsl(0deg 0% 100% / 1%)";

    const tick = () => {
      // fade
      context.fillRect(-25, -25, 50, 50);

      // calculate
      const progress = (Date.now() % 1000000) / 1000000;
      const angle = progress * 360;
      const x = 25 * Math.cos(angle);
      const y = 25 * Math.sin(angle);

      // draw
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(x, y);
      context.stroke();

      //repeat
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
  });

  onCleanup(() => {
    cancelAnimationFrame(frame);
  });

  return (
    <canvas
      style={{
        position: "fixed",
        top: 0,
        right: 0,
      }}
      width={50}
      height={50}
      ref={canvas}
    >
    </canvas>
  );
};
