import { render } from "solid-js/web";
import { App } from "./App";
// import { Canary } from "./Canary";

const Blah = () => (
  <>
    {/* <Canary /> */}
    <App />
  </>
);

render(Blah, document.getElementById("root")!);
