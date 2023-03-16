import { unmute } from "./unmute";

export const audioContext = new AudioContext();

// workaround for ios "silent mode" issue
unmute(audioContext);
