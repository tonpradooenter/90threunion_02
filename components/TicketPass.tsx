"use client";

import { QRCodeSVG } from "qrcode.react";
import { BadgeCheck, MapPin, ShoppingBag, Ticket } from "lucide-react";
import type { DemoOrder } from "@/lib/demo-types";

export default function TicketPass({ order, code, seatIndex }: { order: DemoOrder; code: string; seatIndex?: number }) {
  const table = order.type === "table";
  const tableId = table ? order.tableIds[Math.floor((seatIndex ?? 0) / 8)] : "";
  const used = table ? order.checkedInCodes.includes(code) : !!order.pickedUpAt;
  const seat = table ? (seatIndex ?? 0) % 8 + 1 : 0;
  return <article className={`event-ticket ${used ? "event-ticket-used" : ""}`} aria-label={table ? `ตั๋วโต๊ะ ${tableId} ที่นั่ง ${seat}` : `ใบรับสินค้า ${code}`}>
    <div className="event-ticket-header"><img src="/assets/event-mark-transparent.png" alt="ตรางาน 90 ปี" /><div><small>SISAT 90 · HOMECOMING</small><strong>คืนสู่เหย้า 90 ปี</strong><span>วิทยาลัยเทคนิคศรีสะเกษ</span></div><img src="/assets/ovc-seal-transparent.png" alt="ตรา สอศ." /></div>
    <div className="event-ticket-body"><div className="event-ticket-info"><span className="event-ticket-type">{table ? <Ticket size={15} /> : <ShoppingBag size={15} />}{table ? "บัตรเข้างาน · DINNER & CONCERT" : "ใบรับสินค้า · MERCH PICKUP"}</span><h3>{table ? `โซน ${tableId[0]} · โต๊ะ ${tableId}` : "ของที่ระลึก 90 ปี"}</h3><p>{table ? `สิทธิ์ที่นั่ง ${seat} จาก 8 ที่นั่งต่อโต๊ะ` : order.items.map((item) => `${item.name} ×${item.quantity}`).join(" · ")}</p><div className="event-ticket-place"><MapPin size={14} /> วิทยาลัยเทคนิคศรีสะเกษ · วันจัดงานจะแจ้งภายหลัง</div></div><div className="event-ticket-qr"><QRCodeSVG value={code} size={132} marginSize={2} level="M" bgColor="#ffffff" fgColor="#102f61" /><small>สแกนเพื่อตรวจสิทธิ์</small></div></div>
    <div className="event-ticket-footer"><div><small>ORDER NO.</small><strong>{order.id}</strong></div><div><small>VERIFICATION CODE</small><strong>{code}</strong></div><span className={used ? "used" : "ready"}><BadgeCheck size={15} />{used ? table ? "ใช้เข้างานแล้ว" : "รับสินค้าแล้ว" : "พร้อมใช้งาน"}</span></div>
  </article>;
}
