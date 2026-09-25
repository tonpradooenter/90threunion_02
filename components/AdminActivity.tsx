"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Clock3, Search, ShoppingBag, Ticket, X } from "lucide-react";
import type { DemoOrder, DemoSnapshot, PublicUser, Role } from "@/lib/demo-types";

type ManageTab = "assisted" | "finance" | "gate";

const statusName: Record<DemoOrder["status"], string> = {
  awaiting_slip: "รออัปโหลดสลิป",
  assisted_draft: "เจ้าหน้าที่บันทึกให้ · รอชำระเงิน",
  under_review: "รอการเงินตรวจสอบ",
  needs_revision: "กรุณาส่งสลิปใหม่",
  approved: "ชำระเงินแล้ว",
  cancelled: "ยกเลิกแล้ว",
};
const channelName = { phone: "โทรศัพท์", line: "LINE", walkin: "ติดต่อที่หน้างาน", web: "เว็บไซต์" };
const baht = (amount: number) => new Intl.NumberFormat("th-TH").format(amount);
const dateText = (date: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
const statusLabel = (order: DemoOrder) => ["awaiting_slip", "assisted_draft"].includes(order.status) && Date.parse(order.holdUntil) <= Date.now() ? "หมดเวลาจอง" : statusName[order.status];
const hasRole = (user: PublicUser, role: Role) => (user.roles?.length ? user.roles : [user.role]).includes(role);

function managementTarget(me: PublicUser, order: DemoOrder): { tab: ManageTab; label: string } | null {
  if (order.status === "under_review" && (hasRole(me, "finance") || hasRole(me, "superadmin"))) {
    return { tab: "finance", label: "ไปหน้าตรวจสลิป" };
  }
  if (["awaiting_slip", "assisted_draft", "needs_revision"].includes(order.status)
    && (hasRole(me, "superadmin") || hasRole(me, order.type === "table" ? "tables" : "merch"))) {
    return { tab: "assisted", label: "ไปหน้าช่วยลูกค้าสั่งจอง" };
  }
  if (order.status === "approved" && (hasRole(me, "gate") || hasRole(me, "superadmin"))) {
    return { tab: "gate", label: "ไปหน้าตรวจสิทธิ์" };
  }
  return null;
}

export default function AdminActivity({ snapshot, onManage }: { snapshot: DemoSnapshot; onManage: (tab: ManageTab) => void }) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const me = snapshot.me!;
  const selected = snapshot.orders.find((order) => order.id === selectedId);
  const customer = selected ? snapshot.orderCustomers.find((person) => person.id === selected.userId) : undefined;
  const target = selected ? managementTarget(me, selected) : null;
  const orders = useMemo(() => [...snapshot.orders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [snapshot.orders]);
  const visible = showAll
    ? orders.filter((order) => {
      const person = snapshot.orderCustomers.find((entry) => entry.id === order.userId);
      const haystack = [order.id, person?.displayName, person?.username, ...order.tableIds, ...order.items.map((item) => item.name)].join(" ").toLocaleLowerCase();
      return haystack.includes(query.trim().toLocaleLowerCase());
    })
    : orders.slice(0, 5);

  useEffect(() => {
    if (!selectedId) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedId(null); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedId]);

  return <>
    <section className="admin-panel activity-panel">
      <div className="panel-head"><div><span className="eyebrow">LIVE ACTIVITY</span><h2>สถานะคำสั่งซื้อล่าสุด</h2></div>{orders.length > 5 && <button type="button" className="activity-all" onClick={() => setShowAll((value) => !value)}>{showAll ? "แสดงล่าสุด" : `ดูทั้งหมด ${orders.length} รายการ`}</button>}</div>
      {showAll && <label className="activity-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหารหัสออเดอร์ ชื่อลูกค้า โต๊ะ หรือสินค้า" aria-label="ค้นหาคำสั่งซื้อ" /></label>}
      {visible.length ? visible.map((order) => <button type="button" className="activity-row activity-button" key={order.id} onClick={() => setSelectedId(order.id)} aria-label={`ดูรายละเอียด ${order.id}`}>
        <span className="activity-icon">{order.type === "table" ? <Ticket size={18} /> : <ShoppingBag size={18} />}</span>
        <span className="activity-copy"><strong>{order.id}</strong><small>{order.type === "table" ? `โต๊ะ ${order.tableIds.join(", ")}` : order.items.map((item) => `${item.name} ×${item.quantity}`).join(", ")}</small></span>
        <span className={`status-badge status-${order.status}`}>{statusLabel(order)}</span><ChevronRight className="activity-chevron" size={17} />
      </button>) : <div className="activity-empty"><Clock3 size={24} /><span>{orders.length ? "ไม่พบคำสั่งซื้อที่ค้นหา" : "ยังไม่มีคำสั่งซื้อ"}</span></div>}
      <p className="activity-hint">เจ้าหน้าที่ทุกฝ่ายกดดูรายละเอียดและสถานะได้ · การจัดการขึ้นกับสิทธิ์ของแต่ละฝ่าย</p>
    </section>
    {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
      <section className="activity-modal" role="dialog" aria-modal="true" aria-labelledby="activity-detail-title">
        <div className="activity-modal-head"><div><span className="eyebrow">ORDER DETAILS · ดูข้อมูล</span><h2 id="activity-detail-title">{selected.type === "table" ? "รายการจองโต๊ะจีน" : "รายการของที่ระลึก"}</h2><p>{selected.id}</p></div><button type="button" className="modal-close" onClick={() => setSelectedId(null)} aria-label="ปิดรายละเอียด"><X size={20} /></button></div>
        <div className="activity-modal-body">
          <div className="activity-detail-status"><span className={`status-badge status-${selected.status}`}>{statusLabel(selected)}</span><strong>฿{baht(selected.amount)}</strong></div>
          <dl className="activity-detail-grid"><div><dt>ลูกค้า</dt><dd>{customer ? `${customer.displayName} (${customer.username})` : selected.userId}</dd></div><div><dt>วันที่สั่ง</dt><dd>{dateText(selected.createdAt)}</dd></div><div><dt>ช่องทาง</dt><dd>{selected.channel ? channelName[selected.channel] : "เว็บไซต์"}</dd></div><div><dt>กำหนดชำระ</dt><dd>{dateText(selected.holdUntil)}</dd></div></dl>
          <div className="activity-detail-section"><h3>รายการที่สั่ง</h3>{selected.type === "table" ? <><p className="activity-item-name">โต๊ะ {selected.tableIds.join(", ")}</p><p>{selected.tableIds.length} โต๊ะ · {selected.tableIds.length * 8} ที่นั่ง · {selected.meal}</p>{selected.dietaryNotes && <p>ข้อจำกัดอาหาร: {selected.dietaryNotes}</p>}</> : selected.items.map((item, index) => <p className="activity-item-name" key={`${item.productId}-${item.size ?? ""}-${index}`}>{item.name}{item.size ? ` · ไซซ์ ${item.size}` : ""} ×{item.quantity} <span>฿{baht(item.unitPrice * item.quantity)}</span></p>)}</div>
          {selected.financeComment && <div className="activity-detail-section"><h3>ข้อความจากฝ่ายการเงิน</h3><p>{selected.financeComment}</p></div>}
          {selected.reviewedAt && <div className="activity-detail-section"><h3>การตรวจสอบ</h3><p>ตรวจเมื่อ {dateText(selected.reviewedAt)}{selected.reviewedBy ? ` · โดย ${selected.reviewedBy}` : ""}</p></div>}
          {selected.type === "product" && selected.pickedUpAt && <div className="activity-detail-section"><h3>การรับสินค้า</h3><p>รับสินค้าแล้วเมื่อ {dateText(selected.pickedUpAt)}</p></div>}
          {selected.history?.length ? <div className="activity-detail-section"><h3>ประวัติรายการ</h3>{selected.history.map((entry, index) => <p key={`${entry.at}-${index}`}>{dateText(entry.at)} · {entry.actor}: {entry.summary}</p>)}</div> : null}
          <p className="activity-readonly">หน้ารายละเอียดนี้ใช้ดูข้อมูลเท่านั้น การแก้ไขรายการทำได้ในหน้าของฝ่ายที่มีสิทธิ์</p>
        </div>
        <div className="activity-modal-footer"><button type="button" className="button button-outline" onClick={() => setSelectedId(null)}>ปิด</button>{target && <button type="button" className="button button-dark" onClick={() => { setSelectedId(null); onManage(target.tab); }}>{target.label}<ChevronRight size={17} /></button>}</div>
      </section>
    </div>}
  </>;
}
