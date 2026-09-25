"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, Eye, ImagePlus, RotateCcw, Save, ShieldCheck } from "lucide-react";
import type { DemoSnapshot, EventSettings, SiteBranding } from "@/lib/demo-types";

type Action = (action: string, payload: Record<string, unknown>, success: string, after?: () => void) => Promise<unknown>;
type TimingKey = "tableHoldMinutes" | "productHoldMinutes" | "assistedTableHoldMinutes" | "assistedProductHoldMinutes" | "revisionHoldMinutes";
const timingFields: { key: TimingKey; title: string; detail: string }[] = [
  { key: "tableHoldMinutes", title: "ลูกค้าจองโต๊ะเอง", detail: "เวลาส่งสลิปก่อนปล่อยโต๊ะให้ผู้อื่น" },
  { key: "productHoldMinutes", title: "ลูกค้าสั่งสินค้าเอง", detail: "เวลาส่งสลิปก่อนคืนสต็อก" },
  { key: "assistedTableHoldMinutes", title: "เจ้าหน้าที่รับจองโต๊ะ", detail: "โทรศัพท์ / LINE / หน้าเคาน์เตอร์" },
  { key: "assistedProductHoldMinutes", title: "เจ้าหน้าที่รับสั่งสินค้า", detail: "โทรศัพท์ / LINE / หน้าเคาน์เตอร์" },
  { key: "revisionHoldMinutes", title: "ส่งสลิปใหม่หลังถูกตีกลับ", detail: "เริ่มนับใหม่เมื่อการเงินขอภาพใหม่" },
];
const assets: { key: keyof SiteBranding; title: string; size: string; transparent?: boolean }[] = [
  { key: "eventLogo", title: "โลโก้งาน 90 ปี", size: "PNG/WebP โปร่งใส · อย่างน้อย 256×256 px", transparent: true },
  { key: "ovcLogo", title: "ตรา สอศ.", size: "PNG/WebP โปร่งใส · อย่างน้อย 256×256 px", transparent: true },
  { key: "heroDesktop", title: "ภาพหน้าแรกบนคอม", size: "แนะนำ 1920×1080 px · ขั้นต่ำ 1200×600 px" },
  { key: "heroMobile", title: "ภาพหน้าแรกบนมือถือ", size: "แนะนำ 1080×1440 px · ขั้นต่ำ 600×800 px" },
  { key: "introImage", title: "ภาพแนะนำงาน", size: "แนะนำ 1200×900 px · ขั้นต่ำ 800×550 px" },
  { key: "tableBanner", title: "ภาพหน้าจองโต๊ะ", size: "แนะนำ 1600×900 px · ขั้นต่ำ 800×450 px" },
  { key: "shopBanner", title: "ภาพหน้าร้าน", size: "แนะนำ 1600×900 px · ขั้นต่ำ 800×450 px" },
  { key: "closingImage", title: "ภาพปิดท้ายหน้าแรก", size: "แนะนำ 1600×700 px · ขั้นต่ำ 1200×500 px" },
];
const textFields: { key: keyof SiteBranding; title: string; long?: boolean }[] = [
  { key: "brandName", title: "ชื่อที่แสดงข้างโลโก้" }, { key: "brandSubtitle", title: "คำอธิบายข้างโลโก้" },
  { key: "kicker", title: "คำโปรยเหนือชื่อใหญ่" }, { key: "heroTitle", title: "หัวข้อหน้าแรกบรรทัดแรก" },
  { key: "heroAccent", title: "หัวข้อหน้าแรกบรรทัดสีเด่น" }, { key: "heroLead", title: "คำแนะนำบรรทัดแรก", long: true },
  { key: "heroLeadSecond", title: "คำแนะนำบรรทัดที่สอง", long: true },
  { key: "venueText", title: "ข้อความสถานที่" }, { key: "dateText", title: "ข้อความวันงาน" },
  { key: "welcomeText", title: "ข้อความแถบต้อนรับ", long: true },
  { key: "introTitle", title: "หัวข้อแนะนำงาน" }, { key: "introAccent", title: "หัวข้อแนะนำงานสีเด่น" },
  { key: "introBody", title: "รายละเอียดแนะนำงาน", long: true },
  { key: "tableTitle", title: "หัวข้อโซนโต๊ะ" }, { key: "tableDescription", title: "รายละเอียดโซนโต๊ะ", long: true },
  { key: "shopTitle", title: "หัวข้อร้านสินค้า" }, { key: "shopDescription", title: "รายละเอียดร้านสินค้า", long: true },
  { key: "stepsTitle", title: "หัวข้อขั้นตอน" }, { key: "stepsAccent", title: "หัวข้อขั้นตอนบรรทัดสอง" },
  { key: "closingTitle", title: "หัวข้อปิดท้าย" }, { key: "closingAccent", title: "หัวข้อปิดท้ายบรรทัดสอง" },
  { key: "ctaTables", title: "ข้อความปุ่มจองโต๊ะ" }, { key: "ctaShop", title: "ข้อความปุ่มร้านสินค้า" },
];

function TimingInput({ title, detail, value, onChange }: { title: string; detail: string; value: number; onChange: (value: number) => void }) {
  const initial = value % 1440 === 0 ? 1440 : value % 60 === 0 ? 60 : 1;
  const [unit, setUnit] = useState(initial);
  return <div className="site-timing-row"><div><strong>{title}</strong><small>{detail}</small></div><div className="site-timing-entry"><input aria-label={title} type="number" min={1 / unit} max={43200 / unit} step="any" value={unit === 1 ? value : Number((value / unit).toFixed(3))} onChange={(event) => onChange(Math.max(1, Math.round(Number(event.target.value) * unit)))} /><select aria-label={`หน่วยของ ${title}`} value={unit} onChange={(event) => { const next = Number(event.target.value); setUnit(next); }}><option value={1}>นาที</option><option value={60}>ชั่วโมง</option><option value={1440}>วัน</option></select></div></div>;
}

function Preview({ draft, mobile }: { draft: SiteBranding; mobile: boolean }) {
  return <div className={`site-preview ${mobile ? "site-preview-mobile" : "site-preview-desktop"}`}><div className="site-preview-label"><Eye size={15} /> {mobile ? "ตัวอย่างมือถือ" : "ตัวอย่างคอมพิวเตอร์"}</div><div className="site-preview-stage" style={{ backgroundImage: `linear-gradient(90deg,rgba(7,26,62,.9),rgba(7,26,62,.12)),url("${mobile ? draft.heroMobile : draft.heroDesktop}")` }}>
    <div className="site-preview-brand"><img src={draft.eventLogo} alt="โลโก้งานตัวอย่าง" /><strong>{draft.brandName}</strong><img src={draft.ovcLogo} alt="ตรา สอศ. ตัวอย่าง" /></div>
    <small>{draft.kicker}</small><h3>{draft.heroTitle}<br /><em style={{ color: draft.accentColor }}>{draft.heroAccent}</em></h3>
    <p>{draft.heroLead}<br />{draft.heroLeadSecond}</p><span style={{ background: draft.accentColor }}>{draft.ctaTables}</span>
  </div></div>;
}

export default function SiteSettingsPanel({ snapshot, act, working, setToast }: { snapshot: DemoSnapshot; act: Action; working: boolean; setToast: (message: string) => void }) {
  const [timing, setTiming] = useState<EventSettings>(snapshot.settings);
  const [draft, setDraft] = useState<SiteBranding>(snapshot.settings.branding);
  const [uploading, setUploading] = useState("");
  useEffect(() => { setTiming(snapshot.settings); setDraft(snapshot.settings.branding); }, [snapshot.settings]);
  const changeTiming = (key: TimingKey, value: number) => setTiming((current) => ({ ...current, [key]: value }));
  const changeBrand = (key: keyof SiteBranding, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const uploadImage = async (key: keyof SiteBranding, file?: File) => {
    if (!file) return;
    setUploading(key);
    try {
      const form = new FormData(); form.set("slot", key); form.set("file", file);
      const response = await fetch("/api/site-image", { method: "POST", body: form });
      const body = await response.json() as { error?: string; path?: string };
      if (!response.ok || !body.path) throw new Error(body.error ?? "อัปโหลดภาพไม่สำเร็จ");
      changeBrand(key, body.path); setToast("ภาพอยู่ในฉบับร่างแล้ว กรุณาดูตัวอย่างก่อนเผยแพร่");
    } catch (error) { setToast(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ"); }
    finally { setUploading(""); }
  };
  const saveTiming = () => {
    if (Object.values(timing).some((value) => typeof value === "number" && !Number.isFinite(value))) { setToast("กรุณาตรวจค่าตัวเลข"); return; }
    void act("saveOperationalSettings", {
      tableHoldMinutes: timing.tableHoldMinutes, productHoldMinutes: timing.productHoldMinutes,
      assistedTableHoldMinutes: timing.assistedTableHoldMinutes, assistedProductHoldMinutes: timing.assistedProductHoldMinutes,
      revisionHoldMinutes: timing.revisionHoldMinutes, idleSeconds: timing.idleSeconds,
    }, "บันทึกเวลาสำหรับออเดอร์ใหม่และ session แล้ว");
  };
  const publish = () => {
    if (!window.confirm("ยืนยันเผยแพร่ข้อความ สี และภาพที่ดูตัวอย่างแล้ว? ผู้เข้าชมจะเห็นการเปลี่ยนแปลงทันที")) return;
    void act("publishBranding", { branding: draft }, "เผยแพร่หน้าเว็บแล้ว");
  };
  const restore = (index: number) => {
    if (!window.confirm("ยืนยันย้อนหน้าเว็บไปฉบับนี้?")) return;
    void act("restoreBranding", { revisionIndex: index }, "ย้อนหน้าเว็บแล้ว");
  };
  return <div className="site-settings-page">
    <section className="admin-panel"><div className="panel-head"><div><span className="eyebrow">ORDER TIMERS</span><h2>ระยะเวลากันโต๊ะและสินค้า</h2></div><Clock3 size={22} /></div>
      <p className="site-settings-note">ค่าที่เปลี่ยนจะใช้กับออเดอร์ใหม่เท่านั้น ออเดอร์ที่ส่งสลิปแล้วจะคงสิทธิ์ไว้ระหว่างการเงินตรวจ</p>
      <div className="site-timing-list">{timingFields.map((field) => <TimingInput key={field.key} title={field.title} detail={field.detail} value={timing[field.key]} onChange={(value) => changeTiming(field.key, value)} />)}</div>
      <div className="site-idle-row"><ShieldCheck size={20} /><label>ออกจากระบบเมื่อไม่มีการใช้งาน <input type="number" min={30} max={3600} value={timing.idleSeconds} onChange={(event) => setTiming((current) => ({ ...current, idleSeconds: Number(event.target.value) }))} /> วินาที</label><small>เริ่มต้น 300 วินาที · มีคำเตือนก่อนออกจากระบบ · มีผลกับ session ที่เปิดอยู่</small></div>
      <button className="button button-dark" disabled={working} onClick={saveTiming}><Save size={17} /> บันทึกเวลา</button>
    </section>
    <section className="admin-panel"><div className="panel-head"><div><span className="eyebrow">SITE APPEARANCE</span><h2>ภาพลักษณ์หน้าเว็บ</h2></div><span className="panel-note">ฉบับร่าง · ยังไม่เผยแพร่</span></div>
      <p className="site-settings-note">เปลี่ยนภาพและข้อความในฉบับร่างแล้วดูตัวอย่างทั้งสองขนาดก่อนกดเผยแพร่ โลโก้ใช้ไฟล์จริงเท่านั้น</p>
      <div className="site-color-row"><label>สีหลัก<input type="color" value={draft.primaryColor} onChange={(event) => changeBrand("primaryColor", event.target.value)} /><span>{draft.primaryColor}</span></label><label>สีเน้น<input type="color" value={draft.accentColor} onChange={(event) => changeBrand("accentColor", event.target.value)} /><span>{draft.accentColor}</span></label></div>
      <div className="site-settings-subhead"><h3>ภาพและโลโก้</h3><small>ภาพแต่ละช่องใช้ทั้งเว็บและมือถือจาก console เดียว · สูงสุด 5 MB ต่อภาพ</small></div>
      <div className="site-asset-grid">{assets.map((asset) => <div className="site-asset" key={asset.key}><div className="site-asset-thumb">{draft[asset.key] ? <img src={draft[asset.key]} alt={asset.title} /> : <ImagePlus size={26} />}</div><div><strong>{asset.title}</strong><small>{asset.size}</small><label className="button button-outline button-small"><ImagePlus size={16} /> {uploading === asset.key ? "กำลังตรวจภาพ..." : "เลือกภาพ"}<input type="file" accept={asset.transparent ? "image/png,image/webp" : "image/png,image/jpeg,image/webp"} disabled={!!uploading} onChange={(event) => { void uploadImage(asset.key, event.target.files?.[0]); event.target.value = ""; }} /></label></div></div>)}</div>
      <div className="site-settings-subhead"><h3>ข้อความหน้า Home</h3><small>ข้อความจะตัดบรรทัดตามขนาดหน้าจออัตโนมัติ</small></div>
      <div className="site-copy-grid">{textFields.map((field) => <label key={field.key} className={field.long ? "wide" : ""}>{field.title}{field.long ? <textarea rows={2} maxLength={500} value={draft[field.key]} onChange={(event) => changeBrand(field.key, event.target.value)} /> : <input maxLength={500} value={draft[field.key]} onChange={(event) => changeBrand(field.key, event.target.value)} />}</label>)}</div>
      <div className="site-settings-subhead"><h3>ดูตัวอย่างก่อนเผยแพร่</h3><small>แสดงข้อความ โลโก้ สี และภาพหน้าแรกจากฉบับร่าง</small></div>
      <div className="site-preview-grid"><Preview draft={draft} mobile={false} /><Preview draft={draft} mobile /></div>
      <div className="site-publish-actions"><button className="button button-outline" onClick={() => setDraft(snapshot.settings.branding)}><RotateCcw size={16} /> กลับค่าที่เผยแพร่</button><button className="button button-dark" disabled={working || !!uploading} onClick={publish}><Check size={17} /> เผยแพร่หน้าเว็บ</button></div>
      {!!snapshot.brandingHistory.length && <div className="site-revision-list"><h3>ฉบับก่อนหน้า</h3>{snapshot.brandingHistory.map((revision, index) => <div key={`${revision.at}-${index}`}><span>{new Date(revision.at).toLocaleString("th-TH")} · {revision.branding.heroTitle} {revision.branding.heroAccent}</span><button type="button" onClick={() => restore(index)}>ย้อนกลับฉบับนี้</button></div>)}</div>}
    </section>
  </div>;
}