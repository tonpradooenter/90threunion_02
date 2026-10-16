# ติดตั้ง SISAT 90 v1 บน Hostatom / Plesk

คู่มือนี้ใช้สำหรับ **เดโมไม่เกิน 30 คนพร้อมกัน** บน **90reunion.tonpradoo.com** โดยแยกจาก WordPress ที่ tonpradoo.com

## 1. ดาวน์โหลดรุ่นให้ถูกต้อง

ใช้ branch `release/v1-hostatom-demo` หรือ tag `v1.0.0-demo` จาก https://github.com/tonpradooenter/90threunion_02

เลือก Code → Download ZIP บน branch นี้ หรือดาวน์โหลด tag อย่าใช้ main รุ่นเก่าติดตั้งบน MariaDB

ชุดที่ได้ต้องมี `package.json` เวอร์ชัน 1.0.0, `app.cjs`, `app/`, `lib/`, `public/`, `scripts/` และ `package-lock.json`

## 2. สร้าง subdomain และโฟลเดอร์แยก

Plesk → Websites & Domains → **Add Subdomain**

- Subdomain: `90reunion`
- Parent domain: `tonpradoo.com`
- Document Root: `90reunion-app/public` (ชื่อ path ที่ Plesk แสดงอาจมี / นำหน้า)
- สร้างโฟลเดอร์ `90reunion-app` สำหรับแอป และ `90reunion-storage` สำหรับไฟล์ถาวรที่ระดับเดียวกัน

โครงสร้างภายในพื้นที่บัญชี:

```text
httpdocs/                  WordPress เดิม
90reunion-app/
  app.cjs
  package.json
  package-lock.json
  app/
  lib/
  public/                  Document Root ของ subdomain
  scripts/
90reunion-storage/          สลิปและภาพใหม่ เก็บข้ามการอัปเดตโค้ด
```

อัปโหลด ZIP ผ่าน Files/File Manager ของโฟลเดอร์ใหม่แล้ว Extract ให้ `package.json` อยู่ตรง Application Root อย่าซ้อนอีกชั้นตามชื่อ ZIP และอย่าอัปโหลด `.env.local`, `data/`, `tmp/`, `.git/`, `node_modules/` หรือ `.next/` จากคอม

หาก DNS ไม่ถูกสร้างอัตโนมัติ ให้เพิ่ม A record ของ `90reunion` ไปยัง IP hosting ที่ Plesk แสดง (ข้อมูลที่ให้มาคือ 203.146.252.146) โดยไม่เปลี่ยน nameserver หรือ DNS ของเว็บหลัก

## 3. เปิด HTTPS ของ subdomain

เข้า SSL/TLS Certificates ของ **90reunion.tonpradoo.com** ใช้ certificate ที่ครอบคลุมชื่อนี้ หากมี Wildcard SSL อยู่แล้วให้เลือกใช้ได้ หรือออก Let's Encrypt สำหรับ subdomain นี้ เปิด redirect HTTP → HTTPS ของ subdomain

## 4. สร้างฐานข้อมูลใหม่

Databases → Add Database:

| ช่อง | ตัวอย่าง |
|---|---|
| Database name | reunion_v1 (Plesk อาจเติมเป็น tonpra_reunion_v1) |
| Database server | MariaDB localhost:3306 |
| Related site | 90reunion.tonpradoo.com |
| Create a database user | เปิด |
| Database user | reunion_app (จดชื่อเต็มรวม prefix) |
| Password | Generate และเก็บไว้ในที่ปลอดภัย |
| User has access to all databases | **ไม่เลือก** |
| Access control | **Allow local connections only** |

อย่าเลือก Copy/Import ฐาน WordPress โค้ด setup จะปฏิเสธฐานที่พบตารางอื่นนอกชุด `sisat_*`

## 5. ตั้งค่า Node.js ของ subdomain

เปิด Node.js ภายใต้ **90reunion.tonpradoo.com** ตรวจชื่อด้านบนทุกครั้ง:

| ช่อง | ค่า |
|---|---|
| Node.js Version | **24.x** ที่โฮสต์มี |
| Package Manager | npm |
| Application Mode | production |
| Application Root | /90reunion-app |
| Document Root | /90reunion-app/public |
| Application Startup File | **app.cjs** |

app.cjs รองรับ Passenger ของ Plesk ไม่ต้องติดตั้ง PM2 หรือเปิดพอร์ต 3000 ออกอินเทอร์เน็ต Plesk เป็นผู้ส่ง request เข้าตัวแอป

## 6. ใส่ Custom Environment Variables

ตั้งค่าบน subdomain นี้ โดยนำชื่อฐาน/ผู้ใช้เต็มจากข้อ 4:

| Name | Value |
|---|---|
| NODE_ENV | production |
| DB_DRIVER | mariadb |
| DB_HOST | 127.0.0.1 |
| DB_PORT | 3306 |
| DB_NAME | ชื่อฐานเต็ม เช่น tonpra_reunion_v1 |
| DB_USER | ชื่อผู้ใช้เต็ม เช่น tonpra_reunion_app |
| DB_PASSWORD | รหัสฐานข้อมูลที่สร้าง |
| DATABASE_CONNECTION_LIMIT | 5 |
| APP_ORIGIN | https://90reunion.tonpradoo.com |
| STORAGE_DIR | ../90reunion-storage |
| DEMO_PASSWORD | ตั้งรหัสเฉพาะสำหรับกลุ่มทดสอบ อย่างน้อย 12 ตัว |

ใช้ช่อง DB_PASSWORD แยกได้โดยตรง แม้รหัสมี @ # ! ไม่ต้องประกอบ URL หรือ encode รหัส ไม่ต้องตั้ง DATABASE_URL ซ้ำเมื่อใช้ช่อง DB_* เหล่านี้

`DEMO_PASSWORD` ใช้ตอนสร้างบัญชีทดลองครั้งแรกเท่านั้น รหัสนี้ต้องต่างจากรหัส Plesk และฐานข้อมูล หน้าเว็บ production จะไม่แสดงรหัส รหัส placeholder ที่ขึ้นต้น CHANGE_ และ Demo@1234 ถูกปฏิเสธใน production

## 7. ติดตั้ง packages → สร้างฐาน → build

Node.js → **Run Node.js commands** เลือก Node 24 และ npm แล้วกรอกในช่องคำสั่งทีละบรรทัด (ช่อง npm ไม่ต้องเติม npm นำหน้า):

```text
ci --include=dev
run db:setup
run db:check
run build
```

รอแต่ละคำสั่งจบก่อนเริ่มถัดไป ใช้ --include=dev เพราะ TypeScript/tsx จำเป็นสำหรับ build และ setup แม้ Application Mode เป็น production

db:setup สร้างตารางและบัญชีเดโม 6 บัญชีพร้อมออเดอร์ตัวอย่าง 4 รายการ เมื่อฐานมีบัญชี/ออเดอร์แล้วจะข้าม seed และไม่ทับข้อมูล

ถ้า npm แสดงให้อนุมัติ install scripts ให้ตรวจชื่อ package และให้ Hostatom ช่วยยืนยัน อย่าปิดระบบตรวจทั้งหมด ไม่ต้องคัดลอก node_modules จาก Windows มาแทน

กลับ Dashboard กด **Enable Node.js** บน subdomain หรือ **Restart App** หากเปิดอยู่แล้ว

## 8. ตรวจว่าใช้งานได้

1. เปิด https://90reunion.tonpradoo.com/api/health ต้องได้ status: ok และ version: 1.0.0
2. เข้าเว็บด้วย customer และรหัส DEMO_PASSWORD ที่ตั้งไว้ ลองจองโต๊ะ/สินค้า
3. เข้า finance ตรวจสลิปและอนุมัติ; กลับ customer ดู QR
4. เข้า gate ตรวจ QR ซ้ำต้องไม่ผ่าน
5. เข้า tableadmin ลองช่วยสั่งแทนลูกค้า; ทดลองยกเลิก/คืนเงินและส่งออก Excel
6. เปิดบนมือถือ ตรวจเมนูลัดและ countdown
7. ตรวจเว็บ WordPress เดิมยังเปิดและเข้า wp-admin ได้

จำกัดการแจก URL/บัญชีให้กลุ่มทดสอบ ใช้ข้อมูลสาธิตเท่านั้น หากใช้ Plesk จำกัด IP หรือรหัสป้องกันทั้ง subdomain ได้ ให้ใช้เพื่อจำกัดวงเดโม

สลิป 3 รูป รูปละ 5 MB ใช้คำขอรวมเกือบ 15 MB; หากอัปโหลดถูกปฏิเสธด้วย 413 ให้ Hostatom ตั้งขนาด request body ของ **subdomain นี้** อย่างน้อย 16 MB อย่าแก้ค่าทั้งเซิร์ฟเวอร์เพื่อทดสอบ

## 9. อัปเดตและย้อนกลับ

- ก่อนอัปเดต สำรอง MariaDB ของเดโมและโฟลเดอร์ 90reunion-storage
- อัปโหลด source รุ่นใหม่เฉพาะ 90reunion-app; คง storage และ environment variables ไว้
- รัน ci --include=dev → run db:setup → run db:backfill → run build → Restart App
- ทำตาม migration notes ของรุ่นใหม่ หาก schema เปลี่ยน
- ย้อนโค้ดไป tag ที่ใช้งานได้ล่าสุดแล้วติดตั้ง/build ใหม่ หาก schema ไม่รองรับย้อนหลังต้องกู้ DB และ storage จาก backup คู่กัน
- main รุ่นเดิมใช้ PostgreSQL/JSON จึงไม่ใช่ rollback บน Hostatom MariaDB

## ปัญหาที่พบบ่อย

| อาการ | ตรวจตรงไหน |
|---|---|
| หน้าแรกขึ้นโหลดข้อมูลไม่สำเร็จ / health 503 | DB_* ครบหรือไม่, ชื่อเต็มมี prefix หรือไม่, run db:check |
| Access denied | DB_USER/DB_PASSWORD ของฐานใหม่และสิทธิ์ local connection |
| Use a NEW dedicated database | เลือกฐาน WordPress หรือฐานแอปอื่นอยู่ ให้ใช้ฐานใหม่ |
| Run npm run build before starting | build ยังไม่สำเร็จ หรือ Application Root ซ้อนโฟลเดอร์ผิด |
| Cannot find module | ci --include=dev ไม่สำเร็จ หรือ startup file ไม่ใช่ app.cjs |
| กด login/upload แล้ว 403 | APP_ORIGIN ต้องตรง HTTPS subdomain และไม่มี path ต่อท้าย |
| sharp/native module error | ใช้ dependencies ที่ติดตั้งบน Linux/Node24 ไม่ใช้ node_modules จาก Windows |
| build ถูก kill / Out of memory | ขอ Hostatom ตรวจ quota build; ไม่อ้าง RAM ทั้งเครื่องเป็น RAM ของบัญชี |
| อัปโหลด 413 | ขอปรับ request body เฉพาะ subdomain |
| รูปใหม่หายหลังอัปเดต | STORAGE_DIR ต้องอยู่ข้างแอปและถูกสำรอง ไม่ล้างโฟลเดอร์ storage |

## แหล่งอ้างอิง

- Hostatom Node.js/Plesk: https://kb.hostatom.com/content/6146/
- Plesk Node.js: https://doc.plesk.com/en-US/obsidian/administrator-guide/website-management/hosting-nodejs-applications.76652/
- Passenger port binding: https://www.phusionpassenger.com/docs/advanced_guides/in_depth/node/reverse_port_binding.html
- Next.js custom server: https://nextjs.org/docs/app/guides/custom-server

แยก subdomain ช่วยแยกเว็บและการตั้งค่า แต่ยังแชร์ทรัพยากร subscription เดิม ต้องทดสอบโหลดจริงบน Hostatomก่อนถือว่ารองรับ 30 คนได้ในแพ็กเกจนี้
