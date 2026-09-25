"use client";

import { useState } from "react";
import { ArrowRight, Check, HeartHandshake, Minus, Plus, Search, ShoppingBag, Ticket, Trash2, UserPlus } from "lucide-react";
import type { DemoOrder, DemoSnapshot, Product, PublicUser } from "@/lib/demo-types";

type Action = (action: string, payload: Record<string, unknown>, success: string, after?: () => void) => Promise<unknown>;
type Line = { productId: string; quantity: number; size: string };
const baht = (n: number) => new Intl.NumberFormat("th-TH").format(n);
const roles = (user: PublicUser) => user.roles?.length ? user.roles : [user.role];
const editable = (order: DemoOrder) => ["assisted_draft", "awaiting_slip", "needs_revision"].includes(order.status);

export default function AssistedPanel({ snapshot, act, working }: { snapshot: DemoSnapshot; act: Action; working: boolean }) {
  const me = snapshot.me!;
  const canTables = roles(me).includes("superadmin") || roles(me).includes("tables");
  const canMerch = roles(me).includes("superadmin") || roles(me).includes("merch");
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState(snapshot.customers.find((user) => user.username === "customer")?.id ?? snapshot.customers[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [source, setSource] = useState<"phone" | "line" | "walkin">("phone");
  const [type, setType] = useState<"table" | "product">(canTables ? "table" : "product");
  const [editingId, setEditingId] = useState("");
  const [zoneId, setZoneId] = useState("A");
  const [tableIds, setTableIds] = useState<string[]>([]);
  const [meal, setMeal] = useState("ชุดอาหารมาตรฐาน");
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [channel, setChannel] = useState<"phone" | "line" | "walkin">("phone");
  const [cancelId, setCancelId] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const customer = snapshot.customers.find((user) => user.id === customerId);
  const customerOrders = snapshot.orders.filter((order) => order.userId === customerId);
  const ownOrder = snapshot.orders.find((order) => order.id === editingId);
  const products = snapshot.products.filter((product) => product.active);
  const estimated = type === "table" ? tableIds.reduce((sum, id) => sum + (snapshot.zones.find((zone) => zone.id === id[0])?.price ?? 0), 0) : lines.reduce((sum, line) => sum + (snapshot.products.find((product) => product.id === line.productId)?.price ?? 0) * line.quantity, 0);

  const reset = () => { setEditingId(""); setTableIds([]); setLines([]); setMeal("ชุดอาหารมาตรฐาน"); setDietaryNotes(""); };
  const chooseCustomer = (id: string) => { setCustomerId(id); reset(); setCreating(false); };
  const edit = (order: DemoOrder) => {
    setCustomerId(order.userId); setEditingId(order.id); setType(order.type);
    setTableIds(order.tableIds); setLines(order.items.map((item) => ({ productId: item.productId, quantity: item.quantity, size: item.size ?? "" })));
    setZoneId(order.tableIds[0]?.[0] ?? "A"); setMeal(order.meal || "ชุดอาหารมาตรฐาน"); setDietaryNotes(order.dietaryNotes);
    setChannel(order.channel === "line" || order.channel === "walkin" ? order.channel : "phone");
    document.getElementById("assisted-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const createCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await act("createCustomer", { displayName: name, username, phone, password, contactSource: source }, "สร้างบัญชีลูกค้าแล้ว") as { customer?: PublicUser } | null;
    if (result?.customer) { chooseCustomer(result.customer.id); setName(""); setUsername(""); setPhone(""); setPassword(""); }
  };
  const saveOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await act(editingId ? "updateAssistedOrder" : "createAssistedOrder", {
      orderId: editingId, userId: customerId, type, channel, tableIds, meal, dietaryNotes,
      items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity, size: line.size })),
    }, editingId ? "ปรับออเดอร์ในบัญชีลูกค้าแล้ว" : "บันทึกออเดอร์ในบัญชีลูกค้าแล้ว");
    if (result) reset();
  };
  const cancelOrder = async () => {
    const result = await act("cancelAssistedOrder", { orderId: cancelId, reason: cancelReason }, "ยกเลิกรายการแล้ว");
    if (result) { setCancelId(""); setCancelReason(""); if (editingId === cancelId) reset(); }
  };
  const changeLine = (index: number, update: Partial<Line>) => setLines((current) => current.map((line, i) => i === index ? { ...line, ...update } : line));
  const addLine = () => { const product = products[0]; if (product) setLines((current) => [...current, { productId: product.id, quantity: 1, size: product.sizes[0] ?? "" }]); };
  const filtered = snapshot.customers.filter((user) => `${user.displayName} ${user.username} ${user.phone ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="assist-page">
    <div className="assist-hero"><div><span className="eyebrow">HUMAN ASSISTED SERVICE</span><h2>มีคนช่วยดูแล<br />ทุกการจอง</h2><p>รับคำสั่งจากโทรศัพท์ LINE หรือหน้าเคาน์เตอร์ แล้วบันทึกเข้าบัญชีลูกค้า ลูกค้ากลับมาตรวจสอบเองได้ภายหลัง</p><div className="assist-hero-tags"><span><HeartHandshake size={15} /> ช่วยสั่งจอง</span><span><Ticket size={15} /> ตรวจสอบได้</span></div></div><img src="/assets/assisted-booking.png" alt="เจ้าหน้าที่ช่วยศิษย์เก่าจองงานผ่านคอมพิวเตอร์" /></div>
    <div className="assist-columns"><section className="admin-panel assist-customer-panel"><div className="panel-head"><div><span className="eyebrow">STEP 01 · CUSTOMER</span><h2>เลือกบัญชีลูกค้า</h2></div><button className="assist-text-button" type="button" onClick={() => setCreating(!creating)}><UserPlus size={17} /> สร้างบัญชี</button></div><label className="assist-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ ชื่อผู้ใช้ หรือเบอร์โทร" /></label><div className="assist-customer-list">{filtered.map((user) => <button type="button" className={user.id === customerId ? "selected" : ""} key={user.id} onClick={() => chooseCustomer(user.id)}><span className="assist-avatar">{user.displayName[0]}</span><span><strong>{user.displayName}</strong><small>@{user.username}{user.phone ? ` · ${user.phone}` : ""}</small></span>{user.id === customerId && <Check size={18} />}</button>)}{!filtered.length && <p className="muted">ไม่พบบัญชี กรุณาตรวจอีกครั้งหรือสร้างบัญชีใหม่</p>}</div>{creating && <form className="assist-create-form" onSubmit={createCustomer}><h3>สร้างบัญชีให้ลูกค้า</h3><label>ชื่อที่แสดง<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="ชื่อ-นามสกุล" /></label><label>ชื่อผู้ใช้<input required minLength={4} value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} placeholder="เช่น alumnus90" /></label><label>เบอร์โทร (ถ้ามี)<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="ใช้ค้นหาบัญชีเดิม" /></label><label>รหัสผ่านชั่วคราว<input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="อย่างน้อย 8 ตัว" /></label><label>ช่องทางติดต่อ<select value={source} onChange={(event) => setSource(event.target.value as typeof source)}><option value="phone">โทรศัพท์</option><option value="line">LINE</option><option value="walkin">หน้าเคาน์เตอร์</option></select></label><p>แจ้งชื่อผู้ใช้และรหัสผ่านให้ลูกค้าผ่านช่องทางที่ติดต่อไว้ บัญชีสาธิตนี้ยังไม่มีการยืนยันตัวตนด้วย LINE</p><button className="button button-dark" disabled={working}>สร้างบัญชี <ArrowRight size={17} /></button></form>}</section>
    <section className="admin-panel assist-history-panel"><div className="panel-head"><div><span className="eyebrow">STEP 02 · EXISTING ORDERS</span><h2>{customer ? `รายการของ ${customer.displayName}` : "เลือกลูกค้า"}</h2></div><span className="panel-note">{customerOrders.length} รายการ</span></div>{customerOrders.length ? <div className="assist-order-list">{customerOrders.map((order) => <article key={order.id} className="assist-order"><div className="assist-order-head"><span>{order.type === "table" ? <Ticket size={18} /> : <ShoppingBag size={18} />}</span><strong>{order.id}</strong><b>฿{baht(order.amount)}</b></div><p>{order.type === "table" ? `โต๊ะ ${order.tableIds.join(", ")}` : order.items.map((item) => `${item.name}${item.size ? ` (${item.size})` : ""} ×${item.quantity}`).join(", ")}</p><small>{order.status === "approved" ? "ชำระเงินแล้ว · แก้ไขไม่ได้" : order.status === "assisted_draft" ? "เจ้าหน้าที่บันทึกให้ · รอชำระเงิน" : order.status === "under_review" ? "การเงินกำลังตรวจ" : order.status === "cancelled" ? "ยกเลิกแล้ว" : "รอดำเนินการ"}</small>{order.history?.length ? <details><summary>ดูประวัติการช่วยเหลือ</summary>{order.history.map((entry, index) => <p key={index}>{new Date(entry.at).toLocaleString("th-TH")} · {entry.actor}: {entry.summary}</p>)}</details> : null}{editable(order) && (order.type === "table" ? canTables : canMerch) && <div className="assist-order-actions"><button type="button" onClick={() => edit(order)}>แก้ไข / เพิ่มลด</button><button type="button" onClick={() => { setCancelId(order.id); setCancelReason(""); }}>ยกเลิก</button></div>}</article>)}</div> : <p className="muted">ยังไม่มีรายการของลูกค้าคนนี้ เลือกบริการด้านล่างเพื่อเริ่มต้น</p>}</section></div>
    <section className="admin-panel assist-editor" id="assisted-editor"><div className="panel-head"><div><span className="eyebrow">STEP 03 · ASSISTED ORDER</span><h2>{editingId ? `แก้ไข ${editingId}` : "เพิ่มรายการให้ลูกค้า"}</h2></div>{editingId && <button type="button" className="assist-text-button" onClick={reset}>เริ่มรายการใหม่</button>}</div><form onSubmit={saveOrder}><div className="assist-form-top"><label>ประเภทงาน<select value={type} disabled={!!editingId} onChange={(event) => { setType(event.target.value as typeof type); setTableIds([]); setLines([]); }}><option value="table" disabled={!canTables}>โต๊ะจีน / คอนเสิร์ต</option><option value="product" disabled={!canMerch}>ของที่ระลึก</option></select></label><label>ลูกค้าติดต่อทาง<select value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)}><option value="phone">โทรศัพท์</option><option value="line">LINE</option><option value="walkin">หน้าเคาน์เตอร์</option></select></label></div>
    {type === "table" ? <><p className="assist-guide">เลือกโซน แล้วกดหมายเลขโต๊ะได้เหมือนผังโรงหนัง สูงสุด 6 โต๊ะ · โต๊ะละ 8 ที่นั่ง</p><div className="assist-zone-tabs">{snapshot.zones.map((zone) => <button type="button" className={zoneId === zone.id ? "active" : ""} key={zone.id} style={{ "--zone": zone.color } as React.CSSProperties} onClick={() => setZoneId(zone.id)}>{zone.id}<small>฿{baht(zone.price)}</small></button>)}</div><div className="assist-stage">เวทีคอนเสิร์ต · STAGE</div><div className="assist-table-grid">{Array.from({ length: 60 }, (_, index) => { const id = `${zoneId}-${String(index + 1).padStart(2, "0")}`; const selected = tableIds.includes(id); const busy = !!snapshot.tableStatuses[id] && !ownOrder?.tableIds.includes(id); return <button type="button" key={id} disabled={busy} className={selected ? "selected" : ""} aria-pressed={selected} title={busy ? `${id} ไม่ว่าง` : `เลือกโต๊ะ ${id}`} onClick={() => setTableIds((current) => selected ? current.filter((entry) => entry !== id) : current.length < 6 ? [...current, id] : current)}>{String(index + 1).padStart(2, "0")}</button>; })}</div><div className="assist-selected">{tableIds.length ? `เลือกแล้ว ${tableIds.join(", ")} · ${tableIds.length * 8} ที่นั่ง` : "ยังไม่ได้เลือกโต๊ะ"}</div><div className="assist-form-top"><label>ชุดอาหาร<select value={meal} onChange={(event) => setMeal(event.target.value)}><option>ชุดอาหารมาตรฐาน</option><option>ชุดอาหารไม่ใส่เนื้อวัว</option><option>ชุดอาหารมังสวิรัติ</option></select></label><label>แพ้อาหาร / ข้อกำหนด<input value={dietaryNotes} onChange={(event) => setDietaryNotes(event.target.value)} placeholder="เช่น แพ้กุ้ง ไม่ใส่ถั่ว" /></label></div></> : <><p className="assist-guide">เพิ่มหรือลดสินค้าในบัญชีลูกค้า ยอดรวมจะคำนวณให้ทันที</p><div className="assist-product-list">{lines.map((line, index) => { const product = snapshot.products.find((item) => item.id === line.productId); return <div className="assist-product-line" key={index}><img src={product?.image ?? "/assets/souvenir-unbranded.png"} alt="" /><select aria-label="สินค้า" value={line.productId} onChange={(event) => { const next = snapshot.products.find((item) => item.id === event.target.value); changeLine(index, { productId: event.target.value, size: next?.sizes[0] ?? "" }); }}>{products.map((item) => <option value={item.id} key={item.id}>{item.name} · ฿{baht(item.price)}</option>)}</select>{product?.sizes.length ? <select aria-label="ไซซ์" value={line.size} onChange={(event) => changeLine(index, { size: event.target.value })}>{product.sizes.map((size) => <option key={size}>{size}</option>)}</select> : null}<div className="assist-qty"><button type="button" onClick={() => changeLine(index, { quantity: Math.max(1, line.quantity - 1) })}><Minus size={15} /></button><strong>{line.quantity}</strong><button type="button" onClick={() => changeLine(index, { quantity: Math.min(20, line.quantity + 1) })}><Plus size={15} /></button></div><button className="assist-remove" type="button" aria-label="ลบสินค้า" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}><Trash2 size={17} /></button></div>; })}</div><button type="button" className="assist-add-product" onClick={addLine}><Plus size={16} /> เพิ่มสินค้า</button></>}
    <div className="assist-checkout"><div><span>ยอดรายการ{editingId ? "หลังแก้ไข" : "ใหม่"}</span><strong>฿{baht(estimated)}</strong><small>รายการนี้จะขึ้นในบัญชีลูกค้าเพื่อให้ตรวจสอบและอัปโหลดสลิป</small></div><button className="button button-dark" disabled={working || !customerId || (type === "table" ? !tableIds.length : !lines.length)}>{editingId ? "บันทึกการแก้ไข" : "บันทึกให้ลูกค้า"} <ArrowRight size={17} /></button></div></form></section>
    {cancelId && <div className="assist-cancel-backdrop"><div className="assist-cancel"><h3>ยกเลิกรายการ {cancelId}</h3><p>ระบุเหตุผลเพื่อเก็บเป็นประวัติในบัญชีลูกค้า</p><input autoFocus value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="เช่น ลูกค้าขอเปลี่ยนรายการ" /><div><button type="button" onClick={() => setCancelId("")}>กลับไป</button><button type="button" className="button button-dark" disabled={working || cancelReason.trim().length < 3} onClick={cancelOrder}>ยืนยันยกเลิก</button></div></div></div>}
  </div>;
}
