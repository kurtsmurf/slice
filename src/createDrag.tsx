import { createSignal } from "solid-js";

export const createDrag = (
  props: {
    onFinished?: (e: PointerEvent) => void;
    onStart?: (e: PointerEvent) => void;
    onMove?: (e: PointerEvent) => void;
  },
) => {
  let initialPosition: number | undefined;
  const [offset, setOffset] = createSignal(0);

  const start = (e: PointerEvent) => {
    props.onStart?.(e);
    initialPosition = e.clientX;
    document.body.addEventListener("pointerup", finish);
    document.body.addEventListener("pointermove", move);
  };
  const finish = (e: PointerEvent) => {
    props.onFinished?.(e);
    initialPosition = undefined;
    document.body.removeEventListener("pointerup", finish);
    document.body.removeEventListener("pointermove", move);
    setOffset(0);
  };
  const move = (e: PointerEvent) => {
    if (initialPosition !== undefined) {
      props.onMove?.(e);
      setOffset(e.clientX - initialPosition);
    }
  };
  return {
    offset,
    start,
  };
};
