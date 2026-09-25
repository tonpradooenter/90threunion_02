"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, CheckCircle2, ScanLine, ShieldCheck } from "lucide-react";

type Action = (action: string, payload: Record<string, unknown>, success: string, after?: () => void) => Promise<unknown>;
const ticketPattern = /^(?:[A-J]-(?:0[1-9]|[1-5][0-9]|60)-[1-8]-[A-Z0-9]+|PICK-[A-Z0-9]+)$/;

export default function GatePanel({ act, working }: { act: Action; working: boolean }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const processingRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);
  useEffect(() => () => stopCamera(), [stopCamera]);

  const checkCode = async (value: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setResult("");
    const normalized = value.trim().toUpperCase();
    const response = await act("scanTicket", { code: normalized }, "ตรวจสิทธิ์สำเร็จ");
    if (response && typeof response === "object" && "message" in response) {
      setResult(String(response.message));
      setCode("");
    } else setCode(normalized);
    processingRef.current = false;
  };

  const startCamera = async (selectedDevice = "") => {
    stopCamera();
    setCameraError("");
    setResult("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("เบราว์เซอร์นี้เปิดกล้องไม่ได้ กรุณาใช้ Chrome หรือ Edge ผ่าน localhost/HTTPS หรือกรอกรหัสด้านล่าง");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: selectedDevice ? { deviceId: { exact: selectedDevice } } : { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stopCamera(); return; }
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);
      const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
      setDevices(cameras);
      setDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? selectedDevice);
      const readFrame = (time: number) => {
        if (!streamRef.current) return;
        if (time - lastFrameRef.current >= 120 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          lastFrameRef.current = time;
          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d", { willReadFrequently: true });
          if (canvas && context && video.videoWidth && video.videoHeight) {
            const scale = Math.min(1, 900 / video.videoWidth);
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
            const scanned = found?.data.trim().toUpperCase();
            if (scanned && ticketPattern.test(scanned)) {
              stopCamera();
              setCode(scanned);
              void checkCode(scanned);
              return;
            }
          }
        }
        frameRef.current = requestAnimationFrame(readFrame);
      };
      frameRef.current = requestAnimationFrame(readFrame);
    } catch (error) {
      stopCamera();
      const name = error instanceof DOMException ? error.name : "";
      setCameraError(name === "NotAllowedError" ? "ยังไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาตในเบราว์เซอร์แล้วลองอีกครั้ง" : name === "NotFoundError" ? "ไม่พบเว็บแคมในเครื่องนี้" : "เปิดกล้องไม่สำเร็จ ลองเลือกกล้องอื่นหรือกรอกรหัสใต้ QR แทน");
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    stopCamera();
    await checkCode(code);
  };

  return <div className="admin-panel gate-panel">
    <span className="eyebrow">EVENT DAY OPERATIONS</span>
    <h2>ตรวจตั๋วและใบรับสินค้า</h2>
    <p>สแกน QR ด้วยเว็บแคม หรือกรอกรหัสใต้ QR เมื่อต้องการตรวจด้วยมือ</p>
    <div className={`gate-camera ${cameraOn ? "active" : ""}`}>
      <video ref={videoRef} autoPlay muted playsInline aria-label="ภาพจากกล้องสำหรับสแกน QR" />
      <canvas ref={canvasRef} hidden />
      <div className="gate-camera-frame"><span /><span /><span /><span /></div>
      {!cameraOn && <div className="gate-camera-placeholder"><ScanLine size={66} strokeWidth={1.2} /><strong>SCAN • VERIFY • WELCOME</strong><small>เปิดกล้องแล้วนำ QR บนตั๋วให้อยู่ในกรอบ</small></div>}
    </div>
    <div className="gate-camera-actions">
      <button type="button" className={`button ${cameraOn ? "button-outline" : "button-dark"}`} onClick={() => cameraOn ? stopCamera() : void startCamera()}>{cameraOn ? <CameraOff size={18} /> : <Camera size={18} />}{cameraOn ? "ปิดกล้อง" : "เปิดกล้องสแกน QR"}</button>
      {cameraOn && devices.length > 1 && <label>เลือกกล้อง<select value={deviceId} onChange={(event) => void startCamera(event.target.value)}>{devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `กล้อง ${index + 1}`}</option>)}</select></label>}
    </div>
    {cameraError && <p className="gate-camera-error" role="alert">{cameraError}</p>}
    <form onSubmit={submit}><label htmlFor="ticket-code">รหัสตั๋ว / รหัสรับสินค้า</label><div><input id="ticket-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="เช่น A-01-1-ABCD หรือ PICK-1234" required /><button className="button button-dark" disabled={working}><ScanLine size={18} /> ตรวจสิทธิ์</button></div></form>
    {result && <div className="gate-result" role="status"><CheckCircle2 size={20} /> {result}</div>}
    <div className="gate-warning"><ShieldCheck size={18} /> รหัสหนึ่งใบใช้ได้ครั้งเดียว ระบบบันทึกการใช้งานทันที</div>
  </div>;
}
