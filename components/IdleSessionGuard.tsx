"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";

export default function IdleSessionGuard({ userId, idleSeconds }: { userId: string | undefined; idleSeconds: number }) {
  const lastActivity = useRef(Date.now());
  const lastPing = useRef(Date.now());
  const sending = useRef(false);
  const expired = useRef(false);
  const [remaining, setRemaining] = useState(idleSeconds);
  useEffect(() => {
    if (!userId) return;
    lastActivity.current = Date.now(); lastPing.current = Date.now(); expired.current = false;
    const end = () => { if (!expired.current) { expired.current = true; window.location.reload(); } };
    const ping = async () => {
      if (sending.current || expired.current) return;
      sending.current = true;
      try {
        const response = await fetch("/api/session/activity", { method: "POST", cache: "no-store" });
        if (response.status === 401) end();
        else if (response.ok) lastPing.current = Date.now();
      } catch { /* The next genuine interaction will retry. */ }
      finally { sending.current = false; }
    };
    const activity = () => {
      const now = Date.now();
      if (now - lastActivity.current >= idleSeconds * 1000) { end(); return; }
      lastActivity.current = now;
      setRemaining(idleSeconds);
      if (now - lastPing.current >= 60_000) void ping();
    };
    const check = () => {
      const seconds = Math.max(0, Math.ceil((idleSeconds * 1000 - (Date.now() - lastActivity.current)) / 1000));
      setRemaining(seconds);
      if (seconds === 0) end();
    };
    void ping();
    for (const name of ["pointerdown", "keydown", "touchstart", "scroll"]) window.addEventListener(name, activity, { passive: true });
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 1000);
    return () => {
      for (const name of ["pointerdown", "keydown", "touchstart", "scroll"]) window.removeEventListener(name, activity);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, [userId, idleSeconds]);
  if (!userId || remaining > 60) return null;
  return <div className="idle-warning" role="alert"><Clock3 size={19} /><span>ไม่มีการใช้งาน ระบบจะออกจากบัญชีใน <strong>{remaining} วินาที</strong></span><button type="button" onClick={() => { lastActivity.current = Date.now(); setRemaining(idleSeconds); void fetch("/api/session/activity", { method: "POST", cache: "no-store" }).then((response) => { if (!response.ok) window.location.reload(); else lastPing.current = Date.now(); }); }}>ใช้งานต่อ</button></div>;
}