"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, Search, Trash2, X } from "lucide-react";
import type { DemoSnapshot, PublicUser, Role } from "@/lib/demo-types";

type Action = (action: string, payload: Record<string, unknown>, success: string, after?: () => void) => Promise<unknown>;
const options: Role[] = ["tables", "merch", "finance", "gate", "customer", "superadmin"];
const roleName: Record<Role, string> = { superadmin: "ผู้ดูแลระบบหลัก", tables: "ฝ่ายโต๊ะจีน", merch: "ฝ่ายของที่ระลึก", finance: "ฝ่ายการเงิน", gate: "ฝ่ายหน้างาน", customer: "ลูกค้า" };

function EditUser({ user, onClose, act }: { user: PublicUser; onClose: () => void; act: Action }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(user.active);
  const [working, setWorking] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setWorking(true);
    try {
      const result = await act("updateUser", { userId: user.id, displayName, username, phone, password, active }, "บันทึกข้อมูลบัญชีแล้ว");
      if (result) onClose();
    } finally { setWorking(false); }
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="user-edit-modal" role="dialog" aria-modal="true" aria-label={`แก้ไขบัญชี ${user.displayName}`}><div className="editor-top"><div><span className="eyebrow">ACCOUNT CONTROL</span><h2>แก้ไขบัญชี</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="ปิด"><X size={20} /></button></div><form onSubmit={save}><p>ID {user.id}</p><label>ชื่อที่แสดง<input required minLength={2} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label>ชื่อผู้ใช้<input required minLength={4} value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} /></label><label>เบอร์โทร<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="ถ้ามี" /></label><label>ตั้งรหัสผ่านใหม่<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="เว้นว่างถ้าไม่เปลี่ยน" /></label><label className="user-active"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> เปิดใช้งานบัญชี</label><div className="editor-footer"><button type="button" className="button button-outline" onClick={onClose}>ยกเลิก</button><button type="submit" className="button button-dark" disabled={working}>บันทึกข้อมูล <Check size={16} /></button></div></form></div></div>;
}

function UserRow({ user, me, act }: { user: PublicUser; me: PublicUser; act: Action }) {
  const [selected, setSelected] = useState<Role[]>(user.roles ?? [user.role]);
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setSelected(user.roles ?? [user.role]); }, [user.roles, user.role]);
  const toggle = (role: Role) => setSelected((current) => role === "customer" || role === "superadmin" ? [role] : current.includes(role) ? current.filter((entry) => entry !== role) : [...current.filter((entry) => entry !== "customer" && entry !== "superadmin"), role]);
  const changed = [...selected].sort().join() !== [...(user.roles ?? [user.role])].sort().join();
  const saveRoles = async () => { const result = await act("setRoles", { userId: user.id, roles: selected }, `บันทึกสิทธิ์ ${user.username} แล้ว`); if (result) setConfirm(false); };
  const deleteUser = () => {
    if (!window.confirm(`ลบหรือปิดบัญชี ${user.displayName}? บัญชีที่มีประวัติจะถูกปิดและเก็บข้อมูลอ้างอิงไว้`)) return;
    void act("deleteUser", { userId: user.id }, "ดำเนินการกับบัญชีแล้ว");
  };
  return <div className={`user-management-row ${user.active ? "" : "inactive"}`}><div className="user-management-head"><span className="user-avatar">{user.displayName[0]}</span><div><strong>{user.displayName}</strong><small>@{user.username} · ID {user.id}{user.phone ? ` · ${user.phone}` : ""}</small></div><span className="user-management-state">{user.active ? "ใช้งาน" : "ปิดบัญชี"}</span></div><div className="role-badges">{(user.roles ?? [user.role]).map((role) => <span className="role-pill" key={role}>{roleName[role]}</span>)}</div><div className="role-control role-multi">{options.map((role) => <label key={role}><input type="checkbox" checked={selected.includes(role)} disabled={user.id === me.id || !user.active} onChange={() => toggle(role)} /> {roleName[role]}</label>)}</div><div className="user-management-actions"><button type="button" className="button button-outline button-small" onClick={() => setEditing(true)}><Pencil size={15} /> แก้ข้อมูล</button><button type="button" className="button button-outline button-small" disabled={!selected.length || !changed || !user.active} onClick={() => setConfirm(true)}>ตรวจสอบก่อนเปลี่ยนสิทธิ์</button><button type="button" className="user-delete" disabled={user.id === me.id} onClick={deleteUser}><Trash2 size={15} /> ลบบัญชี</button></div>
    {editing && <EditUser user={user} onClose={() => setEditing(false)} act={act} />}
    {confirm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirm(false); }}><div className="role-confirm" role="dialog" aria-modal="true" aria-label="ยืนยันเปลี่ยนบทบาท"><div className="editor-top"><div><span className="eyebrow">CONFIRM ROLES</span><h2>ยืนยันสิทธิ์ของ {user.displayName}</h2></div><button className="modal-close" onClick={() => setConfirm(false)} aria-label="ปิด"><X size={20} /></button></div><p><strong>เดิม:</strong> {(user.roles ?? [user.role]).map((role) => roleName[role]).join(" + ")}</p><p><strong>ใหม่:</strong> {selected.map((role) => roleName[role]).join(" + ")}</p><div className="editor-footer"><button className="button button-outline" onClick={() => setConfirm(false)}>กลับไปแก้</button><button className="button button-dark" onClick={saveRoles}>ยืนยันเปลี่ยนสิทธิ์ <Check size={16} /></button></div></div></div>}
  </div>;
}

export default function UserAdminPanel({ snapshot, act }: { snapshot: DemoSnapshot; act: Action }) {
  const [query, setQuery] = useState("");
  const users = snapshot.users.filter((user) => [user.displayName, user.username, user.phone ?? "", user.id].some((value) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  return <section className="admin-panel"><div className="panel-head"><div><span className="eyebrow">ACCESS CONTROL</span><h2>บัญชีและบทบาท</h2></div><span className="panel-note">เฉพาะผู้ดูแลระบบหลัก</span></div><label className="activity-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ ชื่อผู้ใช้ เบอร์โทร หรือ ID" /></label><div className="user-management-list">{users.map((user) => <UserRow key={user.id} user={user} me={snapshot.me!} act={act} />)}</div><p className="panel-help">การเลือก checkbox ยังไม่มีผลจนกว่าจะกดตรวจสอบและยืนยัน · บัญชีที่มีประวัติจะปิดใช้งานแทนการลบหลักฐาน</p></section>;
}
