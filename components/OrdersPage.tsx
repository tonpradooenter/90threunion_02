"use client";

import { useState } from "react";
import { ArrowLeft, BadgeCheck, ChevronDown, CircleHelp, Clock3, ShieldCheck, ShoppingBag, Ticket, UploadCloud, WalletCards } from "lucide-react";
import type { DemoOrder, DemoSnapshot } from "@/lib/demo-types";
import TicketPass from "./TicketPass";

const baht = (amount: number) => new Intl.NumberFormat("th-TH").format(amount);
const dateText = (date: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
const isExpired = (order: DemoOrder) => ["awaiting_slip", "assisted_draft"].includes(order.status) && Date.parse(order.holdUntil) <= Date.now();
const statusName: Record<DemoOrder["status"], string> = {
  awaiting_slip: "รออัปโหลดสลิป", assisted_draft: "เจ้าหน้าที่บันทึกให้ · รอชำระเงิน", under_review: "รอการเงินตรวจสอบ",
  needs_revision: "กรุณาส่งสลิปใหม่", approved: "ชำระเงินแล้ว", cancellation_review: "รอตรวจยอดก่อนยกเลิก",
  refund_pending: "รอคืนเงิน", refunded: "คืนเงินแล้ว", cancelled: "ยกเลิกแล้ว",
};

export default function OrdersPage({ orders, onBack, refresh, setToast, onCancel }: {
  orders: DemoOrder[]; onBack: () => void; refresh: () => Promise<DemoSnapshot>;
  setToast: (message: string) => void; onCancel: (orderId: string) => void;
}) {
  const [uploading, setUploading] = useState("");
  const upload = async (order: DemoOrder, file: File | undefined) => {
    if (!file) return;
    setUploading(order.id);
    try {
      const form = new FormData(); form.set("orderId", order.id); form.set("file", file);
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
      return <article key={order.id} className="order-card"><div className="order-head"><div><span className="order-id">{order.id}</span><small>{dateText(order.createdAt)}</small></div><span className={`status-badge status-${order.status}`}>{isExpired(order) ? "หมดเวลาจอง" : statusName[order.status]}</span></div>
        <div className="order-content"><div className="order-icon">{order.type === "table" ? <Ticket size={28} /> : <ShoppingBag size={28} />}</div><div><h3>{title}</h3><p>{order.type === "table" ? `${order.tableIds.length * 8} ที่นั่ง · ${order.meal}` : "รับสินค้าที่จุดบริการในวันงาน"}</p>{order.dietaryNotes && <p className="dietary-note">หมายเหตุอาหาร: {order.dietaryNotes}</p>}{order.paidAmount !== undefined && order.paidAmount !== order.amount && <p>ยอดชำระเดิม ฿{baht(order.paidAmount)} · ยอดรายการคงเหลือ ฿{baht(order.amount)}</p>}</div><strong className="order-price">฿{baht(order.amount)}</strong></div>
        {(fullyCancelled || !!order.cancelledItems?.length || !!order.cancelledTables?.length) && <div className="order-cancelled-lines"><strong>รายการที่ยกเลิก</strong>{fullyCancelled && <p>{order.type === "table" ? `โต๊ะ ${order.tableIds.join(", ")}` : order.items.map((item) => `${item.name} ×${item.quantity}`).join(", ")}</p>}{order.cancelledTables?.map((table) => <p key={table.id}>โต๊ะ {table.id} · {table.cancelReason}</p>)}{order.cancelledItems?.map((item, index) => <p key={`${item.id}-${index}`}>{item.name}{item.size ? ` (${item.size})` : ""} ×{item.quantity} · {item.cancelReason}</p>)}</div>}
        {!!order.refunds?.length && <div className="order-refund-box"><strong>สถานะการคืนเงิน</strong>{order.refunds.map((refund) => <p key={refund.id}>฿{baht(refund.amount)} · {refund.status === "pending" ? "รอฝ่ายการเงินคืนเงิน" : `คืนเงินแล้ว · อ้างอิง ${refund.reference ?? ""}`}</p>)}{pendingRefund.length > 0 && <small>ระบบสาธิตบันทึกงานคืนเงินโดยเจ้าหน้าที่ ไม่มีการโอนเงินอัตโนมัติ</small>}</div>}
        {order.history?.length ? <details className="order-history"><summary>ประวัติรายการ</summary>{order.history.map((entry, index) => <p key={index}>{dateText(entry.at)} · {entry.actor}: {entry.summary}</p>)}</details> : null}
        {order.financeComment && <div className="finance-comment"><CircleHelp size={17} /><span>ข้อความจากฝ่ายการเงิน: {order.financeComment}</span></div>}
        {["awaiting_slip", "assisted_draft"].includes(order.status) && !isExpired(order) && <div className="payment-panel"><div className="bank-placeholder"><WalletCards size={23} /><div><strong>ข้อมูลบัญชีรับเงินสาธิต</strong><span>ธนาคารและเลขบัญชีจริงจะแสดงเมื่อเปิดใช้งาน</span></div></div><p><Clock3 size={16} /> กรุณาอัปโหลดสลิปภายใน {dateText(order.holdUntil)}</p><label className="button button-dark upload-button"><UploadCloud size={18} /> {uploading === order.id ? "กำลังอัปโหลด..." : "เลือกภาพสลิป"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading === order.id} onChange={(event) => upload(order, event.target.files?.[0])} /></label></div>}
        {isExpired(order) && <div className="order-info"><Clock3 size={17} /> เวลากันรายการหมดแล้ว กรุณากลับไปเลือกใหม่</div>}
        {order.status === "needs_revision" && <div className="payment-panel"><p>ส่งสลิปใหม่ในรายการเดิมได้เลย</p><label className="button button-dark upload-button"><UploadCloud size={18} /> {uploading === order.id ? "กำลังอัปโหลด..." : "อัปโหลดสลิปใหม่"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading === order.id} onChange={(event) => upload(order, event.target.files?.[0])} /></label></div>}
        {order.status === "under_review" && <div className="order-info"><Clock3 size={17} /> ฝ่ายการเงินกำลังตรวจยอดก่อนออกตั๋ว</div>}
        {order.status === "cancellation_review" && <div className="order-info"><Clock3 size={17} /> ฝ่ายการเงินกำลังตรวจว่ามียอดชำระก่อนยกเลิกหรือไม่</div>}
        {order.status === "approved" && <div className="ticket-panel"><div className="ticket-panel-head"><BadgeCheck size={20} /><strong>{order.type === "table" ? "ตั๋วเข้างานพร้อมแล้ว" : "ใบรับสินค้าพร้อมแล้ว"}</strong></div>{order.type === "table" ? <details><summary>ดูตั๋ว {order.ticketCodes.length} ใบ <ChevronDown size={17} /></summary><div className="ticket-grid">{order.ticketCodes.map((code, index) => <TicketPass key={code} order={order} code={code} seatIndex={index} />)}</div></details> : order.pickupCode && <div className="ticket-grid"><TicketPass order={order} code={order.pickupCode} /></div>}</div>}
        {["awaiting_slip", "assisted_draft", "under_review", "needs_revision"].includes(order.status) && <button className="order-cancel" onClick={() => cancel(order)}>ยกเลิกรายการ</button>}
      </article>;
    })}</div><aside className="orders-help"><div className="help-sidebar-card"><ShieldCheck size={24} /><h3>ขั้นตอนการชำระเงิน</h3><ol><li>โอนเงินตามยอดที่แสดง</li><li>อัปโหลดภาพสลิปในรายการนี้</li><li>รอฝ่ายการเงินตรวจยอดจริง</li><li>รับตั๋วหรือใบรับของหลังอนุมัติ</li></ol><p>ระบบสาธิตยังไม่รับชำระเงินจริง</p></div></aside></div> : <div className="empty"><div className="empty-icon"><Ticket size={30} /></div><h3>ยังไม่มีคำสั่งซื้อ</h3><p>เริ่มจากเลือกโต๊ะหรือดูของที่ระลึก</p></div>}
  </section>;
}
