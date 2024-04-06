export const Curtain = () => (
  <div
    style={{
      position: "fixed",
      width: "100vw",
      height: "100vh",
      left: 0,
      top: 0,
      background: "hsl(0deg 0% 0% / 30%)",
      display: "grid",
      "place-content": "center",
      "z-index": 100,
    }}
  >
    <div
      style={{
        background: "hsl(0deg 0% 0% / 10%)",
        padding: "2ch",
      }}
    >
      <progress></progress>
    </div>
  </div>
);
