# SISAT 90 Reunion — v1.1.0 Demo

เว็บคืนสู่เหย้า 90 ปี วิทยาลัยเทคนิคศรีสะเกษ ใช้ **Next.js + Node.js 24 + MariaDB 11.8** สำหรับทดลองบน Hostatom/Plesk เป้าหมายผู้ทดสอบไม่เกิน 30 คนพร้อมกัน ยังเป็นข้อมูลสาธิต ไม่มีการโอนเงินอัตโนมัติ

- **รุ่นสำหรับ Hostatom:** branch `release/v1.1-security-tablet` / tag `v1.1.0-demo`
- **ติดตั้งบนโฮสต์:** [คู่มือติดตั้ง Hostatom/Plesk](docs/INSTALL_HOSTATOM.md)
- **อัปเดตเว็บเดิมแบบง่าย:** [UPDATE_HOSTATOM](docs/UPDATE_HOSTATOM.md)
- **ความปลอดภัยและขอบเขตการเข้ารหัส:** [SECURITY](docs/SECURITY.md)
- **สิ่งที่เปลี่ยน:** [CHANGELOG](CHANGELOG.md)
- `main` และ branch รุ่นเก่ายังคงเป็นจุดอ้างอิงก่อนย้าย MariaDB ไม่ใช่ชุดติดตั้ง Hostatom v1
- ไม่มีรหัสโฮสต์/ฐานข้อมูลจริง ข้อมูล runtime หรือสลิปใน Git

## เปิด v1 บน Windows

ติดตั้ง Node.js 24 และเปิด PowerShell ในโฟลเดอร์โปรเจกต์ ครั้งแรกให้รัน:

```powershell
cd D:\tui-workspace\90-th-02
npm.cmd ci
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-local-mariadb.ps1
npm.cmd run dev:mariadb
```

setup ดาวน์โหลด MariaDB 11.8.6 จากแหล่งทางการและตรวจ SHA256 แล้วตั้งฐานข้อมูลใหม่ที่ **127.0.0.1:33079** ภายใน `tmp/` ไม่ติดตั้ง Windows service ไม่แก้ฐาน PostgreSQL เดิม และไม่เปิดเว็บให้เอง

ครั้งต่อไปใช้:

```powershell
cd D:\tui-workspace\90-th-02
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-local-mariadb.ps1
npm.cmd run db:check:mariadb
npm.cmd run dev:mariadb
```

เข้า **http://127.0.0.1:3000** หยุดเว็บด้วย **Ctrl+C** ในหน้าต่างที่รันเว็บ แล้วปิดฐานข้อมูล:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-local-mariadb.ps1
```

ถ้ามีเว็บอื่นใช้พอร์ต 3000 ให้หยุดโปรเจกต์นั้นก่อน ไม่ต้อง kill Node ทุกตัว โฟลเดอร์ `tmp/mariadb-data-v1/`, `data/mariadb-v1/` และไฟล์ `.env.mariadb.local` เป็นข้อมูลในเครื่อง ห้ามลบทิ้งหากยังต้องใช้เดโมปัจจุบัน

## บัญชีทดลอง

| ชื่อผู้ใช้ | บทบาท |
|---|---|
| superadmin | ผู้ดูแลระบบหลัก ทุกเมนู ตั้งค่าเว็บ มอบหมายบทบาท |
| tableadmin | โต๊ะจีน + ของที่ระลึก |
| shopadmin | ของที่ระลึก |
| finance | ตรวจสลิปและคืนเงิน |
| gate | ตรวจตั๋ว/รับสินค้า เปิดเว็บแคมได้ |
| customer | ลูกค้า มีออเดอร์ตัวอย่าง 4 รายการ |

**Local development** ใช้รหัส `Demo@1234` ส่วน **บน Hostatom** ใช้รหัสที่ผู้ติดตั้งตั้งใน `DEMO_PASSWORD` ก่อน `db:setup`; หน้าเว็บ production จะไม่แสดงหรือเติมรหัสให้ การเปลี่ยน `DEMO_PASSWORD` ภายหลังไม่เปลี่ยนรหัสบัญชีเดิม ให้ Superadmin แก้บัญชีผ่าน console

สมัครลูกค้าใหม่ได้ ปุ่ม Google/LINE ยังเป็นตัวอย่างและยังไม่เชื่อมบริการจริง

## สิ่งที่ทดลองได้

จองโต๊ะ A–J โซนละ 60 โต๊ะ โต๊ะละ 8 ที่นั่ง; เลือกอาหาร/แพ้อาหาร; ร้านสินค้าและตัวเลือกที่มี ID คงที่; เจ้าหน้าที่หลายบทบาทและช่วยสั่งแทนลูกค้าทางโทรศัพท์/LINE; สลิปสูงสุด 3 รูป รูปละ 5 MB; ตรวจสลิปด้วยเจ้าหน้าที่; QR กันใช้ซ้ำ; เก็บรายการยกเลิกและงานคืนเงิน; ส่งออก XLSX/CSV; ตั้งเวลาจอง/idle session; ปรับภาพ สี และข้อความหน้า Home พร้อม preview และย้อนกลับ; เมนูมือถือและปุ่มตะกร้า

## ตรวจโค้ดและทำชุดติดตั้ง

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:integration
npm.cmd run build
```

integration test ใช้ฐาน EMPTY `sisat_test_*` เท่านั้น ทดสอบคำขอจองพร้อมกัน 30 คำขอ ไม่แตะฐานเดโมหรือ WordPress `npm run test:api` เป็น opt-in ที่เปิดเว็บชั่วคราวเพื่อทดสอบ API แล้วปิดเอง; GitHub CI รันให้บน Linux

หลัง commit โค้ดแล้วสร้าง ZIP สำหรับอัปโหลดได้ด้วย:

```powershell
npm.cmd run release:zip
```

ไฟล์อยู่ใน `releases/` เป็น **source ZIP** ต้องติดตั้ง packages สำหรับ Linux และ build บน Plesk ตามคู่มือ ไม่อัปโหลด `node_modules` หรือ `.next` ที่สร้างบน Windows ไปใช้บน Linux

## ข้อมูลและการสำรอง

- MariaDB: บัญชี ออเดอร์ สถานะ สต็อก การตั้งค่า และ session
- `STORAGE_DIR/slips/`: สลิปส่วนตัว อ่านผ่าน API ที่ตรวจสิทธิ์
- `STORAGE_DIR/site-images/` และ `product-images/`: ภาพประชาสัมพันธ์/สินค้า อ่านผ่าน API ได้หลัง build
- สำรองฐานข้อมูล **พร้อม** storage ก่อนอัปเดต การสลับ Git branch ไม่ย้อนฐานข้อมูล
- PostgreSQL เดิมยังเลือกใช้ด้วย `DATABASE_URL=postgresql://...` ได้ ดู [คู่มือ local รุ่นเดิม](docs/LOCAL_POSTGRES_LEGACY.md)

## ขอบเขตเดโม

30 คนเป็นเป้าหมายการทดสอบ ไม่ใช่การรับประกันโควต้า CPU/RAM ของ shared hosting ต้องตรวจบน Hostatom หลังติดตั้งจริง Subdomain แยกเว็บ/console/ฐานข้อมูล แต่ยังแชร์ทรัพยากร subscription กับ WordPress

ใช้ข้อมูลตัวอย่างและผู้ทดสอบที่ได้รับอนุญาต การเปิดรับเงิน/ข้อมูลลูกค้าจริงต้องผ่านการตรวจความปลอดภัยและโหลดเพิ่มเติม ภาพบรรยากาศเป็นภาพสาธิต โลโก้งานและตรา สอศ. มาจากภาพอ้างอิงต้นฉบับของผู้ใช้ ไม่ได้วาดขึ้นใหม่
