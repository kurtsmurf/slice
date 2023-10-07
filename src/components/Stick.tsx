import { JSX, splitProps } from "solid-js";

export const Stick = (
  props: Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
    pos: number;
    width: number;
    background: string;
    style?: JSX.CSSProperties;
  },
) => {
  const [, htmlAttrs] = splitProps(props, ["pos"]);

  return (
    <div
      {...htmlAttrs}
      style={{
        ...props.style,
        position: "absolute",
        top: 0,
        left: `${props.width / -2}px`,
        transform: `translateX(${props.pos * 100}cqi)`,
        width: `${props.width}px`,
        height: "100%",
        background: props.background,
      }}
    >
    </div>
  );
};
