"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, BadgeCheck, Bell, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3, CreditCard,
  Download, Gift, Heart, LockKeyhole, LogIn, LogOut, MapPin, Menu, Minus,
  Package, Plus, ScanLine, Search, ShieldCheck, ShoppingBag, ShoppingCart,
  Sparkles, Ticket, Trash2, UploadCloud, UserRound, Users, WalletCards, X,
} from "lucide-react";
import type { DemoOrder, DemoSnapshot, Product, PublicUser, Role, Zone } from "@/lib/demo-types";
import AssistedPanel from "./AssistedPanel";
import AdminActivity from "./AdminActivity";
import GatePanel from "./GatePanel";
import TicketPass from "./TicketPass";

type Page = "home" | "tables" | "shop" | "orders" | "admin";
type AdminTab = "overview" | "assisted" | "finance" | "products" | "zones" | "users" | "gate";
type CartLine = { productId: string; quantity: number; size: string };

const baht = (amount: number) => new Intl.NumberFormat("th-TH").format(amount);
const dateText = (date: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
const isExpired = (order: DemoOrder) => ["awaiting_slip", "assisted_draft"].includes(order.status) && Date.parse(order.holdUntil) <= Date.now();
const hasClientRole = (user: PublicUser, role: Role) => (user.roles?.length ? user.roles : [user.role]).includes(role);
const isStaff = (user: PublicUser) => !hasClientRole(user, "customer");
const roleName: Record<Role, string> = {
  superadmin: "ผู้ดูแลระบบหลัก", tables: "ฝ่ายโต๊ะจีน", merch: "ฝ่ายของที่ระลึก",
  finance: "ฝ่ายการเงิน", gate: "ฝ่ายหน้างาน", customer: "ลูกค้า",
};
const statusName: Record<DemoOrder["status"], string> = {
  awaiting_slip: "รออัปโหลดสลิป", assisted_draft: "เจ้าหน้าที่บันทึกให้ · รอชำระเงิน", under_review: "รอการเงินตรวจสอบ",
  needs_revision: "กรุณาส่งสลิปใหม่", approved: "ชำระเงินแล้ว", cancelled: "ยกเลิกแล้ว",
};
const demoAccounts = [
  ["customer", "ลูกค้า"], ["superadmin", "Superadmin"], ["tableadmin", "ฝ่ายโต๊ะจีน"],
  ["shopadmin", "ฝ่ายสินค้า"], ["finance", "ฝ่ายการเงิน"], ["gate", "ฝ่ายหน้างาน"],
];
const adminNavItems: { id: AdminTab; title: string; icon: React.ReactNode; roles: Role[] }[] = [
  { id: "overview", title: "ภาพรวม", icon: <Sparkles size={18} />, roles: ["superadmin", "tables", "merch", "finance", "gate"] },
  { id: "assisted", title: "ช่วยลูกค้าสั่งจอง", icon: <Heart size={18} />, roles: ["superadmin", "tables", "merch"] },
  { id: "finance", title: "ตรวจสลิป", icon: <WalletCards size={18} />, roles: ["superadmin", "finance"] },
  { id: "products", title: "สินค้าและสต็อก", icon: <Package size={18} />, roles: ["superadmin", "merch"] },
  { id: "zones", title: "โซนและราคา", icon: <Ticket size={18} />, roles: ["superadmin", "tables"] },
  { id: "users", title: "มอบหมายบทบาท", icon: <Users size={18} />, roles: ["superadmin"] },
  { id: "gate", title: "ตรวจตั๋ว", icon: <ScanLine size={18} />, roles: ["superadmin", "gate"] },
];

async function post(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
  const body = await response.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(body) as Record<string, unknown>; }
  catch { throw new Error(`เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (HTTP ${response.status}) กรุณาหยุดแล้วเปิด Demo ใหม่`); }
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `ทำรายการไม่สำเร็จ (HTTP ${response.status})`);
  return data;
}

function Brand({ light = false }: { light?: boolean }) {
  return <span className={`brand ${light ? "brand-light" : ""}`}>
    <img className="brand-original-mark" src="/assets/event-mark-transparent.png" alt="ตรางานครบรอบ 90 ปี วิทยาลัยเทคนิคศรีสะเกษ" />
    <span className="brand-copy"><strong>SISAT 90</strong><small>คืนสู่เหย้า · วิทยาลัยเทคนิคศรีสะเกษ</small></span>
  </span>;
}

function SectionTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="section-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}

function Empty({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="empty"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{detail}</p></div>;
}

export default function DemoApp() {
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [adminTab, setAdminTab] = useState<AdminTab>("overview");
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [working, setWorking] = useState(false);
  const [zoneId, setZoneId] = useState("A");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [meal, setMeal] = useState("ชุดอาหารมาตรฐาน");
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/demo", { cache: "no-store" });
    if (!response.ok) throw new Error("โหลดข้อมูลสาธิตไม่สำเร็จ");
    const nextSnapshot = await response.json() as DemoSnapshot;
    setSnapshot(nextSnapshot);
    return nextSnapshot;
  }, []);

  useEffect(() => { refresh().catch((error) => setToast(error.message)); }, [refresh]);
  useEffect(() => { if (toast) { const timer = window.setTimeout(() => setToast(""), 4500); return () => window.clearTimeout(timer); } }, [toast]);

  const navigate = (target: Page) => {
    if ((target === "orders" || target === "admin") && !snapshot?.me) { setAuthOpen(true); return; }
    if (target === "admin" && snapshot?.me && !isStaff(snapshot.me)) { setToast("หน้านี้สำหรับเจ้าหน้าที่"); return; }
    if (target === "orders" && snapshot?.me && isStaff(snapshot.me)) { setToast("คำสั่งซื้อของฉันสำหรับบัญชีลูกค้า"); return; }
    setPage(target); setMobileOpen(false); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const act = async (action: string, payload: Record<string, unknown>, success: string, after?: () => void) => {
    setWorking(true);
    try { const result = await post(action, payload); await refresh(); setToast(success); after?.(); return result; }
    catch (error) { setToast(error instanceof Error ? error.message : "เกิดข้อผิดพลาด"); return null; }
    finally { setWorking(false); }
  };

  const activeZone = snapshot?.zones.find((zone) => zone.id === zoneId);
  const selectedPrice = selectedTables.reduce((sum, id) => sum + (snapshot?.zones.find((zone) => zone.id === id[0])?.price ?? 0), 0);
  const cartPrice = cart.reduce((sum, line) => sum + (snapshot?.products.find((product) => product.id === line.productId)?.price ?? 0) * line.quantity, 0);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const availableTables = 600 - Object.keys(snapshot?.tableStatuses ?? {}).length;
  const myOrders = snapshot?.orders.filter((order) => order.userId === snapshot.me?.id) ?? [];

  const orderTables = async () => {
    if (!snapshot?.me) { setAuthOpen(true); return; }
    if (!selectedTables.length) { setToast("กรุณาเลือกโต๊ะก่อน"); return; }
    const result = await act("createOrder", { type: "table", tableIds: selectedTables, meal, dietaryNotes }, "จองโต๊ะแล้ว กรุณาอัปโหลดสลิป", () => { setSelectedTables([]); navigate("orders"); });
    return result;
  };

  const orderProducts = async () => {
    if (!snapshot?.me) { setAuthOpen(true); return; }
    if (!cart.length) { setToast("กรุณาเลือกสินค้าก่อน"); return; }
    await act("createOrder", { type: "product", items: cart.map((line) => ({ productId: line.productId, quantity: line.quantity, size: line.size })) }, "สั่งซื้อแล้ว กรุณาอัปโหลดสลิป", () => { setCart([]); navigate("orders"); });
  };

  const addCart = (product: Product, size: string) => {
    setCart((current) => {
      const found = current.find((line) => line.productId === product.id && line.size === size);
      if (found) return current.map((line) => line === found ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { productId: product.id, quantity: 1, size }];
    });
    setToast(`เพิ่ม ${product.name} ลงตะกร้าแล้ว`);
  };

  if (!snapshot) return <div className="loading-screen"><Brand /><span className="loading-pulse">กำลังเตรียมพื้นที่สาธิต...</span>{toast && <p>{toast}</p>}</div>;

  return <div className="site-shell">
    <div className="demo-ribbon"><span className="demo-dot" /> เว็บไซต์สาธิตสำหรับนำเสนอและทดสอบ · ข้อมูล ราคา และวันงานเป็นตัวอย่าง</div>
    <header className="site-header">
      <div className="container nav-inner">
        <button className="brand-button" onClick={() => navigate("home")} aria-label="ไปหน้าแรก"><Brand /></button>
        <nav className={`main-nav ${snapshot.me && isStaff(snapshot.me) ? "staff-nav" : ""} ${mobileOpen ? "open" : ""}`} aria-label="เมนูหลัก">
          <button className={page === "home" ? "active" : ""} onClick={() => navigate("home")}>หน้าแรก</button>
          {snapshot.me && isStaff(snapshot.me) ? adminNavItems.filter((item) => item.roles.some((role) => hasClientRole(snapshot.me!, role))).map((item) => <button key={item.id} className={page === "admin" && adminTab === item.id ? "active" : ""} onClick={() => { setAdminTab(item.id); navigate("admin"); }}>{item.title}</button>) : <>
            <button className={page === "tables" ? "active" : ""} onClick={() => navigate("tables")}>จองโต๊ะจีน</button>
            <button className={page === "shop" ? "active" : ""} onClick={() => navigate("shop")}>ของที่ระลึก</button>
            <button className={page === "orders" ? "active" : ""} onClick={() => navigate("orders")}>คำสั่งซื้อของฉัน</button>
          </>}
        </nav>
        <div className="nav-actions">
          {snapshot.me ? <button className="account-pill" onClick={() => snapshot.me && isStaff(snapshot.me) ? navigate("admin") : navigate("orders")}><UserRound size={17} /><span>{snapshot.me.displayName}</span></button>
            : <button className="button button-small button-dark" onClick={() => setAuthOpen(true)}><LogIn size={16} /> เข้าสู่ระบบ</button>}
          {snapshot.me && <button className="icon-button logout-button" title="ออกจากระบบ" onClick={() => act("logout", {}, "ออกจากระบบแล้ว", () => navigate("home"))}><LogOut size={18} /></button>}
          <button className="icon-button menu-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="เปิดเมนู">{mobileOpen ? <X /> : <Menu />}</button>
        </div>
      </div>
    </header>

    <main>
      {page === "home" && <>
        <section className="hero"><div className="hero-image" /><div className="hero-vignette" /><div className="container hero-content">
          <div className="hero-kicker"><Sparkles size={16} /> SISAT 90TH ANNIVERSARY <span /></div><div className="hero-original-logos"><img src="/assets/event-mark-transparent.png" alt="ตราสัญลักษณ์งาน 90 ปี วิทยาลัยเทคนิคศรีสะเกษ จากภาพต้นฉบับ" /><img src="/assets/ovc-seal-transparent.png" alt="ตราสัญลักษณ์สำนักงานคณะกรรมการการอาชีวศึกษา จากภาพต้นฉบับ" /></div>
          <h1>เก้าทศวรรษ<br /><em>แห่งความผูกพัน</em></h1>
          <p className="hero-lead">กลับมาพบกันอีกครั้ง ในคืนแห่งความทรงจำ<br />งานคืนสู่เหย้า 90 ปี วิทยาลัยเทคนิคศรีสะเกษ</p>
          <div className="hero-buttons"><button className="button button-cyan" onClick={() => navigate("tables")}>เลือกโต๊ะร่วมงาน <ArrowRight size={19} /></button><button className="button button-glass" onClick={() => navigate("shop")}>ชมของที่ระลึก <ArrowDownRight size={19} /></button></div>
          <div className="hero-meta"><span><MapPin size={18} /> วิทยาลัยเทคนิคศรีสะเกษ</span><span><CalendarDays size={18} /> วันจัดงานจะแจ้งภายหลัง</span></div>
        </div><div className="hero-side-label">A HOMECOMING TO REMEMBER · 90 YEARS</div></section>

        <section className="welcome-strip"><div className="container welcome-inner"><span className="mini-stars">✦ ✦ ✦</span><p>จากห้องเรียนวันนั้น สู่ค่ำคืนที่เราจะกลับมาเจอกันอีกครั้ง</p><span className="welcome-line" /></div></section>

        <section className="container section-block event-intro"><div className="intro-copy"><span className="eyebrow">WELCOME BACK HOME</span><h2>เรื่องราวของเรา<br /><em>ยังคงดำเนินต่อ</em></h2><p>ร่วมโต๊ะอาหารกับเพื่อนเก่า ฟังเพลงที่คุ้นเคย และสร้างความทรงจำบทใหม่ไปด้วยกันในวาระครบรอบ 90 ปี</p><div className="legacy-identity"><img className="official-seal" src="/assets/ovc-seal-transparent.png" alt="ตรา สอศ. จากภาพต้นฉบับ" /><span><strong>วิทยาลัยเทคนิคศรีสะเกษ</strong><small>90 ปี แห่งความภาคภูมิใจ</small></span></div><div className="intro-highlights"><span><Ticket size={19} /> จองโต๊ะออนไลน์</span><span><ShoppingBag size={19} /> ของที่ระลึกพิเศษ</span><span><Heart size={19} /> พบกันอีกครั้ง</span></div><button className="text-link" onClick={() => navigate("tables")}>ดูพื้นที่จัดงาน <ArrowRight size={18} /></button></div><div className="intro-art"><div className="intro-image" /><div className="intro-stamp"><img src="/assets/event-mark-transparent.png" alt="ตรางาน 90 ปี" /></div><div className="intro-caption">วิทยาลัยเทคนิคศรีสะเกษ · SISAT</div></div></section>

        <section className="zone-preview section-block"><div className="container"><SectionTitle eyebrow="THE CELEBRATION" title="เลือกโต๊ะในโซนที่ใช่" detail="แผนผังเข้าใจง่าย เลือกโต๊ะได้ด้วยตัวเอง เห็นสถานะก่อนจอง" action={<button className="text-link" onClick={() => navigate("tables")}>ดูแผนผังทั้งหมด <ArrowRight size={18} /></button>} /><div className="zone-preview-grid">{snapshot.zones.map((zone) => <button key={zone.id} className="zone-preview-card" style={{ "--zone": zone.color, "--zone-soft": zone.softColor } as React.CSSProperties} onClick={() => { setZoneId(zone.id); navigate("tables"); }}><span className="zone-letter">{zone.id}</span><span className="zone-preview-info"><strong>โซน {zone.id}</strong><small>{zone.label} · 60 โต๊ะ</small></span><span className="zone-preview-arrow"><ArrowRight size={19} /></span></button>)}</div><div className="zone-footnote"><span><span className="dot free" /> ว่าง</span><span><span className="dot held" /> กำลังจอง</span><span><span className="dot sold" /> จองแล้ว</span><strong>{availableTables} โต๊ะพร้อมให้จอง</strong></div></div></section>

        <section className="container section-block shop-preview"><SectionTitle eyebrow="A LITTLE SOMETHING TO KEEP" title="ความทรงจำที่หยิบกลับบ้านได้" detail="ของที่ระลึก 90 ปี ออกแบบเพื่อช่วงเวลาที่มีความหมาย" action={<button className="text-link" onClick={() => navigate("shop")}>ดูสินค้าทั้งหมด <ArrowRight size={18} /></button>} /><div className="product-grid">{snapshot.products.filter((p) => p.active).slice(0, 3).map((product, index) => <ProductCard key={product.id} product={product} available={snapshot.productAvailable[product.id]} index={index} onAdd={addCart} />)}</div>{cartCount > 0 && <button className="floating-cart" onClick={() => navigate("shop")}><ShoppingCart size={18} /> ตะกร้า {cartCount} ชิ้น · ฿{baht(cartPrice)} <ArrowRight size={16} /></button>}</section>

        <section className="container section-block steps-section"><div className="steps-header"><span className="eyebrow">SIMPLE BY DESIGN</span><h2>ง่าย ตั้งแต่จอง<br />จนถึงวันพบกัน</h2></div><div className="steps-grid"><div><span>01</span><Ticket /><h3>เลือกโต๊ะหรือสินค้า</h3><p>ดูราคาและสถานะได้ชัดเจนก่อนกดยืนยัน</p></div><div><span>02</span><UploadCloud /><h3>โอนเงินและส่งสลิป</h3><p>อัปโหลดภาพจากมือถือหรือคอมพิวเตอร์</p></div><div><span>03</span><ScanLine /><h3>รับตั๋วอิเล็กทรอนิกส์</h3><p>ให้เจ้าหน้าที่สแกนเมื่อเข้างานหรือรับสินค้า</p></div></div></section>

        <section className="closing-banner"><div className="container"><span className="eyebrow">SEE YOU AGAIN</span><h2>แล้วพบกัน<br /><em>ในคืนของเรา</em></h2><button className="button button-white" onClick={() => navigate("tables")}>สำรวจโต๊ะที่ยังว่าง <ArrowRight size={18} /></button></div></section>
      </>}

      {page === "tables" && <section className="inner-page container"><div className="page-heading"><button className="back-link" onClick={() => navigate("home")}><ArrowLeft size={16} /> กลับหน้าแรก</button><span className="eyebrow">CHOOSE YOUR PLACE</span><h1>จองโต๊ะจีน <em>ให้เหมือนเลือกที่นั่ง</em></h1><p>เลือกโซน ดูผัง เลือกหมายเลขโต๊ะ และตรวจราคารวมก่อนจอง</p></div><div className="page-visual page-visual-tables"><img src="/assets/banquet-evening.png" alt="ภาพบรรยากาศงานโต๊ะจีนและเวทีคอนเสิร์ต" /><div><span>DINNER · CONCERT · REUNION</span><strong>เลือกค่ำคืนของคุณ</strong><small>ภาพบรรยากาศสาธิต · ผังจองจริงอยู่ด้านล่าง</small></div></div><div className="booking-layout"><div className="booking-main"><div className="booking-card"><div className="booking-card-top"><div><h2>เลือกโซนที่ต้องการ</h2><p>โซนละ 60 โต๊ะ · โต๊ะละ 8 ที่นั่ง</p></div><span className="small-counter">ว่าง {availableTables} / 600</span></div><div className="zone-selector">{snapshot.zones.map((zone) => { const sold = Array.from({ length: 60 }, (_, index) => `${zone.id}-${String(index + 1).padStart(2, "0")}`).filter((id) => snapshot.tableStatuses[id]).length; return <button key={zone.id} className={`zone-choice ${zoneId === zone.id ? "selected" : ""}`} style={{ "--zone": zone.color, "--zone-soft": zone.softColor } as React.CSSProperties} onClick={() => setZoneId(zone.id)}><span className="zone-choice-letter">{zone.id}</span><span><strong>โซน {zone.id}</strong><small>฿{baht(zone.price)} / โต๊ะ</small></span><span className="choice-availability">ว่าง {60 - sold}</span></button>; })}</div></div><div className="booking-card seat-card"><div className="booking-card-top"><div><span className="eyebrow">INTERACTIVE SEATING MAP</span><h2>ผังโต๊ะโซน {zoneId}</h2><p>แตะโต๊ะที่ต้องการ · เลือกได้สูงสุด 6 โต๊ะต่อคำสั่งซื้อ</p></div><span className="seat-zone-tag" style={{ background: activeZone?.softColor, color: activeZone?.color }}>ZONE {zoneId}</span></div><div className="stage"><span className="stage-light" /> <span>เวทีคอนเสิร์ต</span> <span className="stage-light" /></div><div className="seat-map-scroll"><div className="seat-map" style={{ "--zone": activeZone?.color } as React.CSSProperties}>{Array.from({ length: 60 }, (_, index) => { const id = `${zoneId}-${String(index + 1).padStart(2, "0")}`; const status = snapshot.tableStatuses[id]; const selected = selectedTables.includes(id); return <button key={id} aria-label={`โต๊ะ ${id} ${selected ? "เลือกแล้ว" : status ? "ไม่ว่าง" : "ว่าง"}`} aria-pressed={selected} disabled={Boolean(status)} className={`table-seat ${status ?? ""} ${selected ? "selected" : ""}`} onClick={() => setSelectedTables((current) => selected ? current.filter((table) => table !== id) : current.length >= 6 ? current : [...current, id])}><span className="seat-mini-dots">•••</span><strong>{String(index + 1).padStart(2, "0")}</strong><span className="seat-mini-dots">•••</span></button>; })}</div></div><div className="map-entrance"><span>↑</span> ทางเข้างาน</div><div className="seat-legend"><span><i className="legend-dot legend-free" /> ว่าง</span><span><i className="legend-dot legend-selected" /> ที่เลือก</span><span><i className="legend-dot legend-reserved" /> กำลังจอง</span><span><i className="legend-dot legend-sold" /> จองแล้ว</span></div></div></div><aside className="booking-sidebar"><div className="summary-card"><span className="eyebrow">YOUR RESERVATION</span><h2>สรุปการจอง</h2><div className="summary-divider" />{selectedTables.length ? <div className="selected-list">{selectedTables.map((id) => <div key={id}><span><span className="summary-seat">{id}</span> 8 ที่นั่ง</span><button aria-label={`เอาโต๊ะ ${id} ออก`} onClick={() => setSelectedTables((current) => current.filter((table) => table !== id))}><X size={16} /></button></div>)}</div> : <div className="summary-placeholder"><Ticket size={26} /><p>เลือกโต๊ะจากผังด้านซ้าย<br />เพื่อดูรายละเอียดที่นี่</p></div>}<label className="field-label" htmlFor="meal">ชุดอาหาร</label><select id="meal" value={meal} onChange={(event) => setMeal(event.target.value)}><option>ชุดอาหารมาตรฐาน</option><option>ชุดอาหารไม่ใส่เนื้อวัว</option><option>ชุดอาหารมังสวิรัติ</option></select><label className="field-label" htmlFor="dietary">ข้อจำกัดอาหาร / แพ้อาหาร</label><textarea id="dietary" rows={3} placeholder="เช่น แพ้กุ้ง 1 ท่าน, ไม่ใส่ถั่ว" value={dietaryNotes} onChange={(event) => setDietaryNotes(event.target.value)} /><div className="summary-divider" /><div className="summary-total"><span>ยอดรวม</span><strong>฿{baht(selectedPrice)}</strong></div><button className="button button-dark button-full" disabled={working || !selectedTables.length} onClick={orderTables}>ยืนยันการจอง <ArrowRight size={18} /></button><small className="summary-note"><LockKeyhole size={13} /> กันโต๊ะ 20 นาทีเพื่ออัปโหลดสลิป</small></div><div className="help-card"><CircleHelp size={20} /><div><strong>ต้องการความช่วยเหลือ?</strong><p>เริ่มจากเลือกโซน แล้วแตะโต๊ะสีขาวที่ว่างอยู่</p></div></div></aside></div></section>}

      {page === "shop" && <section className="inner-page container"><div className="page-heading"><button className="back-link" onClick={() => navigate("home")}><ArrowLeft size={16} /> กลับหน้าแรก</button><span className="eyebrow">THE MEMORY SHOP</span><h1>ของที่ระลึก <em>ที่บอกเล่าเรื่องของเรา</em></h1><p>เลือกสินค้า ใส่ตะกร้า และรับของที่จุดบริการในวันงาน</p></div><div className="page-visual page-visual-shop"><img src="/assets/shirt-reference.png" alt="ภาพตัวอย่างเสื้อจากภาพอ้างอิงต้นฉบับ" /><div><span>THE MEMORY SHOP</span><strong>เก็บเรื่องราวไว้ใกล้ตัว</strong><small>สินค้าและราคานี้เป็นข้อมูลสาธิต</small></div></div><div className="shop-layout"><div><div className="shop-toolbar"><span>สินค้าทั้งหมด {snapshot.products.filter((p) => p.active).length} รายการ</span><span><Sparkles size={15} /> สินค้า Demo แก้ไขได้จากหลังบ้าน</span></div><div className="product-grid shop-grid">{snapshot.products.filter((p) => p.active).map((product, index) => <ProductCard key={product.id} product={product} available={snapshot.productAvailable[product.id]} index={index} onAdd={addCart} />)}</div></div><aside className="cart-sidebar"><div className="summary-card"><span className="eyebrow">YOUR CART</span><h2>ตะกร้าของฉัน <span className="cart-badge">{cartCount}</span></h2><div className="summary-divider" />{cart.length ? <div className="cart-lines">{cart.map((line) => { const product = snapshot.products.find((p) => p.id === line.productId); if (!product) return null; return <div key={`${line.productId}-${line.size}`} className="cart-line"><img src={product.image} alt="" /><div><strong>{product.name}</strong><small>{line.size ? `ไซซ์ ${line.size} · ` : ""}฿{baht(product.price)}</small><div className="quantity-control"><button aria-label="ลดจำนวน" onClick={() => setCart((current) => current.flatMap((item) => item === line ? item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : [] : [item]))}><Minus size={13} /></button><span>{line.quantity}</span><button aria-label="เพิ่มจำนวน" onClick={() => setCart((current) => current.map((item) => item === line ? { ...item, quantity: item.quantity + 1 } : item))}><Plus size={13} /></button></div></div><button className="cart-remove" aria-label="ลบสินค้า" onClick={() => setCart((current) => current.filter((item) => item !== line))}><Trash2 size={16} /></button></div>; })}</div> : <div className="summary-placeholder"><ShoppingBag size={26} /><p>ยังไม่มีสินค้าในตะกร้า</p></div>}<div className="summary-divider" /><div className="summary-total"><span>ยอดรวม</span><strong>฿{baht(cartPrice)}</strong></div><button className="button button-dark button-full" disabled={working || !cart.length} onClick={orderProducts}>สั่งซื้อสินค้า <ArrowRight size={18} /></button><small className="summary-note"><Package size={14} /> รับของที่จุดบริการภายในงาน</small></div></aside></div></section>}

      {page === "orders" && <OrdersPage orders={myOrders} onBack={() => navigate("home")} refresh={refresh} setToast={setToast} onCancel={(orderId) => act("cancelOrder", { orderId }, "ยกเลิกรายการแล้ว")} />}

      {page === "admin" && snapshot.me && isStaff(snapshot.me) && <AdminPage snapshot={snapshot} tab={adminTab} setTab={setAdminTab} act={act} working={working} refresh={refresh} setToast={setToast} editingProduct={editingProduct} setEditingProduct={setEditingProduct} creatingProduct={creatingProduct} setCreatingProduct={setCreatingProduct} />}
    </main>

    <footer className="site-footer"><div className="container footer-main"><Brand light /><div><strong>สำรวจเว็บไซต์</strong><button onClick={() => navigate("tables")}>จองโต๊ะจีน</button><button onClick={() => navigate("shop")}>ร้านของที่ระลึก</button><button onClick={() => navigate("orders")}>คำสั่งซื้อของฉัน</button></div><div><strong>งานคืนสู่เหย้า 90 ปี</strong><span>วิทยาลัยเทคนิคศรีสะเกษ</span><span>จังหวัดศรีสะเกษ ประเทศไทย</span><span>เว็บไซต์สาธิตเพื่อการวางแผน</span></div></div><div className="container footer-bottom"><span>© 2026 SISAT 90 Reunion · Demo Preview</span><span>สร้างเพื่อรำลึกถึงทุกก้าวที่เดินมาด้วยกัน</span></div></footer>

    {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={async () => { const updated = await refresh(); if (!updated.me) throw new Error("เข้าสู่ระบบแล้ว แต่เบราว์เซอร์ยังไม่บันทึก session กรุณาใช้ http://127.0.0.1:3000 และลองใหม่"); setAuthOpen(false); setMobileOpen(false); setPage(isStaff(updated.me) ? "admin" : "orders"); setAdminTab("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); setToast(`เข้าสู่ระบบแล้ว · ${updated.me.roles.map((role) => roleName[role]).join(" + ")}`); }} />}
    {toast && <div className="toast" role="status"><Bell size={17} /> {toast}<button onClick={() => setToast("")} aria-label="ปิดข้อความ"><X size={15} /></button></div>}
  </div>;
}

function ProductCard({ product, available, index, onAdd }: { product: Product; available: number; index: number; onAdd: (product: Product, size: string) => void }) {
  const [size, setSize] = useState(product.sizes[0] ?? "");
  return <article className="product-card"><div className="product-image-wrap"><img src={product.image} alt={product.name} /><span className="product-index">0{index + 1} / SISAT 90</span><span className="product-heart"><Heart size={18} /></span></div><div className="product-body"><span className="product-category">{product.category}</span><h3>{product.name}</h3><p>{product.description}</p><div className="product-bottom"><strong>฿{baht(product.price)}</strong><span>คงเหลือ {available}</span></div><div className="product-actions">{product.sizes.length > 0 && <select aria-label={`ขนาดของ ${product.name}`} value={size} onChange={(event) => setSize(event.target.value)}>{product.sizes.map((entry) => <option key={entry}>{entry}</option>)}</select>}<button className="button button-outline" disabled={available <= 0} onClick={() => onAdd(product, size)}><Plus size={17} /> {available <= 0 ? "สินค้าหมด" : "เพิ่มลงตะกร้า"}</button></div></div></article>;
}

function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => Promise<void> }) {
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState("customer");
  const [password, setPassword] = useState("Demo@1234");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await post(register ? "register" : "login", { username, password, displayName }); await onSuccess(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "เข้าสู่ระบบไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="auth-modal" role="dialog" aria-modal="true" aria-label="เข้าสู่ระบบ"><button className="modal-close" onClick={onClose} aria-label="ปิด"><X size={20} /></button><div className="auth-visual"><div className="auth-visual-overlay" /><Brand light /><div><span className="eyebrow">WELCOME HOME</span><h2>กลับมาพบกัน<br />อีกครั้ง</h2><p>พื้นที่เล็ก ๆ ที่พาเพื่อนเก่ากลับมาใกล้กัน</p></div><span className="auth-vertical">90 YEARS OF CONNECTION</span></div><div className="auth-form-area"><span className="eyebrow">SISAT 90 ACCOUNT</span><h2>{register ? "สมัครบัญชีสาธิต" : "ยินดีต้อนรับกลับมา"}</h2><p>เข้าสู่ระบบเพื่อจองโต๊ะ ซื้อของ และดูตั๋วของคุณ</p><form onSubmit={submit}>{register && <label>ชื่อที่แสดง<input required minLength={2} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="ชื่อ-นามสกุล" /></label>}<label>ชื่อผู้ใช้<input required value={username} onChange={(event) => { setUsername(event.target.value); setError(""); }} autoComplete="username" placeholder="username" /></label><label>รหัสผ่าน<input required type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete={register ? "new-password" : "current-password"} placeholder="อย่างน้อย 8 ตัว" /></label>{error && <div className="auth-error" role="alert"><CircleHelp size={17} /> {error}</div>}<button className="button button-dark button-full" disabled={busy}>{busy ? "กำลังเข้าสู่ระบบ..." : register ? "สร้างบัญชีสาธิต" : "เข้าสู่ระบบ"} {!busy && <ArrowRight size={18} />}</button></form><div className="auth-divider"><span>ช่องทางอื่นในแผนงาน</span></div><div className="social-row"><button disabled><strong className="google-g">G</strong> Google <small>เร็ว ๆ นี้</small></button><button disabled><strong className="line-icon">L</strong> LINE QR <small>เร็ว ๆ นี้</small></button></div><button className="auth-switch" onClick={() => { setRegister(!register); setError(""); setUsername(register ? "customer" : ""); setPassword(register ? "Demo@1234" : ""); }}>{register ? "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สมัครบัญชีสาธิต"}</button><div className="demo-credentials"><strong><ShieldCheck size={15} /> บัญชีทดลอง</strong><p>คลิกบทบาทเพื่อกรอกชื่อผู้ใช้อัตโนมัติ · รหัสผ่านทุกบัญชี <code>Demo@1234</code></p><div>{demoAccounts.map(([name, label]) => <button key={name} onClick={() => { setRegister(false); setError(""); setUsername(name); setPassword("Demo@1234"); }}>{label}</button>)}</div></div></div></div></div>;
}

function OrdersPage({ orders, onBack, refresh, setToast, onCancel }: { orders: DemoOrder[]; onBack: () => void; refresh: () => Promise<DemoSnapshot>; setToast: (message: string) => void; onCancel: (orderId: string) => void }) {
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
  return <section className="inner-page container"><div className="page-heading"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> กลับหน้าแรก</button><span className="eyebrow">MY SISAT 90</span><h1>คำสั่งซื้อ <em>และตั๋วของฉัน</em></h1><p>ติดตามการชำระเงิน ดูตั๋วเข้างาน และใบรับของที่ระลึก</p></div>{orders.length ? <div className="orders-layout"><div className="orders-list">{orders.map((order) => <article key={order.id} className="order-card"><div className="order-head"><div><span className="order-id">{order.id}</span><small>{dateText(order.createdAt)}</small></div><span className={`status-badge status-${order.status}`}>{isExpired(order) ? "หมดเวลาจอง" : statusName[order.status]}</span></div><div className="order-content"><div className="order-icon">{order.type === "table" ? <Ticket size={28} /> : <ShoppingBag size={28} />}</div><div><h3>{order.type === "table" ? `โต๊ะจีน ${order.tableIds.join(", ")}` : order.items.map((item) => `${item.name} ×${item.quantity}`).join(", ")}</h3><p>{order.type === "table" ? `${order.tableIds.length * 8} ที่นั่ง · ${order.meal}` : "รับสินค้าที่จุดบริการในวันงาน"}</p>{order.dietaryNotes && <p className="dietary-note">หมายเหตุอาหาร: {order.dietaryNotes}</p>}</div><strong className="order-price">฿{baht(order.amount)}</strong></div>{order.history?.length ? <details className="order-history"><summary>ประวัติการช่วยเหลือ</summary>{order.history.map((entry, index) => <p key={index}>{dateText(entry.at)} · {entry.actor}: {entry.summary}</p>)}</details> : null}{order.financeComment && <div className="finance-comment"><CircleHelp size={17} /><span>ข้อความจากฝ่ายการเงิน: {order.financeComment}</span></div>}{["awaiting_slip", "assisted_draft"].includes(order.status) && !isExpired(order) && <div className="payment-panel"><div className="bank-placeholder"><WalletCards size={23} /><div><strong>ข้อมูลบัญชีรับเงินสาธิต</strong><span>ธนาคารและเลขบัญชีจริงจะแสดงเมื่อเปิดใช้งาน</span></div></div><p><Clock3 size={16} /> กรุณาอัปโหลดสลิปภายใน {dateText(order.holdUntil)}</p><label className="button button-dark upload-button"><UploadCloud size={18} /> {uploading === order.id ? "กำลังอัปโหลด..." : "เลือกภาพสลิป"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading === order.id} onChange={(event) => upload(order, event.target.files?.[0])} /></label></div>}{isExpired(order) && <div className="order-info"><Clock3 size={17} /> เวลากันรายการหมดแล้ว กรุณากลับไปเลือกใหม่</div>}{order.status === "needs_revision" && <div className="payment-panel"><p>ส่งสลิปใหม่ในรายการเดิมได้เลย</p><label className="button button-dark upload-button"><UploadCloud size={18} /> {uploading === order.id ? "กำลังอัปโหลด..." : "อัปโหลดสลิปใหม่"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading === order.id} onChange={(event) => upload(order, event.target.files?.[0])} /></label></div>}{order.status === "under_review" && <div className="order-info"><Clock3 size={17} /> ฝ่ายการเงินกำลังตรวจรายการรับเงินจริงก่อนออกตั๋ว</div>}{order.status === "approved" && <div className="ticket-panel"><div className="ticket-panel-head"><BadgeCheck size={20} /><strong>{order.type === "table" ? "ตั๋วเข้างานพร้อมแล้ว" : "ใบรับสินค้าพร้อมแล้ว"}</strong></div>{order.type === "table" ? <details><summary>ดูตั๋ว {order.ticketCodes.length} ใบ <ChevronDown size={17} /></summary><div className="ticket-grid">{order.ticketCodes.map((code, index) => <TicketPass key={code} order={order} code={code} seatIndex={index} />)}</div></details> : order.pickupCode && <div className="ticket-grid"><TicketPass order={order} code={order.pickupCode} /></div>}</div>}{["awaiting_slip", "assisted_draft", "under_review", "needs_revision"].includes(order.status) && <button className="order-cancel" onClick={() => onCancel(order.id)}>ยกเลิกรายการ</button>}</article>)}</div><aside className="orders-help"><div className="help-sidebar-card"><ShieldCheck size={24} /><h3>ขั้นตอนการชำระเงิน</h3><ol><li>โอนเงินตามยอดที่แสดง</li><li>อัปโหลดภาพสลิปในรายการนี้</li><li>รอฝ่ายการเงินตรวจยอดจริง</li><li>รับตั๋วหรือใบรับของหลังอนุมัติ</li></ol><p>ระบบสาธิตยังไม่รับชำระเงินจริง</p></div></aside></div> : <Empty icon={<Ticket size={30} />} title="ยังไม่มีคำสั่งซื้อ" detail="เริ่มจากเลือกโต๊ะในผัง หรือดูของที่ระลึกที่ถูกใจ" />}</section>;
}

type Act = (action: string, payload: Record<string, unknown>, success: string, after?: () => void) => Promise<unknown>;

function AdminPage({ snapshot, tab, setTab, act, working, refresh, setToast, editingProduct, setEditingProduct, creatingProduct, setCreatingProduct }: {
  snapshot: DemoSnapshot; tab: AdminTab; setTab: (tab: AdminTab) => void; act: Act; working: boolean;
  refresh: () => Promise<DemoSnapshot>; setToast: (message: string) => void;
  editingProduct: Product | null; setEditingProduct: (product: Product | null) => void;
  creatingProduct: boolean; setCreatingProduct: (value: boolean) => void;
}) {
  const me = snapshot.me!;
  const allTabs = adminNavItems;
  const allowed = allTabs.filter((item) => item.roles.some((role) => hasClientRole(me, role)));
  const safeTab = allowed.some((item) => item.id === tab) ? tab : "overview";
  const reviewOrders = snapshot.orders.filter((order) => order.status === "under_review");
  const approvedOrders = snapshot.orders.filter((order) => order.status === "approved");
  const taken = Object.keys(snapshot.tableStatuses).length;
  return <div className="admin-shell"><div className="container admin-layout"><aside className="admin-sidebar"><div className="admin-sidebar-title"><span>ADMIN CONSOLE</span><strong>จัดการงานคืนสู่เหย้า</strong></div><div className="admin-profile"><span><UserRound size={22} /></span><div><strong>{me.displayName}</strong><small>{me.roles.map((role) => roleName[role]).join(" + ")}</small></div></div><nav aria-label="เมนูหลังบ้าน">{allowed.map((item) => <button key={item.id} className={safeTab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.icon}{item.title}{item.id === "finance" && reviewOrders.length > 0 && <b>{reviewOrders.length}</b>}</button>)}</nav><div className="sidebar-note"><ShieldCheck size={19} /><span>แต่ละฝ่ายเห็นเฉพาะงานที่ได้รับสิทธิ์</span></div></aside><div className="admin-main"><div className="admin-topline"><div><span className="eyebrow">SISAT 90 · CONTROL CENTER</span><h1>{allTabs.find((item) => item.id === safeTab)?.title}</h1><p>สวัสดี {me.displayName} · วันนี้มาจัดการงานส่วนของคุณกัน</p></div><span className="admin-mode"><span /> DEMO MODE</span></div>
    {safeTab === "overview" && <><div className="admin-stats"><div><span><Ticket size={20} /></span><small>โต๊ะที่พร้อมจอง</small><strong>{600 - taken}<em> / 600</em></strong></div><div><span><WalletCards size={20} /></span><small>รายการรอตรวจ</small><strong>{reviewOrders.length}<em> รายการ</em></strong></div><div><span><BadgeCheck size={20} /></span><small>อนุมัติแล้ว</small><strong>{approvedOrders.length}<em> รายการ</em></strong></div><div><span><ShoppingBag size={20} /></span><small>สินค้าที่เปิดขาย</small><strong>{snapshot.products.filter((p) => p.active).length}<em> รายการ</em></strong></div></div><div className="admin-two-col"><div className="admin-panel"><div className="panel-head"><div><span className="eyebrow">QUICK ACCESS</span><h2>งานที่ทำบ่อย</h2></div></div><div className="quick-links">{allowed.filter((item) => item.id !== "overview").map((item) => <button key={item.id} onClick={() => setTab(item.id)}><span>{item.icon}</span><strong>{item.title}</strong><ChevronRight size={17} /></button>)}</div></div><AdminActivity snapshot={snapshot} onManage={setTab} /></div>{hasClientRole(me, "superadmin") && <div className="admin-panel audit-panel"><div className="panel-head"><div><span className="eyebrow">AUDIT TRAIL</span><h2>ประวัติการเปลี่ยนแปลง</h2></div></div>{snapshot.audit.length ? snapshot.audit.slice(0, 8).map((entry, index) => <div className="audit-row" key={`${entry.at}-${index}`}><span>{dateText(entry.at)}</span><strong>{entry.action}</strong><span>{entry.detail}</span></div>) : <p className="muted">ยังไม่มีการเปลี่ยนแปลง</p>}</div>}</>}

    {safeTab === "assisted" && <AssistedPanel snapshot={snapshot} act={act} working={working} />}
    {safeTab === "finance" && <div className="admin-panel"><div className="panel-head"><div><span className="eyebrow">PAYMENT REVIEW</span><h2>สลิปรอตรวจ {reviewOrders.length} รายการ</h2></div><span className="panel-note">ตรวจยอดเงินจริงก่อนกดอนุมัติ</span></div>{reviewOrders.length ? reviewOrders.map((order) => <FinanceRow key={order.id} order={order} act={act} working={working} />) : <Empty icon={<CheckCircle2 size={30} />} title="ตรวจครบแล้ว" detail="รายการที่ลูกค้าส่งสลิปใหม่จะปรากฏที่นี่" />}</div>}

      {safeTab === "products" && <div className="admin-panel"><div className="panel-head"><div><span className="eyebrow">MERCHANDISE</span><h2>สินค้าและสต็อก</h2></div><button className="button button-dark button-small" onClick={() => { setEditingProduct(null); setCreatingProduct(true); }}><Plus size={17} /> เพิ่มสินค้า</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>สินค้า</th><th>ราคา</th><th>คงเหลือ / ทั้งหมด</th><th>สถานะ</th><th /></tr></thead><tbody>{snapshot.products.map((product) => <tr key={product.id}><td><span className="table-product"><img src={product.image} alt="" /><span><strong>{product.name}</strong><small>{product.category}</small></span></span></td><td>฿{baht(product.price)}</td><td>{snapshot.productAvailable[product.id]} / {product.stock}</td><td><span className={`stock-pill ${product.active ? "" : "inactive"}`}>{product.active ? "เปิดขาย" : "ปิดขาย"}</span></td><td><button className="table-edit" onClick={() => { setEditingProduct(product); setCreatingProduct(false); }}>แก้ไข <ArrowRight size={15} /></button></td></tr>)}</tbody></table></div><p className="panel-help">สต็อกที่ตั้งไว้ต้องไม่ต่ำกว่ายอดสินค้าที่ลูกค้าจองหรือซื้อแล้ว</p></div>}

    {safeTab === "zones" && <div className="admin-panel"><div className="panel-head"><div><span className="eyebrow">SEATING CONTROL</span><h2>ราคาโซน A–J</h2></div><span className="panel-note">โซนละ 60 โต๊ะ · โต๊ะละ 8 ที่นั่ง</span></div><div className="zone-admin-grid">{snapshot.zones.map((zone) => <ZoneEditor key={zone.id} zone={zone} snapshot={snapshot} act={act} working={working} />)}</div></div>}

    {safeTab === "users" && <div className="admin-panel"><div className="panel-head"><div><span className="eyebrow">ACCESS CONTROL</span><h2>มอบหมายบทบาทเจ้าหน้าที่</h2></div><span className="panel-note">สิทธิ์เปลี่ยนทันทีหลังบันทึก</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>บัญชี</th><th>ชื่อผู้ใช้</th><th>บทบาทปัจจุบัน</th><th>มอบหมายใหม่</th></tr></thead><tbody>{snapshot.users.map((user) => <UserRoleRow key={user.id} user={user} me={me} act={act} />)}</tbody></table></div><p className="panel-help">ทดลองเปลี่ยนบทบาท แล้วออกจากบัญชีนั้นและล็อกอินใหม่เพื่อดูเมนูตามสิทธิ์</p></div>}

    {safeTab === "gate" && <GatePanel act={act} working={working} />}
  </div></div>{(editingProduct || creatingProduct) && <ProductEditor key={editingProduct?.id ?? "new"} product={editingProduct} onClose={() => { setEditingProduct(null); setCreatingProduct(false); }} act={act} setToast={setToast} />}</div>;
}

function FinanceRow({ order, act, working }: { order: DemoOrder; act: Act; working: boolean }) {
  const [comment, setComment] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  return <div className="finance-row"><div className="finance-row-main"><span className="finance-icon"><CreditCard size={20} /></span><div><strong>{order.id}</strong><small>{order.type === "table" ? `โต๊ะ ${order.tableIds.join(", ")}` : order.items.map((item) => item.name).join(", ")} · {dateText(order.createdAt)}</small></div><b>฿{baht(order.amount)}</b></div><div className="finance-row-bottom"><button className="slip-link" onClick={() => setImageOpen(!imageOpen)}><Search size={16} /> {imageOpen ? "ซ่อนสลิป" : "ดูสลิป"}</button><input aria-label="หมายเหตุถึงลูกค้า" placeholder="ข้อความถึงลูกค้าเมื่อขอสลิปใหม่" value={comment} onChange={(event) => setComment(event.target.value)} /><button className="button button-outline button-small" disabled={working} onClick={() => act("reviewOrder", { orderId: order.id, decision: "revise", comment }, "ส่งคำขอแก้ไขให้ลูกค้าแล้ว")}>ขอแก้ไข</button><button className="button button-dark button-small" disabled={working} onClick={() => act("reviewOrder", { orderId: order.id, decision: "approve", comment }, "อนุมัติแล้วและออกตั๋วเรียบร้อย")}><Check size={16} /> อนุมัติ</button></div>{imageOpen && <div className="slip-preview"><img src={`/api/slip?orderId=${encodeURIComponent(order.id)}`} alt={`สลิปของคำสั่งซื้อ ${order.id}`} /><a href={`/api/slip?orderId=${encodeURIComponent(order.id)}`} target="_blank" rel="noreferrer"><Download size={15} /> เปิดภาพเต็ม</a></div>}</div>;
}

function ZoneEditor({ zone, snapshot, act, working }: { zone: Zone; snapshot: DemoSnapshot; act: Act; working: boolean }) {
  const [price, setPrice] = useState(zone.price);
  const sold = Array.from({ length: 60 }, (_, index) => `${zone.id}-${String(index + 1).padStart(2, "0")}`).filter((id) => snapshot.tableStatuses[id]).length;
  return <div className="zone-admin-card" style={{ "--zone": zone.color, "--zone-soft": zone.softColor } as React.CSSProperties}><div><span className="zone-admin-letter">{zone.id}</span><div><strong>โซน {zone.id}</strong><small>{zone.label} · ว่าง {60 - sold} โต๊ะ</small></div></div><label>ราคาต่อโต๊ะ (บาท)<input type="number" min="0" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></label><button disabled={working || price === zone.price} onClick={() => act("saveZone", { id: zone.id, price }, `บันทึกราคาโซน ${zone.id} แล้ว`)}>บันทึกราคา <ArrowRight size={15} /></button></div>;
}

function UserRoleRow({ user, me, act }: { user: PublicUser; me: PublicUser; act: Act }) {
  const [selected, setSelected] = useState<Role[]>(user.roles ?? [user.role]);
  const options: Role[] = ["tables", "merch", "finance", "gate", "customer", "superadmin"];
  const toggle = (role: Role) => setSelected((current) => role === "customer" || role === "superadmin" ? [role] : current.includes(role) ? current.filter((entry) => entry !== role) : [...current.filter((entry) => entry !== "customer" && entry !== "superadmin"), role]);
  const changed = [...selected].sort().join() !== [...(user.roles ?? [user.role])].sort().join();
  return <tr><td><span className="user-cell"><span className="user-avatar">{user.displayName[0]}</span><strong>{user.displayName}</strong></span></td><td>{user.username}</td><td><div className="role-badges">{(user.roles ?? [user.role]).map((role) => <span className="role-pill" key={role}>{roleName[role]}</span>)}</div></td><td><div className="role-control role-multi">{options.map((role) => <label key={role}><input type="checkbox" checked={selected.includes(role)} disabled={user.id === me.id} onChange={() => toggle(role)} /> {roleName[role]}</label>)}<button disabled={!selected.length || !changed} onClick={() => act("setRoles", { userId: user.id, roles: selected }, `บันทึกสิทธิ์ ${user.username} แล้ว`)}>บันทึกสิทธิ์</button></div></td></tr>;
}

function ProductEditor({ product, onClose, act, setToast }: { product: Product | null; onClose: () => void; act: Act; setToast: (message: string) => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState(product?.category ?? "ของที่ระลึก");
  const [price, setPrice] = useState(product?.price ?? 0);
  const [stock, setStock] = useState(product?.stock ?? 0);
  const [image, setImage] = useState(product?.image ?? "/assets/souvenir-unbranded.png");
  const [sizes, setSizes] = useState(product?.sizes.join(", ") ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [uploading, setUploading] = useState(false);
  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try { const form = new FormData(); form.set("file", file); const response = await fetch("/api/product-image", { method: "POST", body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setImage(result.path); setToast("อัปโหลดรูปแล้ว กดบันทึกสินค้าเพื่อใช้รูปนี้"); }
    catch (error) { setToast(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ"); }
    finally { setUploading(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await act("saveProduct", { id: product?.id, name, description, category, price, stock, image, sizes: sizes.split(",").map((s) => s.trim()).filter(Boolean), active }, "บันทึกสินค้าแล้ว");
    if (result) onClose();
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="editor-modal" role="dialog" aria-modal="true" aria-label="แก้ไขสินค้า"><div className="editor-top"><div><span className="eyebrow">PRODUCT EDITOR</span><h2>{product ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h2></div><button className="modal-close" onClick={onClose} aria-label="ปิด"><X size={20} /></button></div><form onSubmit={submit}><div className="editor-image"><img src={image} alt="ตัวอย่างสินค้า" /><label className="button button-outline"><UploadCloud size={17} /> {uploading ? "กำลังอัปโหลด..." : "เปลี่ยนภาพสินค้า"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => uploadImage(event.target.files?.[0])} /></label></div><div className="editor-fields"><label>ชื่อสินค้า<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} /></label><label>ประเภท<input value={category} onChange={(event) => setCategory(event.target.value)} /></label><label className="span-two">รายละเอียด<textarea value={description} rows={3} onChange={(event) => setDescription(event.target.value)} /></label><label>ราคา (บาท)<input type="number" min="0" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></label><label>สต็อกทั้งหมด<input type="number" min="0" value={stock} onChange={(event) => setStock(Number(event.target.value))} /></label><label className="span-two">ไซซ์ คั่นด้วยจุลภาค (ปล่อยว่างได้)<input value={sizes} onChange={(event) => setSizes(event.target.value)} placeholder="S, M, L, XL" /></label><label className="toggle-label span-two"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> เปิดขายสินค้านี้</label></div><div className="editor-footer"><button type="button" className="button button-outline" onClick={onClose}>ยกเลิก</button><button type="submit" className="button button-dark">บันทึกสินค้า <Check size={17} /></button></div></form></div></div>;
}
