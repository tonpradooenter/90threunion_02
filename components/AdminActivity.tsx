"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Clock3, Download, Search, ShoppingBag, Ticket, UserRound, X } from "lucide-react";
import type { DemoOrder, DemoSnapshot, PublicUser, Role } from "@/lib/demo-types";

type ManageTab = "assisted" | "finance" | "gate";
type CustomerResult = { id: string; displayName: string; username: string; phone?: string; orderCount: number };

const statusName: Record<DemoOrder["status"], string> = {
  awaiting_slip: "รออัปโหลดสลิป", assisted_draft: "เจ้าหน้าที่บันทึกให้ · รอชำระเงิน",
  under_review: "รอการเงินตรวจสอบ", needs_revision: "กรุณาส่งสลิปใหม่", approved: "ชำระเงินแล้ว",
  cancellation_review: "รอตรวจยอดก่อนยกเลิก", refund_pending: "รอคืนเงิน", refunded: "คืนเงินแล้ว", cancelled: "ยกเลิกแล้ว",
};
const channelName = { phone: "โทรศัพท์", line: "LINE", walkin: "ติดต่อที่หน้างาน", web: "เว็บไซต์" };
const baht = (amount: number) => new Intl.NumberFormat("th-TH").format(amount);
const dateText = (date: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
const statusLabel = (order: DemoOrder) => ["awaiting_slip", "assisted_draft"].includes(order.status) && Date.parse(order.holdUntil) <= Date.now() ? "หมดเวลาจอง" : statusName[order.status];
const hasRole = (user: PublicUser, role: Role) => (user.roles?.length ? user.roles : [user.role]).includes(role);

function managementTarget(me: PublicUser, order: DemoOrder): { tab: ManageTab; label: string } | null {
  if ((order.status === "under_review" || order.status === "cancellation_review" || order.refunds?.some((refund) => refund.status === "pending")) && (hasRole(me, "finance") || hasRole(me, "superadmin"))) return { tab: "finance", label: "ไปงานฝ่ายการเงิน" };
  if (["awaiting_slip", "assisted_draft", "needs_revision", "approved"].includes(order.status) && (hasRole(me, "superadmin") || hasRole(me, order.type === "table" ? "tables" : "merch"))) return { tab: "assisted", label: "ไปหน้าช่วยลูกค้าสั่งจอง" };
  if (order.status === "approved" && (hasRole(me, "gate") || hasRole(me, "superadmin"))) return { tab: "gate", label: "ไปหน้าตรวจสิทธิ์" };
  return null;
}

export default function AdminActivity({ snapshot, onManage }: { snapshot: DemoSnapshot; onManage: (tab: ManageTab) => void }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [customers, setCustomers] = useState<CustomerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const me = snapshot.me!;
  const selected = snapshot.orders.find((order) => order.id === selectedId);
  const target = selected ? managementTarget(me, selected) : null;
  const orders = useMemo(() => snapshot.orders.filter((order) => order.userId === selectedCustomer?.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [snapshot.orders, selectedCustomer?.id]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/staff/customers?q=${encodeURIComponent(query)}&page=${page}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("ค้นหาลูกค้าไม่สำเร็จ");
        const body = await response.json() as { customers: CustomerResult[] };
        setCustomers(body.customers);
        setSearchError("");
      } catch (error) {
        if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : "ค้นหาลูกค้าไม่สำเร็จ");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, page]);

  useEffect(() => {
    if (!selectedId) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedId(null); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [selectedId]);

  return <>
    <section className="admin-panel activity-panel customer-overview">
      <div className="panel-head"><div><span className="eyebrow">CUSTOMER OVERVIEW</span><h2>{selectedCustomer ? `รายการของ ${selectedCustomer.displayName}` : "ค้นหาและเลือกบัญชีลูกค้า"}</h2></div><a className="activity-all" href={selectedCustomer ? `/api/export?customerId=${encodeURIComponent(selectedCustomer.id)}` : "/api/export"}><Download size={16} /> CSV</a></div>
      {selectedCustomer ? <>
        <button className="activity-back" type="button" onClick={() => setSelectedCustomer(null)}><ArrowLeft size={16} /> กลับไปค้นหาลูกค้า</button>
        <div className="customer-overview-selected"><span className="customer-overview-avatar"><UserRound size={22} /></span><div><strong>{selectedCustomer.displayName}</strong><small>ID {selectedCustomer.id} · @{selectedCustomer.username}{selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}</small></div></div>
        <p className="customer-overview-caption">{orders.length} คำสั่งซื้อ · กดรายการเพื่อดูรายละเอียดและสถานะ</p>
        {orders.length ? orders.map((order) => <button type="button" className="activity-row activity-button" key={order.id} onClick={() => setSelectedId(order.id)} aria-label={`ดูรายละเอียด ${order.id}`}>
          <span className="activity-icon">{order.type === "table" ? <Ticket size={18} /> : <ShoppingBag size={18} />}</span>
          <span className="activity-copy"><strong>{order.type === "table" ? `โต๊ะ ${order.tableIds.join(", ")}` : order.items.map((item) => `${item.name} ×${item.quantity}`).join(", ")}</strong><small>{order.id} · {dateText(order.createdAt)}</small></span>
          <span className={`status-badge status-${order.status}`}>{statusLabel(order)}</span><ChevronRight className="activity-chevron" size={17} />
        </button>) : <div className="activity-empty"><Clock3 size={24} /><span>บัญชีนี้ยังไม่มีคำสั่งซื้อ</span></div>}
      </> : <>
        <label className="activity-search"><Search size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="ค้นหาชื่อลูกค้า ID ชื่อผู้ใช้ หรือเบอร์โทร" aria-label="ค้นหาบัญชีลูกค้า" /></label>
        {searchError && <p className="activity-error">{searchError}</p>}
        {loading ? <p className="customer-overview-caption">กำลังค้นหา...</p> : customers.length ? <div className="customer-overview-list">{customers.map((person) => <button type="button" key={person.id} onClick={() => setSelectedCustomer(person)}><span className="customer-overview-avatar">{person.displayName[0]}</span><span><strong>{person.displayName}</strong><small>ID {person.id} · @{person.username}{person.phone ? ` · ${person.phone}` : ""}</small></span><em>{person.orderCount} รายการ</em><ChevronRight size={17} /></button>)}</div> : !searchError && <div className="activity-empty"><UserRound size={24} /><span>ไม่พบบัญชีลูกค้าที่ค้นหา</span></div>}
        <div className="customer-overview-pagination"><button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>ก่อนหน้า</button><span>หน้า {page + 1}</span><button type="button" disabled={customers.length < 50 || loading} onClick={() => setPage((value) => value + 1)}>ถัดไป</button></div>
      </>}
      <p className="activity-hint">ข้อมูลทุกฝ่ายดูร่วมกันได้ · การแก้ไขต้องไปหน้าช่วยสั่งจองและมีสิทธิ์ในงานนั้น</p>
    </section>
    {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}><section className="activity-modal" role="dialog" aria-modal="true" aria-labelledby="activity-detail-title">
      <div className="activity-modal-head"><div><span className="eyebrow">ORDER DETAILS · ดูข้อมูล</span><h2 id="activity-detail-title">{selected.type === "table" ? "รายการจองโต๊ะจีน" : "รายการของที่ระลึก"}</h2><p>{selected.id}</p></div><button type="button" className="modal-close" onClick={() => setSelectedId(null)} aria-label="ปิดรายละเอียด"><X size={20} /></button></div>
      <div className="activity-modal-body"><div className="activity-detail-status"><span className={`status-badge status-${selected.status}`}>{statusLabel(selected)}</span><strong>฿{baht(selected.amount)}</strong></div>
        <dl className="activity-detail-grid"><div><dt>ลูกค้า</dt><dd>{selectedCustomer?.displayName} (@{selectedCustomer?.username})</dd></div><div><dt>วันที่สั่ง</dt><dd>{dateText(selected.createdAt)}</dd></div><div><dt>ช่องทาง</dt><dd>{selected.channel ? channelName[selected.channel] : "เว็บไซต์"}</dd></div><div><dt>กำหนดชำระ</dt><dd>{dateText(selected.holdUntil)}</dd></div></dl>
        <div className="activity-detail-section"><h3>รายการที่สั่ง</h3>{selected.type === "table" ? <><p className="activity-item-name">โต๊ะ {selected.tableIds.join(", ")}</p><p>{selected.tableIds.length} โต๊ะ · {selected.tableIds.length * 8} ที่นั่ง · {selected.meal}</p>{selected.dietaryNotes && <p>ข้อจำกัดอาหาร: {selected.dietaryNotes}</p>}</> : selected.items.map((item) => <p className="activity-item-name" key={item.id ?? item.productId}>{item.name}{item.size ? ` · ${item.size}` : ""} ×{item.quantity} <span>฿{baht(item.unitPrice * item.quantity)}</span></p>)}
          {selected.cancelledTables?.map((table) => <p className="activity-item-cancelled" key={table.id}>โต๊ะ {table.id} · ยกเลิกแล้ว</p>)}{selected.cancelledItems?.map((item, index) => <p className="activity-item-cancelled" key={`${item.id}-${index}`}>{item.name}{item.size ? ` · ${item.size}` : ""} ×{item.quantity} · ยกเลิกแล้ว</p>)}</div>
        {selected.refunds?.length ? <div className="activity-detail-section"><h3>งานคืนเงิน</h3>{selected.refunds.map((refund) => <p key={refund.id}>฿{baht(refund.amount)} · {refund.status === "pending" ? "รอฝ่ายการเงินคืนเงิน" : `คืนเงินแล้ว · ${refund.reference ?? ""}`}</p>)}</div> : null}
        {selected.financeComment && <div className="activity-detail-section"><h3>ข้อความจากฝ่ายการเงิน</h3><p>{selected.financeComment}</p></div>}
        {selected.history?.length ? <div className="activity-detail-section"><h3>ประวัติรายการ</h3>{selected.history.map((entry, index) => <p key={`${entry.at}-${index}`}>{dateText(entry.at)} · {entry.actor}: {entry.summary}</p>)}</div> : null}
        <p className="activity-readonly">หน้านี้ใช้ดูข้อมูลเท่านั้น การแก้ไขทำในหน้าของฝ่ายที่มีสิทธิ์</p>
      </div>
      <div className="activity-modal-footer"><button type="button" className="button button-outline" onClick={() => setSelectedId(null)}>ปิด</button>{target && <button type="button" className="button button-dark" onClick={() => { setSelectedId(null); onManage(target.tab); }}>{target.label}<ChevronRight size={17} /></button>}</div>
    </section></div>}
  </>;
}
