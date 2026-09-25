"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, ChevronDown, CircleHelp, Clock3, ShieldCheck, ShoppingBag, Ticket, UploadCloud, WalletCards } from "lucide-react";
import type { DemoOrder, DemoSnapshot } from "@/lib/demo-types";
import TicketPass from "./TicketPass";

const baht = (amount: number) => new Intl.NumberFormat("th-TH").format(amount);
const dateText = (date: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
const isExpired = (order: DemoOrder, now: number) => ["awaiting_slip", "assisted_draft", "needs_revision"].includes(order.status) && Date.parse(order.holdUntil) <= now;
const statusName: Record<DemoOrder["status"], string> = {
  awaiting_slip: "รออัปโหลดสลิป", assisted_draft: "เจ้าหน้าที่บันทึกให้ · รอชำระเงิน", under_review: "รอการเงินตรวจสอบ",
  needs_revision: "กรุณาส่งสลิปใหม่", approved: "ชำระเงินแล้ว", cancellation_review: "รอตรวจยอดก่อนยกเลิก",
  refund_pending: "รอคืนเงิน", refunded: "คืนเงินแล้ว", cancelled: "ยกเลิกแล้ว",
};

function remainingText(until: string, now: number): string {
  const seconds = Math.max(0, Math.ceil((Date.parse(until) - now) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const last = seconds % 60;
  return `${days ? `${days} วัน ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(last).padStart(2, "0")}`;
}

function SlipPanel({ order, now, uploading, upload }: { order: DemoOrder; now: number; uploading: boolean; upload: (order: DemoOrder, files: FileList | null) => void }) {
  const images = order.slips ?? [];
  const revising = order.status === "needs_revision";
  const reviewing = order.status === "under_review";
  const canUpload = revising || !reviewing || images.length < 3;
  return <div className="payment-panel">
    {!reviewing && <><div className="bank-placeholder"><WalletCards size={23} /><div><strong>ข้อมูลบัญชีรับเงินสาธิต</strong><span>ธนาคารและเลขบัญชีจริงจะแสดงเมื่อเปิดใช้งาน</span></div></div>
      <p><Clock3 size={16} /> {revising ? "กรุณาส่งสลิปใหม่" : "กรุณาอัปโหลดสลิป"}ภายใน {dateText(order.holdUntil)}</p>
      <div className="order-countdown" role="timer" aria-label="เวลาที่เหลือสำหรับส่งสลิป">เหลือเวลา <strong>{remainingText(order.holdUntil, now)}</strong></div></>}
    {images.length > 0 && <div className="customer-slip-list"><strong>{images.length} / 3 รูปที่ส่งแล้ว</strong><div>{images.map((image, index) => <a key={image.id} href={`/api/slip?orderId=${encodeURIComponent(order.id)}&slipId=${encodeURIComponent(image.id)}`} target="_blank" rel="noreferrer"><img src={`/api/slip?orderId=${encodeURIComponent(order.id)}&slipId=${encodeURIComponent(image.id)}`} alt={`สลิป ${index + 1}`} /><span>รูป {index + 1}</span></a>)}</div></div>}
    {canUpload && <label className="button button-dark upload-button"><UploadCloud size={18} /> {uploading ? "กำลังอัปโหลด..." : revising ? "เลือกสลิปใหม่ 1–3 รูป" : reviewing ? "เพิ่มภาพสลิป" : "เลือกสลิป 1–3 รูป"}
      <input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => { upload(order, event.target.files); event.target.value = ""; }} /></label>}
    <small className="slip-help">PNG, JPG หรือ WebP · สูงสุด 5 MB ต่อรูป · ไม่เกิน 3 รูปต่อออเดอร์{revising ? " · สลิปชุดใหม่จะแทนชุดเดิม" : ""}</small>
  </div>;
}
export default function OrdersPage({ orders, onBack, refresh, setToast, onCancel }: {
  orders: DemoOrder[]; onBack: () => void; refresh: () => Promise<DemoSnapshot>;
  setToast: (message: string) => void; onCancel: (orderId: string) => void;
}) {
  const [uploading, setUploading] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const upload = async (order: DemoOrder, selected: FileList | null) => {
    const files = Array.from(selected ?? []);
    if (!files.length) return;
    if (files.length > 3 || files.some((file) => file.size > 5_000_000)) { setToast("เลือกไม่เกิน 3 รูป รูปละไม่เกิน 5 MB"); return; }
    if (order.status !== "needs_revision" && (order.slips?.length ?? 0) + files.length > 3) { setToast("ออเดอร์นี้มีสลิปเกิน 3 รูป"); return; }
    setUploading(order.id);
    try {
      const form = new FormData(); form.set("orderId", order.id);
      files.forEach((file) => form.append("files", file));
      const response = await fetch("/api/slip", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await refresh(); setToast("ส่งสลิปให้ฝ่ายการเงินตรวจแล้ว");
    } catch (error) { setToast(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ"); }
    finally { setUploading(""); }
  };
  const cancel = (order: DemoOrder) => {
    if (!window.confirm(order.status === "under_review" ? "ส่งคำขอยกเลิกให้ฝ่ายการเงินตรวจยอดชำระก่อนใช่ไหม?" : "ยืนยันยกเลิกคำสั่งซื้อนี้? รายการจะยังอยู่ในประวัติ")) return;
    onCancel(order.id);
  };

  return <section className="inner-page container"><div className="page-heading"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> กลับหน้าแรก</button><span className="eyebrow">MY SISAT 90</span><h1>คำสั่งซื้อ <em>และตั๋วของฉัน</em></h1><p>ติดตามการชำระเงิน การยกเลิก งานคืนเงิน และสิทธิ์รับของ</p></div>
    {orders.length ? <div className="orders-layout"><div className="orders-list">{orders.map((order) => {
      const fullyCancelled = ["cancelled", "refund_pending", "refunded"].includes(order.status);
      const pendingRefund = (order.refunds ?? []).filter((refund) => refund.status === "pending");
      const title = order.type === "table" ? `โต๊ะจีน ${order.tableIds.join(", ")}` : order.items.map((item) => `${item.name}${item.size ? ` (${item.size})` : ""} ×${item.quantity}`).join(", ");
      return <article key={order.id} className="order-card"><div className="order-head"><div><span className="order-id">{order.id}</span><small>{dateText(order.createdAt)}</small></div><span className={`status-badge status-${order.status}`}>{isExpired(order, now) ? "หมดเวลาจอง" : statusName[order.status]}</span></div>
        <div className="order-content"><div className="order-icon">{order.type === "table" ? <Ticket size={28} /> : <ShoppingBag size={28} />}</div><div><h3>{title}</h3><p>{order.type === "table" ? `${order.tableIds.length * 8} ที่นั่ง · ${order.meal}` : "รับสินค้าที่จุดบริการในวันงาน"}</p>{order.dietaryNotes && <p className="dietary-note">หมายเหตุอาหาร: {order.dietaryNotes}</p>}{order.paidAmount !== undefined && order.paidAmount !== order.amount && <p>ยอดชำระเดิม ฿{baht(order.paidAmount)} · ยอดรายการคงเหลือ ฿{baht(order.amount)}</p>}</div><strong className="order-price">฿{baht(order.amount)}</strong></div>
        {(fullyCancelled || !!order.cancelledItems?.length || !!order.cancelledTables?.length) && <div className="order-cancelled-lines"><strong>รายการที่ยกเลิก</strong>{fullyCancelled && <p>{order.type === "table" ? `โต๊ะ ${order.tableIds.join(", ")}` : order.items.map((item) => `${item.name} ×${item.quantity}`).join(", ")}</p>}{order.cancelledTables?.map((table) => <p key={table.id}>โต๊ะ {table.id} · {table.cancelReason}</p>)}{order.cancelledItems?.map((item, index) => <p key={`${item.id}-${index}`}>{item.name}{item.size ? ` (${item.size})` : ""} ×{item.quantity} · {item.cancelReason}</p>)}</div>}
        {!!order.refunds?.length && <div className="order-refund-box"><strong>สถานะการคืนเงิน</strong>{order.refunds.map((refund) => <p key={refund.id}>฿{baht(refund.amount)} · {refund.status === "pending" ? "รอฝ่ายการเงินคืนเงิน" : `คืนเงินแล้ว · อ้างอิง ${refund.reference ?? ""}`}</p>)}{pendingRefund.length > 0 && <small>ระบบสาธิตบันทึกงานคืนเงินโดยเจ้าหน้าที่ ไม่มีการโอนเงินอัตโนมัติ</small>}</div>}
        {order.history?.length ? <details className="order-history"><summary>ประวัติรายการ</summary>{order.history.map((entry, index) => <p key={index}>{dateText(entry.at)} · {entry.actor}: {entry.summary}</p>)}</details> : null}
        {order.financeComment && <div className="finance-comment"><CircleHelp size={17} /><span>ข้อความจากฝ่ายการเงิน: {order.financeComment}</span></div>}
        {["awaiting_slip", "assisted_draft", "needs_revision", "under_review"].includes(order.status) && !isExpired(order, now) && <SlipPanel order={order} now={now} uploading={uploading === order.id} upload={(target, files) => { void upload(target, files); }} />}
        {isExpired(order, now) && <div className="order-info"><Clock3 size={17} /> เวลากันรายการหมดแล้ว กรุณากลับไปเลือกใหม่</div>}
        {order.status === "under_review" && <div className="order-info"><Clock3 size={17} /> ฝ่ายการเงินกำลังตรวจยอดก่อนออกตั๋ว</div>}
        {order.status === "cancellation_review" && <div className="order-info"><Clock3 size={17} /> ฝ่ายการเงินกำลังตรวจว่ามียอดชำระก่อนยกเลิกหรือไม่</div>}
        {order.status === "approved" && <div className="ticket-panel"><div className="ticket-panel-head"><BadgeCheck size={20} /><strong>{order.type === "table" ? "ตั๋วเข้างานพร้อมแล้ว" : "ใบรับสินค้าพร้อมแล้ว"}</strong></div>{order.type === "table" ? <details><summary>ดูตั๋ว {order.ticketCodes.length} ใบ <ChevronDown size={17} /></summary><div className="ticket-grid">{order.ticketCodes.map((code, index) => <TicketPass key={code} order={order} code={code} seatIndex={index} />)}</div></details> : order.pickupCode && <div className="ticket-grid"><TicketPass order={order} code={order.pickupCode} /></div>}</div>}
        {["awaiting_slip", "assisted_draft", "under_review", "needs_revision"].includes(order.status) && <button className="order-cancel" onClick={() => cancel(order)}>ยกเลิกรายการ</button>}
      </article>;
    })}</div><aside className="orders-help"><div className="help-sidebar-card"><ShieldCheck size={24} /><h3>ขั้นตอนการชำระเงิน</h3><ol><li>โอนเงินตามยอดที่แสดง</li><li>อัปโหลดภาพสลิปในรายการนี้</li><li>รอฝ่ายการเงินตรวจยอดจริง</li><li>รับตั๋วหรือใบรับของหลังอนุมัติ</li></ol><p>ระบบสาธิตยังไม่รับชำระเงินจริง</p></div></aside></div> : <div className="empty"><div className="empty-icon"><Ticket size={30} /></div><h3>ยังไม่มีคำสั่งซื้อ</h3><p>เริ่มจากเลือกโต๊ะหรือดูของที่ระลึก</p></div>}
  </section>;
}
