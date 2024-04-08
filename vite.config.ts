import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { qrcode } from 'vite-plugin-qrcode';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [
    solidPlugin(),
    qrcode(),
    mkcert(),
  ],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    target: "esnext",
  },
});
