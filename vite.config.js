import { defineConfig } from "vite";
import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// js/*.js 는 전역 스코프를 공유하는 일반 스크립트(non-module)라 Vite 가 번들하지 않는다.
// 소스 구조를 그대로 둔 채 dist 로 복사해 dev/build 결과를 동일하게 맞춘다.
function copyPlainScripts() {
  return {
    name: "copy-plain-scripts",
    apply: "build",
    closeBundle() {
      const from = resolve(process.cwd(), "js");
      const to = resolve(process.cwd(), "dist/js");
      mkdirSync(to, { recursive: true });
      cpSync(from, to, { recursive: true });
    },
  };
}

export default defineConfig({
  root: ".",
  plugins: [copyPlainScripts()],
  server: {
    port: 5173,
    open: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // 생성기 특성상 결과 확인/디버깅이 잦아 난독화하지 않는다.
    minify: false,
  },
});
