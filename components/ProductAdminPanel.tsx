"use client";

import { useMemo, useState } from "react";
import { Download, Package, Plus, Search, Trash2 } from "lucide-react";
import type { DemoOrder, DemoSnapshot, Product } from "@/lib/demo-types";

type Action = (action: string, payload: Record<string, unknown>, success: string, after?: () => void) => Promise<unknown>;
const baht = (amount: number) => new Intl.NumberFormat("th-TH").format(amount);
const statusName: Record<DemoOrder["status"], string> = {
  awaiting_slip: "รอสลิป", assisted_draft: "รอชำระ", under_review: "รอตรวจสลิป", needs_revision: "ขอสลิปใหม่",
  approved: "ชำระแล้ว", cancellation_review: "รอตรวจยอดยกเลิก", refund_pending: "รอคืนเงิน", refunded: "คืนเงินแล้ว", cancelled: "ยกเลิกแล้ว",
};

export default function ProductAdminPanel({ snapshot, act, onEdit, onCreate }: { snapshot: DemoSnapshot; act: Action; onEdit: (product: Product) => void; onCreate: () => void }) {
  const [category, setCategory] = useState("");
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const products = snapshot.products.filter((product) => !product.archived && (!category || product.category === category) && (!productId || product.id === productId) && (!query || [product.name, product.id, ...snapshot.orders.filter((order) => [...order.items, ...(order.cancelledItems ?? [])].some((item) => item.productId === product.id)).flatMap((order) => [snapshot.orderCustomers.find((person) => person.id === order.userId)?.displayName ?? "", snapshot.orderCustomers.find((person) => person.id === order.userId)?.phone ?? ""])].some((value) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase()))));
  const rows = useMemo(() => snapshot.orders.flatMap((order) => [
    ...order.items.map((item) => ({ order, item, cancelled: ["cancelled", "refunded"].includes(order.status) })),
    ...(order.cancelledItems ?? []).map((item) => ({ order, item, cancelled: true })),
  ]), [snapshot.orders]);
  const customerName = (id: string) => snapshot.orderCustomers.find((person) => person.id === id);
  const count = (product: Product, state?: string) => rows.filter((row) => row.item.productId === product.id && (!state || (row.cancelled ? state === "cancelled" : row.order.status === state))).reduce((sum, row) => sum + row.item.quantity, 0);
  const selected = snapshot.products.find((product) => product.id === productId);
  const detailRows = rows.filter((row) => row.item.productId === productId && (!status || (row.cancelled ? status === "cancelled" : row.order.status === status)) && (!query || [customerName(row.order.userId)?.displayName ?? "", customerName(row.order.userId)?.phone ?? "", row.order.id].some((text) => text.toLocaleLowerCase().includes(query.toLocaleLowerCase()))));
  const exportParams = new URLSearchParams();
  if (category) exportParams.set("category", category);
  if (productId) exportParams.set("productId", productId);
  if (status) exportParams.set("status", status);
  if (query) exportParams.set("q", query);
  const exportHref = `/api/export${exportParams.size ? `?${exportParams}` : ""}`;
  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`ลบ ${product.name} ออกจากรายการสินค้า? ระบบจะตรวจว่าลูกค้ายังถือรายการอยู่หรือไม่`)) return;
    await act("deleteProduct", { id: product.id }, "ลบสินค้าที่ไม่มีรายการค้างแล้ว");
    if (productId === product.id) setProductId("");
  };

  return <section className="admin-panel product-admin-panel"><div className="panel-head"><div><span className="eyebrow">MERCHANDISE CONTROL</span><h2>สินค้าและสถานะการสั่ง</h2></div><button className="button button-dark button-small" onClick={onCreate}><Plus size={17} /> เพิ่มสินค้าใหม่</button></div>
    <div className="product-admin-filters"><label>ประเภท<select value={category} onChange={(event) => { setCategory(event.target.value); setProductId(""); }}><option value="">ทุกประเภท</option>{snapshot.categories.map((entry) => <option key={entry}>{entry}</option>)}</select></label><label>สินค้า<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">เลือกสินค้า / ทุกสินค้า</option>{snapshot.products.filter((product) => !product.archived && (!category || product.category === category)).map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label>สถานะ<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(statusName).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>ค้นหา<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ชื่อสินค้า / ลูกค้า / เบอร์โทร" /></label></div>
    <div className="product-admin-actions"><span>{products.length} สินค้า · กดเลือกสินค้าเพื่อดูผู้สั่งและจำนวนแยกสถานะ</span><a className="button button-outline button-small" href={exportHref}><Download size={16} /> ส่งออก CSV</a></div>
    <div className="product-admin-list">{products.map((product) => <div className={`product-admin-row ${product.id === productId ? "selected" : ""}`} key={product.id}><button type="button" className="product-admin-select" onClick={() => setProductId(product.id)}><img src={product.image} alt="" /><span><strong>{product.name}</strong><small>{product.category} · ฿{baht(product.price)} · เหลือ {snapshot.productAvailable[product.id] ?? 0}/{product.stock}</small></span></button><div className="product-admin-counts"><span>ถือรายการ {count(product) - count(product, "cancelled")}</span><span>ยกเลิก {count(product, "cancelled")}</span></div><button type="button" className="product-admin-edit" onClick={() => onEdit(product)}>แก้ไข</button><button type="button" className="product-admin-delete" onClick={() => deleteProduct(product)} aria-label={`ลบ ${product.name}`}><Trash2 size={16} /></button></div>)}</div>
    {selected && <div className="product-admin-detail"><h3>ผู้สั่ง {selected.name}</h3><p>แสดงจำนวนและสถานะของแต่ละรายการ รวมถึงรายการที่เคยยกเลิก</p>{detailRows.length ? <div className="product-admin-order-list">{detailRows.map((row, index) => { const person = customerName(row.order.userId); const option = selected.options?.find((entry) => entry.id === row.item.optionId)?.label ?? row.item.size ?? ""; return <div key={`${row.order.id}-${row.item.id}-${index}`}><strong>{person?.displayName ?? row.order.userId}</strong><small>@{person?.username ?? ""} · {row.order.id}</small><span>{option ? `${option} · ` : ""}{row.item.quantity} ชิ้น</span><em className={row.cancelled ? "cancelled" : ""}>{row.cancelled ? "ยกเลิกแล้ว" : statusName[row.order.status]}</em></div>; })}</div> : <p className="muted"><Search size={16} /> ยังไม่มีรายการตามตัวกรองนี้</p>}</div>}
  </section>;
}
