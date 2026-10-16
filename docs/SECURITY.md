# ขอบเขตความปลอดภัยของ v1.1

## API และข้อมูลที่ browser เห็น

URL ของ API และข้อมูลที่บัญชีนั้นมีสิทธิ์ใช้ ยังคงดูได้ใน Network ของ browser ไม่มีการใส่กุญแจถอดรหัสลับไว้ใน JavaScript เพื่อทำให้ดูเหมือนซ่อนข้อมูล

- HTTPS/TLS ของ subdomain เข้ารหัสข้อมูลระหว่าง browser กับ Plesk; ต้องเปิด redirect HTTP → HTTPS ใน Plesk
- ตรวจ session, เจ้าของออเดอร์ และบทบาทที่ server ทุกคำสั่ง
- GET snapshot และ POST ผลการทำรายการใช้การกรอง field เดียวกัน ไม่ส่ง passwordHash, session หรือ field ลับที่เพิ่มภายหลังอัตโนมัติ
- ไม่ส่งคำสั่งซื้อ/รายชื่อลูกค้าให้ผู้ไม่ login; ลูกค้าไม่เห็นออเดอร์คนอื่น
- สลิป: เจ้าของรายการ, finance และ superadmin เท่านั้น; รหัสตั๋ว: เจ้าของและ superadmin
- สถานะลูกค้าร่วมกันยังให้เจ้าหน้าที่ดูได้ตาม requirement; export ตัดข้อมูลอ่อนไหวตามสิทธิ์เช่นเดียวกับหน้าเว็บ
- .env.local, DB_PASSWORD, DEMO_PASSWORD และกุญแจสลิปอยู่ server เท่านั้น ไม่ใช้ NEXT_PUBLIC_ และไม่อยู่ Git/source ZIP

## การเข้ารหัสและรหัสผ่าน

- ไฟล์สลิปใหม่เข้ารหัส AES-256-GCM ด้วยกุญแจสุ่ม 256 บิตและ nonce ใหม่ต่อไฟล์ ตรวจ authentication tag ก่อนแสดงภาพ
- security:migrate ย้ายสลิปเก่าแบบ atomic ต่อไฟล์ รันซ้ำได้ ข้อมูลออเดอร์และชื่อไฟล์อ้างอิงคงเดิม
- เก็บกุญแจใน storage ส่วนตัว permissions 600; สำรองและป้องกันกุญแจแยกจาก ciphertext
- รหัสผ่านใช้ scrypt แบบ salt ต่อ hash ไม่เก็บรหัสผ่านถอดกลับได้
- รุ่นนี้ไม่ได้เข้ารหัส MariaDB ทั้งฐานในระดับ application: ชื่อ เบอร์ และรายละเอียดออเดอร์ยังอยู่ในฐานสำหรับค้นหา/ประมวลผล ผู้ใช้ DB ของเว็บต้องมีสิทธิ์เฉพาะฐานนี้และรับ local connection เท่านั้น
- การเข้ารหัสดิสก์/backup ของโฮสต์และการป้องกันบัญชี Plesk เป็นหน้าที่ผู้ดูแล hosting; ไม่อ้างว่า AES ของสลิปป้องกันบัญชีโฮสต์ถูกยึดได้

## การป้องกันเพิ่ม

- Cookie ของ production ใช้ HttpOnly, Secure และ SameSite=Strict; ตรวจ idle session และบัญชี active
- ตรวจ Origin ที่ตรง APP_ORIGIN ก่อน mutation ปฏิเสธข้ามเว็บ
- จำกัดขนาด JSON และสลิป 3 รูป รูปละ 5 MB; ตรวจชนิดภาพจริง ไม่รับ script/SVG เป็นสลิป
- ลอง login ได้ 12 ครั้งต่อนาทีต่อชื่อผู้ใช้ต่อ process จากนั้นตอบ 429 พร้อม Retry-After
- ข้อจำกัด login เป็น backstop ต่อ Passenger worker; ยังต้องใช้ WAF/rate limit ของโฮสต์เพื่อป้องกัน distributed attacks
- CSP จำกัด resource ให้ same origin, ห้าม object และ inline event attributes; HSTS ทำให้ browser จดจำ HTTPS ของ subdomain นี้
- ปิด production browser source maps และตั้ง API เป็น private/no-store
- CSP ยังอนุญาต inline framework script และ style ตามการทำงานของ Next.js; ไม่อ้างว่าเป็น nonce-only CSP
- health เปิดได้โดยไม่ login แต่แสดงเพียง ok/unavailable และเลขรุ่นแอป ไม่แสดง connection string หรือ error ภายใน

## การตรวจ

Unit tests: allowlist ของ user/order, ผู้ซื้อคนอื่น, การเข้ารหัส/แก้ไข ciphertext, login limit

Linux API tests: สิทธิ์หกบทบาท, ข้ามบัญชี/ข้ามเว็บ, private files, ขนาดสลิป, 30 competing bookings, QR reuse, migration สลิปเก่า, refund, XLSX

Browser tests: Chromium/WebKit ตรวจ home, login, orders, overflow และตำแหน่งเมนูล่างในขนาด mobile/tablet/desktop

ผลทดสอบเหล่านี้ไม่ใช่ penetration test ของ Hostatom หรือการรับรองเปิดรับเงินจริง

## อ้างอิง

- https://nextjs.org/docs/app/guides/data-security
- https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
