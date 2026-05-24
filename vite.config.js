import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5192,
    allowedHosts: [
      "book.dev.raftforge.art",
      "book-edit.raftforge.art",
      "book-new.dev.raftforge.art",
      "localhost",
      "127.0.0.1",
    ],
    proxy: {
      "/api": { target: "http://127.0.0.1:8026", changeOrigin: true },
      "/auth": { target: "http://127.0.0.1:8026", changeOrigin: true },
    },
  },
  build: {
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Блоки лениво подгружаются через dynamic import — chunk-имена ставим
        // стабильные, чтобы было читаемо в DevTools.
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
  },
});
