import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { qrcode } from 'vite-plugin-qrcode';
import { VitePWA } from 'vite-plugin-pwa'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
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
