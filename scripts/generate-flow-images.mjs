import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const out = path.join(root, "deliverables");
mkdirSync(out, { recursive: true });
const asData = (name) => `data:image/png;base64,${readFileSync(path.join(root, "public", "assets", name)).toString("base64")}`;
const eventLogo = asData("event-mark-transparent.png");
const ovcLogo = asData("ovc-seal-transparent.png");
const C = { navy: "#123465", deep: "#102a55", cyan: "#08a8cc", gold: "#d5a145", green: "#278b73", violet: "#7556a7", ink: "#173659", muted: "#607b98", line: "#d8e6ef", bg: "#f3f8fc", white: "#ffffff" };
const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const rect = (x, y, w, h, fill, radius = 18, stroke = "none", extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" ${extra}/>`;
const text = (x, y, value, size = 24, weight = 500, color = C.ink, extra = "") => `<text x="${x}" y="${y}" font-family="Tahoma,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${esc(value)}</text>`;
const circle = (cx, cy, r, fill, stroke = "none", sw = 1) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const line = (x1, y1, x2, y2, color = "#9bb7ca", width = 5, arrow = false, extra = "") => `<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${arrow ? 'marker-end="url(#arrow)"' : ""} ${extra}/>`;
const pathArrow = (d, color = "#9bb7ca", width = 5) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrow)"/>`;

function card(x, y, w, h, { accent = C.cyan, kicker = "", title = "", lines = [], number = "", background = C.white }) {
  const left = x + 30;
  const copy = [rect(x, y, w, h, background, 19, C.line, 'stroke-width="2" filter="url(#shadow)"'), rect(x, y, 9, h, accent, 5)];
  if (number) { copy.push(circle(x + w - 39, y + 37, 19, accent)); copy.push(text(x + w - 39, y + 44, number, 15, 700, C.white, 'text-anchor="middle"')); }
  if (kicker) copy.push(text(left, y + 34, kicker, 14, 700, accent, 'letter-spacing="2"'));
  copy.push(text(left, y + (kicker ? 79 : 53), title, 28, 700, C.deep));
  const start = y + (kicker ? 118 : 94);
  lines.forEach((value, index) => copy.push(text(left, start + index * 36, value, 20, 400, C.muted)));
  return copy.join("");
}

function pill(x, y, w, label, color = C.cyan, fill = "#eaf9fc") {
  return rect(x, y, w, 35, fill, 18) + text(x + w / 2, y + 24, label, 16, 700, color, 'text-anchor="middle"');
}

function shell(title, subtitle, index, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1920" height="1080" viewBox="0 0 1920 1080" role="img" aria-label="${esc(title)}">
    <defs>
      <filter id="shadow" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="0" dy="9" stdDeviation="12" flood-color="#123465" flood-opacity=".09"/></filter>
      <marker id="arrow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto"><path d="M1 1 L11 6 L1 11" fill="none" stroke="#8fb0c4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></marker>
      <linearGradient id="header" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f2d60"/><stop offset="1" stop-color="#1d5791"/></linearGradient>
      <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#c8dce9" opacity=".65"/></pattern>
    </defs>
    ${rect(0, 0, 1920, 1080, C.bg, 0)}
    ${rect(0, 0, 1920, 1080, "url(#dots)", 0)}
    ${rect(0, 0, 1920, 204, "url(#header)", 0)}
    ${rect(54, 36, 205, 132, C.white, 18)}
    <image x="65" y="43" width="107" height="114" href="${eventLogo}" xlink:href="${eventLogo}" preserveAspectRatio="xMidYMid meet"/>
    <image x="173" y="55" width="78" height="94" href="${ovcLogo}" xlink:href="${ovcLogo}" preserveAspectRatio="xMidYMid meet"/>
    ${text(290, 81, "SISAT 90 · SYSTEM FLOW", 19, 700, "#80dbec", 'letter-spacing="3"')}
    ${text(290, 132, title, 41, 700, C.white)}
    ${text(292, 167, subtitle, 20, 400, "#cbdfee")}
    ${pill(1768, 47, 93, `${index} / 2`, C.deep, C.white)}
    ${body}
    ${line(70, 1038, 1850, 1038, "#d3e3ed", 2)}
    ${text(80, 1064, "งานคืนสู่เหย้า 90 ปี วิทยาลัยเทคนิคศรีสะเกษ", 16, 600, C.muted)}
    ${text(1840, 1064, "DEMO WORKFLOW · 2026", 15, 700, C.muted, 'text-anchor="end" letter-spacing="1"')}
  </svg>`;
}

const adminBody = [
  rect(78, 231, 1764, 129, C.white, 20, C.line, 'stroke-width="2" filter="url(#shadow)"'),
  rect(78, 231, 10, 129, C.gold, 5),
  circle(142, 296, 33, "#fff3da"),
  text(142, 305, "★", 29, 700, C.gold, 'text-anchor="middle"'),
  text(192, 282, "SUPERADMIN · ผู้ดูแลระบบหลัก", 29, 700, C.deep),
  text(192, 322, "มอบหมายสิทธิ์ตามฝ่าย • คนเดียวถือหลายบทบาทได้ • ดูประวัติการเปลี่ยนแปลง", 21, 400, C.muted),
  pill(1488, 273, 300, "ควบคุมสิทธิ์จากจุดเดียว", C.gold, "#fff7e8"),
  line(960, 360, 960, 388),
  line(280, 388, 1640, 388),
  ...[280, 733, 1187, 1640].map((x) => line(x, 388, x, 422, "#9bb7ca", 5, true)),
  card(78, 438, 404, 280, { accent: C.cyan, kicker: "TABLE TEAM", title: "ฝ่ายโต๊ะจีน", number: "01", lines: ["จัดราคาโซน A–J / โต๊ะว่าง", "ช่วยลูกค้าจองหรือแก้โต๊ะ", "บันทึกอาหารและการแพ้"] }),
  card(531, 438, 404, 280, { accent: C.violet, kicker: "MERCH TEAM", title: "ฝ่ายของที่ระลึก", number: "02", lines: ["เพิ่ม/แก้สินค้า ภาพ ราคา สต็อก", "ช่วยเพิ่มหรือลดสินค้า", "สต็อกหักตามรายการที่กันไว้"] }),
  card(985, 438, 404, 280, { accent: C.green, kicker: "FINANCE TEAM", title: "ฝ่ายการเงิน", number: "03", lines: ["เปิดดูสลิปและตรวจยอดจริง", "อนุมัติหรือส่งกลับพร้อมเหตุผล", "อนุมัติแล้วจึงออกสิทธิ์"] }),
  card(1438, 438, 404, 280, { accent: C.gold, kicker: "EVENT TEAM", title: "ฝ่ายหน้างาน", number: "04", lines: ["ตรวจ QR ตั๋วเข้างาน", "ตรวจรหัสรับของที่ระลึก", "ป้องกันการใช้สิทธิ์ซ้ำ"] }),
  pill(108, 676, 297, "เชื่อมกับบัญชีลูกค้า", C.cyan, "#e9f8fc"),
  pill(561, 676, 297, "เชื่อมกับบัญชีลูกค้า", C.violet, "#f2edfa"),
  pill(1015, 676, 297, "ตรวจและยืนยันยอด", C.green, "#eaf7f1"),
  pill(1468, 676, 297, "ตรวจสิทธิ์หน้างาน", C.gold, "#fff6e4"),
  text(80, 768, "ทุกฝ่ายทำงานบนบัญชีลูกค้าและออเดอร์ชุดเดียวกัน", 25, 700, C.deep),
  text(80, 798, "เมนูที่เห็นขึ้นกับสิทธิ์ของเจ้าหน้าที่แต่ละคน และการแก้ไขรายการมีประวัติตรวจสอบ", 18, 400, C.muted),
  // The workflow below is shared by the roles above.
  card(78, 838, 490, 153, { accent: C.cyan, kicker: "CUSTOMER + ORDER", title: "บัญชีลูกค้า / คำสั่งซื้อ", lines: ["รับออเดอร์เองหรือเจ้าหน้าที่ช่วย"] }),
  card(627, 838, 348, 153, { accent: C.green, kicker: "PAYMENT", title: "ตรวจสลิป", lines: ["การเงินยืนยันยอดจริง"] }),
  card(1033, 838, 348, 153, { accent: C.violet, kicker: "ISSUANCE", title: "ตั๋ว / ใบรับของ", lines: ["ออกหลังอนุมัติ"] }),
  card(1439, 838, 403, 153, { accent: C.gold, kicker: "EVENT DAY", title: "เข้างาน / รับสินค้า", lines: ["ตรวจรหัสและบันทึกใช้สิทธิ์"] }),
  line(575, 914, 610, 914, "#9bb7ca", 5, true),
  line(982, 914, 1016, 914, "#9bb7ca", 5, true),
  line(1388, 914, 1422, 914, "#9bb7ca", 5, true),
].join("");

const customerBody = [
  rect(725, 231, 470, 90, C.white, 19, C.line, 'stroke-width="2" filter="url(#shadow)"'),
  circle(785, 276, 27, "#e7f4fa"),
  text(785, 284, "คน", 17, 700, C.cyan, 'text-anchor="middle"'),
  text(835, 271, "ลูกค้า / ศิษย์เก่า", 28, 700, C.deep),
  text(835, 300, "เลือกช่องทางที่สะดวกที่สุด", 17, 400, C.muted),
  pathArrow("M725 278 H516 V350", "#8fb0c4", 5),
  pathArrow("M1195 278 H1404 V350", "#8fb0c4", 5),
  // Online lane
  rect(78, 363, 825, 397, "#e8f7fc", 22, "#bce7f1", 'stroke-width="2"'),
  pill(111, 385, 314, "ทางที่ 1 · สั่งเองบนเว็บไซต์", C.cyan, C.white),
  card(111, 443, 758, 88, { accent: C.cyan, title: "เข้าสู่ระบบด้วยชื่อผู้ใช้ + รหัสผ่าน", lines: [] }),
  card(111, 546, 758, 88, { accent: C.cyan, title: "เลือกโต๊ะจีนหรือสินค้าที่ต้องการ", lines: [] }),
  card(111, 649, 758, 88, { accent: C.cyan, title: "ยืนยันออเดอร์ · กันโต๊ะ/สินค้า 20 นาที", lines: [] }),
  line(490, 531, 490, 542, "#8fb0c4", 4, true),
  line(490, 634, 490, 645, "#8fb0c4", 4, true),
  // Assisted lane
  rect(1017, 363, 825, 397, "#f3edfb", 22, "#d9cbed", 'stroke-width="2"'),
  pill(1050, 385, 358, "ทางที่ 2 · ให้เจ้าหน้าที่ช่วย", C.violet, C.white),
  card(1050, 443, 758, 88, { accent: C.violet, title: "แจ้งความต้องการทางโทรศัพท์ / LINE / เคาน์เตอร์", lines: [] }),
  card(1050, 546, 758, 88, { accent: C.violet, title: "เจ้าหน้าที่ค้นหาหรือสร้างบัญชีลูกค้า", lines: [] }),
  card(1050, 649, 758, 88, { accent: C.violet, title: "บันทึก/เพิ่ม/ลดออเดอร์ · ร่างสาธิตกันไว้ 30 วัน", lines: [] }),
  line(1429, 531, 1429, 542, "#8fb0c4", 4, true),
  line(1429, 634, 1429, 645, "#8fb0c4", 4, true),
  pathArrow("M490 760 V788 H752", "#8fb0c4", 5),
  pathArrow("M1429 760 V788 H1168", "#8fb0c4", 5),
  rect(610, 807, 700, 83, C.deep, 18, "none", 'filter="url(#shadow)"'),
  text(960, 844, "รวมในบัญชีลูกค้าเดียว", 27, 700, C.white, 'text-anchor="middle"'),
  text(960, 875, "ลูกค้ากลับมาตรวจสอบรายการและประวัติได้", 17, 400, "#cbe5f3", 'text-anchor="middle"'),
  line(960, 890, 960, 911, "#8fb0c4", 5, true),
  card(78, 929, 393, 86, { accent: C.cyan, title: "ลูกค้าอัปโหลดสลิป", lines: [] }),
  card(532, 929, 393, 86, { accent: C.green, title: "การเงินตรวจยอดจริง", lines: [] }),
  card(986, 929, 393, 86, { accent: C.violet, title: "รับตั๋ว / ใบรับสินค้า", lines: [] }),
  card(1440, 929, 402, 86, { accent: C.gold, title: "ตรวจสิทธิ์ในวันงาน", lines: [] }),
  line(478, 971, 515, 971, "#9bb7ca", 5, true),
  line(932, 971, 969, 971, "#9bb7ca", 5, true),
  line(1386, 971, 1423, 971, "#9bb7ca", 5, true),
].join("");

for (const [name, svg] of [
  ["01-admin-roles-flow", shell("ภาพรวมบทบาทเจ้าหน้าที่และการจัดการระบบ", "Superadmin มอบสิทธิ์ · ทีมงานรับผิดชอบคนละขั้น · ข้อมูลลูกค้าเชื่อมกัน", 1, adminBody)],
  ["02-customer-hybrid-flow", shell("เส้นทางลูกค้าแบบ Hybrid สองทาง", "เลือกสั่งเองบนเว็บ หรือให้เจ้าหน้าที่ช่วยผ่านโทรศัพท์ / LINE / เคาน์เตอร์", 2, customerBody)],
]) {
  writeFileSync(path.join(out, `${name}.svg`), svg);
  const png = await sharp(Buffer.from(svg)).resize({ width: 3840 }).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(path.join(out, `${name}.png`), png);
  console.log(path.join(out, `${name}.png`));
}
