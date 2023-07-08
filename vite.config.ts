import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { qrcode } from 'vite-plugin-qrcode';
import istanbul from "vite-plugin-istanbul"

export default defineConfig({
  base: '/slice/',
  plugins: [
    solidPlugin(),
    qrcode(),
    istanbul({
      include: 'src/*',
      extension: ['.ts', '.tsx'],
    }),
  ],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    target: "esnext",
  },
});
