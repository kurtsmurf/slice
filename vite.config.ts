import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { qrcode } from 'vite-plugin-qrcode';

export default defineConfig({
  base: '/slice/',
  plugins: [
    solidPlugin(),
    qrcode(),
  ],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    target: "esnext",
  },
});
