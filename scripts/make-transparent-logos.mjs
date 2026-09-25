import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

// These are pixel masks applied to the artwork cropped from the supplied reference.
// No logo elements are drawn, generated, or retouched.
const assets = path.join(process.cwd(), "public", "assets");
mkdirSync(assets, { recursive: true });

async function circularSeal() {
  const input = await sharp(path.join(assets, "ovc-seal.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = input;
  const cx = 412, cy = 391, radius = 385;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    const distance = Math.hypot(x - cx, y - cy);
    data[i + 3] = Math.min(255, Math.max(0, Math.round((radius + 1.5 - distance) * 130)));
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(info.width * 2, info.height * 2, { kernel: "lanczos3" })
    .png().toFile(path.join(assets, "ovc-seal-transparent.png"));
}

async function eventMark() {
  const input = await sharp(path.join(assets, "event-mark.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = input;
  const { width, height } = info;
  const silhouette = [[535, 270], [575, 270], [575, 340], [618, 320], [674, 318], [707, 360], [716, 447], [751, 474], [770, 537], [770, 630], [459, 630], [412, 587], [468, 538], [481, 495], [534, 465]];
  const inside = (x, y, polygon) => {
    let found = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) found = !found;
    }
    return found;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const light = Math.min(data[i], data[i + 1], data[i + 2]);
    const person = inside(x, y, silhouette);
    const preserveWhite = Math.hypot(x - 258, y - 195) < 105 || Math.hypot(x - 443, y - 464) < 45 || person;
    if (!preserveWhite && light > 190) data[i + 3] = Math.max(0, Math.min(255, Math.round((241 - light) * 5)));
    if (person && y > 565 && light > 190) data[i + 3] = Math.min(data[i + 3], Math.max(0, Math.round((620 - y) / 55 * 255)));
  }
  await sharp(data, { raw: { width, height, channels: 4 } })
    .resize(width * 2, height * 2, { kernel: "lanczos3" })
    .png().toFile(path.join(assets, "event-mark-transparent.png"));
}

await circularSeal();
await eventMark();
