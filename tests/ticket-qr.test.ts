import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import jsQR from "jsqr";
import sharp from "sharp";

it("QR ที่แสดงบนตั๋วอ่านกลับเป็นรหัสตรวจสิทธิ์เดิมได้", async () => {
  for (const code of ["A-14-1-DEMO", "PICK-DEMO90"]) {
    const svg = renderToStaticMarkup(createElement(QRCodeSVG, { value: code, size: 132, marginSize: 2, level: "M", bgColor: "#ffffff", fgColor: "#102f61" }));
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const found = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    assert.equal(found?.data, code);
  }
});
