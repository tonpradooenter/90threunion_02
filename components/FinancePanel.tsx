"use client";

import { useState } from "react";
import { Check, CreditCard, Download, Search, WalletCards } from "lucide-react";
import type { DemoOrder, DemoSnapshot, OrderRefund } from "@/lib/demo-types";

type Action = (action: string, payload: Record<string, unknown>, success: string, after?: () => void) => Promise<unknown>;
const baht = (amount: number) => new Intl.NumberFormat("th-TH").format(amount);
const dateText = (date: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));

function Slip({ order }: { order: DemoOrder }) {
  const [open, setOpen] = useState(false);
  if (!order.slipFile) return <span className="muted">ไม่มีภาพสลิป</span>;
  return <div className="finance-slip"><button type="button" className="slip-link" onClick={() => setOpen((value) => !value)}><Search size={16} /> {open ? "ซ่อนสลิป" : "ดูสลิป"}</button>{open && <div className="slip-preview"><img src={`/api/slip?orderId=${encodeURIComponent(order.id)}`} alt={`สลิปของ ${order.id}`} /><a href={`/api/slip?orderId=${encodeURIComponent(order.id)}`} target="_blank" rel="noreferrer"><Download size={15} /> เปิดภาพเต็ม</a></div>}</div>;
}
function RefundTask({ order, refund, act, working }: { order: DemoOrder; refund: OrderRefund; act: Action; working: boolean }) {
  const [reference, setReference] = useState("");
  const complete = () => {
    if (!window.confirm(`ยืนยันว่าได้คืนเงินจริง ฿${baht(refund.amount)} แล้ว?`)) return;
    void act("completeRefund", { orderId: order.id, refundId: refund.id, reference }, "บันทึกคืนเงินเสร็จแล้ว");
  };
  return <div className="finance-task"><div><span className="finance-task-icon"><WalletCards size={20} /></span><div><strong>{order.id}</strong><small>{refund.reason} · {dateText(refund.requestedAt)}</small></div><b>฿{baht(refund.amount)}</b></div><label>เลขอ้างอิงการคืนเงินจริง<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="เช่น เลขธุรกรรม / เลขเอกสาร" /></label><button className="button button-dark button-small" type="button" disabled={working || reference.trim().length < 3} onClick={complete}><Check size={16} /> ยืนยันคืนเงินเสร็จ</button></div>;
}
function CancellationReview({ order, act, working }: { order: DemoOrder; act: Action; working: boolean }) {
  const [reference, setReference] = useState("");
  const resolve = (paymentFound: boolean) => {
    if (!window.confirm(paymentFound ? "ยืนยันว่าพบยอดชำระ และส่งรายการนี้ไปงานคืนเงิน?" : "ยืนยันว่าไม่พบยอดชำระ และปิดการยกเลิก?")) return;
    void act("resolveCancellation", { orderId: order.id, paymentFound, reference }, paymentFound ? "ส่งงานคืนเงินแล้ว" : "ปิดรายการที่ไม่พบยอดชำระแล้ว");
  };
  return <div className="finance-task"><div><span className="finance-task-icon"><CreditCard size={20} /></span><div><strong>{order.id}</strong><small>ลูกค้าขอยกเลิกหลังส่งสลิป · {dateText(order.createdAt)}</small></div><b>฿{baht(order.amount)}</b></div><Slip order={order} /><label>ผลตรวจ / เลขอ้างอิง<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="บันทึกหลักฐานการตรวจ" /></label><div className="finance-task-actions"><button type="button" className="button button-outline button-small" disabled={working || reference.trim().length < 3} onClick={() => resolve(false)}>ไม่พบยอด → ยกเลิก</button><button type="button" className="button button-dark button-small" disabled={working || reference.trim().length < 3} onClick={() => resolve(true)}>พบยอด → รอคืนเงิน</button></div></div>;
}
function PaymentReview({ order, act, working }: { order: DemoOrder; act: Action; working: boolean }) {
  const [comment, setComment] = useState("");
  return <div className="finance-task"><div><span className="finance-task-icon"><CreditCard size={20} /></span><div><strong>{order.id}</strong><small>{order.type === "table" ? `โต๊ะ ${order.tableIds.join(", ")}` : order.items.map((item) => item.name).join(", ")} · {dateText(order.createdAt)}</small></div><b>฿{baht(order.amount)}</b></div><Slip order={order} /><label>ข้อความถึงลูกค้าเมื่อขอสลิปใหม่<input value={comment} onChange={(event) => setComment(event.target.value)} /></label><div className="finance-task-actions"><button className="button button-outline button-small" disabled={working} onClick={() => act("reviewOrder", { orderId: order.id, decision: "revise", comment }, "ส่งคำขอแก้ไขแล้ว")}>ขอแก้ไข</button><button className="button button-dark button-small" disabled={working} onClick={() => act("reviewOrder", { orderId: order.id, decision: "approve", comment }, "อนุมัติและออกตั๋วแล้ว")}><Check size={16} /> อนุมัติ</button></div></div>;
}

export default function FinancePanel({ snapshot, act, working }: { snapshot: DemoSnapshot; act: Action; working: boolean }) {
  const review = snapshot.orders.filter((order) => order.status === "under_review");
  const cancellation = snapshot.orders.filter((order) => order.status === "cancellation_review");
  const refunds = snapshot.orders.flatMap((order) => (order.refunds ?? []).filter((refund) => refund.status === "pending").map((refund) => ({ order, refund })));
  return <div className="finance-workspace"><section className="admin-panel"><div className="panel-head"><div><span className="eyebrow">PAYMENT REVIEW</span><h2>ตรวจสลิป {review.length} รายการ</h2></div></div>{review.length ? review.map((order) => <PaymentReview key={order.id} order={order} act={act} working={working} />) : <p className="muted">ไม่มีสลิปรอตรวจ</p>}</section>
    <section className="admin-panel"><div className="panel-head"><div><span className="eyebrow">CANCELLATION REVIEW</span><h2>ตรวจยอดก่อนยกเลิก {cancellation.length} รายการ</h2></div></div>{cancellation.length ? cancellation.map((order) => <CancellationReview key={order.id} order={order} act={act} working={working} />) : <p className="muted">ไม่มีรายการรอตรวจยอดเพื่อยกเลิก</p>}</section>
    <section className="admin-panel"><div className="panel-head"><div><span className="eyebrow">REFUND QUEUE</span><h2>รอคืนเงิน {refunds.length} งาน</h2></div></div>{refunds.length ? refunds.map(({ order, refund }) => <RefundTask key={refund.id} order={order} refund={refund} act={act} working={working} />) : <p className="muted">ไม่มีงานคืนเงินค้างอยู่</p>}</section>
  </div>;
}
