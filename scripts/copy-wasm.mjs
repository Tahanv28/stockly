// Copies the barcode scanner's WebAssembly file into /public so it's served
// from our own domain instead of a third-party CDN. Runs after npm install.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";

const src = "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm";
if (existsSync(src)) {
  mkdirSync("public/zxing", { recursive: true });
  copyFileSync(src, "public/zxing/zxing_reader.wasm");
}
