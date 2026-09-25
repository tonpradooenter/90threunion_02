"use client";

import { useState } from "react";
import { Check, Plus, Trash2, UploadCloud, X } from "lucide-react";
import type { Product } from "@/lib/demo-types";

type Action = (action: string, payload: Record<string, unknown>, success: string, after?: () => void) => Promise<unknown>;
type Option = { id: string; label: string };

export default function ProductEditor({ product, categories, onClose, act, setToast }: {
  product: Product | null; categories: string[]; onClose: () => void; act: Action; setToast: (message: string) => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState(product?.category ?? categories[0] ?? "เสื้อ");
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [price, setPrice] = useState(product?.price ?? 0);
  const [stock, setStock] = useState(product?.stock ?? 0);
  const [image, setImage] = useState(product?.image ?? "/assets/souvenir-unbranded.png");
  const [options, setOptions] = useState<Option[]>(product?.options ?? (product?.sizes ?? []).map((label, index) => ({ id: `${product?.id}-option-${index + 1}`, label })));
  const [active, setActive] = useState(product?.active ?? true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/product-image", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setImage(result.path);
      setToast("อัปโหลดรูปแล้ว กดบันทึกสินค้าเพื่อใช้รูปนี้");
    } catch (error) { setToast(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ"); }
    finally { setUploading(false); }
  };
  const saveCategory = async () => {
    const result = await act("addCategory", { name: newCategory }, "เพิ่มประเภทสินค้าแล้ว") as { category?: string } | null;
    if (result?.category) { setCategory(result.category); setNewCategory(""); setAddingCategory(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      const result = await act("saveProduct", { id: product?.id, name, description, category, price, stock, image, options, active }, "บันทึกสินค้าแล้ว");
      if (result) onClose();
    } finally { setSaving(false); }
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="editor-modal" role="dialog" aria-modal="true" aria-label="แก้ไขสินค้า">
    <div className="editor-top"><div><span className="eyebrow">PRODUCT EDITOR</span><h2>{product ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="ปิด"><X size={20} /></button></div>
    <form onSubmit={submit}><div className="editor-image"><img src={image} alt="ตัวอย่างสินค้า" /><label className="button button-outline"><UploadCloud size={17} /> {uploading ? "กำลังอัปโหลด..." : "เปลี่ยนภาพสินค้า"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => uploadImage(event.target.files?.[0])} /></label></div>
      <div className="editor-fields"><label>ชื่อสินค้า<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} /></label><label>ประเภทสินค้า<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        <div className="span-two category-add"><button type="button" onClick={() => setAddingCategory((value) => !value)}><Plus size={15} /> เพิ่มประเภทอื่น</button>{addingCategory && <div><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="ชื่อประเภทใหม่" /><button type="button" disabled={newCategory.trim().length < 2} onClick={saveCategory}>บันทึกประเภท</button></div>}</div>
        <label className="span-two">รายละเอียด<textarea value={description} rows={3} onChange={(event) => setDescription(event.target.value)} /></label><label>ราคา (บาท)<input type="number" min="0" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></label><label>สต็อกทั้งหมด<input type="number" min="0" value={stock} onChange={(event) => setStock(Number(event.target.value))} /></label>
        <div className="span-two product-options"><div className="product-options-head"><div><strong>คุณลักษณะสินค้า</strong><small>เช่น ไซซ์ S, M, L หรือสีแดง/น้ำเงิน · แก้ชื่อแล้วออเดอร์ที่อ้าง ID นี้จะแสดงชื่อใหม่</small></div><button type="button" onClick={() => setOptions((current) => [...current, { id: "", label: "" }])}><Plus size={16} /> เพิ่มตัวเลือก</button></div>{options.map((option, index) => <div className="product-option-row" key={option.id || `new-${index}`}><span>{index + 1}</span><input aria-label={`คุณลักษณะที่ ${index + 1}`} value={option.label} onChange={(event) => setOptions((current) => current.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))} placeholder="เช่น น้ำเงิน" /><small>{option.id || "ID ใหม่เมื่อบันทึก"}</small><button type="button" aria-label={`ลบคุณลักษณะที่ ${index + 1}`} onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}><Trash2 size={16} /></button></div>)}</div>
        <label className="toggle-label span-two"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> เปิดขายสินค้านี้</label></div>
      <div className="editor-footer"><button type="button" className="button button-outline" onClick={onClose}>ยกเลิก</button><button type="submit" className="button button-dark" disabled={saving || uploading}>บันทึกสินค้า <Check size={17} /></button></div>
    </form>
  </div></div>;
}
