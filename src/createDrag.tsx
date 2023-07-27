import { createSignal } from "solid-js";

export const createDrag = (
  props: {
    onFinished?: (e: PointerEvent) => void;
    onStart?: (e: PointerEvent) => void;
    onDrag?: (e: PointerEvent) => void;
  },
) => {
  let initialClientX: number | undefined;
  const [offset, setOffset] = createSignal(0);

  const start = (e: PointerEvent) => {
    props.onStart?.(e);
    initialClientX = e.clientX;
    document.body.addEventListener("pointerup", finish);
    document.body.addEventListener("pointerleave", finish)
    document.body.addEventListener("pointermove", move);
  };
  const finish = (e: PointerEvent) => {
    props.onFinished?.(e);
    initialClientX = undefined;
    document.body.removeEventListener("pointerup", finish);
    document.body.removeEventListener("pointerleave", finish)
    document.body.removeEventListener("pointermove", move);
    setOffset(0);
  };
  const move = (e: PointerEvent) => {
    if (initialClientX !== undefined) {
      props.onDrag?.(e);
      setOffset(e.clientX - initialClientX);
    }
  };

  return {
    offset,
    start,
  };
};
