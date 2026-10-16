# Changelog

## v1.0.0-demo

รุ่นทดลองสำหรับ Hostatom Plesk บน subdomain แยก ใช้ Node.js 24 + Next.js + MariaDB 11.8

- เพิ่ม MariaDB adapter โดยยังเลือก PostgreSQL เดิมผ่าน DATABASE_URL ได้
- transaction lock บน InnoDB ป้องกันคำสั่งพร้อมกันขายโต๊ะ/สินค้าเกินจำนวน; ตรวจด้วย 30 concurrent requests
- ตั้ง DB_* เป็นช่องแยกใน Plesk ได้ ไม่ต้อง encode รหัสฐานข้อมูลเป็น URL
- เพิ่ม app.cjs สำหรับ Passenger และ API health สำหรับตรวจหลังติดตั้ง
- private persistent storage แยกจาก document root; รูปสินค้า/หน้า Home ใหม่เสิร์ฟผ่าน API
- APP_ORIGIN รองรับ HTTPS reverse proxy และ cookie ของเว็บแยกจาก WordPress
- seed ข้อมูลสาธิตใหม่ ไม่อัปโหลดฐานในเครื่อง; production บังคับรหัสทดลองเฉพาะและไม่เผยรหัสบนหน้าเว็บ
- portable MariaDB local แยกจาก PostgreSQL เดิม พร้อม setup/start/stop
- GitHub CI บน Linux/MariaDB, source ZIP, คู่มือติดตั้งและ rollback

ยังเป็นเดโม: Google/LINE ยังไม่เชื่อมจริง, ไม่โอนเงินอัตโนมัติ, ไม่ใช่การรับรองรองรับผู้ใช้จริง 3,000–4,000 คน การทดสอบบน shared hosting เป้าหมาย 30 คนต้องทำหลังติดตั้งบนโฮสต์
