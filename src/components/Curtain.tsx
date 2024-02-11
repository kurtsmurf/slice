export const Curtain = () => (
  <div
    style={{
      position: "fixed",
      width: "100vw",
      height: "100vh",
      left: 0,
      top: 0,
      background: "black",
      opacity: 0.3,
      display: "grid",
      "place-content": "center",
      "z-index": 100,
    }}
  >
    <progress></progress>
  </div>
);
