# ติดตั้ง SISAT 90 v1.1 บน Hostatom / Plesk

คู่มือนี้ใช้สำหรับ **เดโมไม่เกิน 30 คนพร้อมกัน** บน **90thsisat.tonpradoo.com** โดยแยกจาก WordPress ที่ tonpradoo.com

## 1. ดาวน์โหลดรุ่นให้ถูกต้อง

ใช้ branch `release/v1.1-security-tablet` หรือ tag `v1.1.0-demo` จาก https://github.com/tonpradooenter/90threunion_02

เลือก Code → Download ZIP บน branch นี้ หรือดาวน์โหลด tag อย่าใช้ main รุ่นเก่าติดตั้งบน MariaDB

ชุดที่ได้ต้องมี `package.json` เวอร์ชัน 1.1.0, `app.cjs`, `app/`, `lib/`, `public/`, `scripts/` และ `package-lock.json`

## 2. สร้าง subdomain และโฟลเดอร์แยก

Plesk → Websites & Domains → **Add Subdomain**

- Subdomain: `90thsisat`
- Parent domain: `tonpradoo.com`
- Document Root: `90thsisat.tonpradoo.com/public` (ชื่อ path ที่ Plesk แสดงอาจมี / นำหน้า)
- สร้างโฟลเดอร์ `90thsisat.tonpradoo.com` สำหรับแอป และ `90thsisat-storage` สำหรับไฟล์ถาวรที่ระดับเดียวกัน

โครงสร้างภายในพื้นที่บัญชี:

```text
httpdocs/                  WordPress เดิม
90thsisat.tonpradoo.com/
  app.cjs
  package.json
  package-lock.json
  app/
  lib/
  public/                  Document Root ของ subdomain
  scripts/
90thsisat-storage/          สลิปและภาพใหม่ เก็บข้ามการอัปเดตโค้ด
```

อัปโหลด ZIP ผ่าน Files/File Manager ของโฟลเดอร์ใหม่แล้ว Extract ให้ `package.json` อยู่ตรง Application Root อย่าซ้อนอีกชั้นตามชื่อ ZIP และอย่าอัปโหลด `.env.local`, `data/`, `tmp/`, `.git/`, `node_modules/` หรือ `.next/` จากคอม

หาก DNS ไม่ถูกสร้างอัตโนมัติ ให้เพิ่ม A record ของ `90thsisat` ไปยัง IP hosting ที่ Plesk แสดง (ข้อมูลที่ให้มาคือ 203.146.252.146) โดยไม่เปลี่ยน nameserver หรือ DNS ของเว็บหลัก

## 3. เปิด HTTPS ของ subdomain

เข้า SSL/TLS Certificates ของ **90thsisat.tonpradoo.com** ใช้ certificate ที่ครอบคลุมชื่อนี้ หากมี Wildcard SSL อยู่แล้วให้เลือกใช้ได้ หรือออก Let's Encrypt สำหรับ subdomain นี้ เปิด redirect HTTP → HTTPS ของ subdomain

## 4. สร้างฐานข้อมูลใหม่

Databases → Add Database:

| ช่อง | ตัวอย่าง |
|---|---|
| Database name | reunion_v1 (Plesk อาจเติมเป็น tonpra_reunion_v1) |
| Database server | MariaDB localhost:3306 |
| Related site | 90thsisat.tonpradoo.com |
| Create a database user | เปิด |
| Database user | reunion_app (จดชื่อเต็มรวม prefix) |
| Password | Generate และเก็บไว้ในที่ปลอดภัย |
| User has access to all databases | **ไม่เลือก** |
| Access control | **Allow local connections only** |

อย่าเลือก Copy/Import ฐาน WordPress โค้ด setup จะปฏิเสธฐานที่พบตารางอื่นนอกชุด `sisat_*`

## 5. ตั้งค่า Node.js ของ subdomain

เปิด Node.js ภายใต้ **90thsisat.tonpradoo.com** ตรวจชื่อด้านบนทุกครั้ง:

| ช่อง | ค่า |
|---|---|
| Node.js Version | **24.x** ที่โฮสต์มี |
| Package Manager | npm |
| Application Mode | production |
| Application Root | /90thsisat.tonpradoo.com |
| Document Root | /90thsisat.tonpradoo.com/public |
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
| APP_ORIGIN | https://90thsisat.tonpradoo.com |
| STORAGE_DIR | ../90thsisat-storage |
| DEMO_PASSWORD | ตั้งรหัสเฉพาะสำหรับกลุ่มทดสอบ อย่างน้อย 12 ตัว |

ใช้ช่อง DB_PASSWORD แยกได้โดยตรง แม้รหัสมี @ # ! ไม่ต้องประกอบ URL หรือ encode รหัส ไม่ต้องตั้ง DATABASE_URL ซ้ำเมื่อใช้ช่อง DB_* เหล่านี้

`DEMO_PASSWORD` ใช้ตอนสร้างบัญชีทดลองครั้งแรกเท่านั้น รหัสนี้ต้องต่างจากรหัส Plesk และฐานข้อมูล หน้าเว็บ production จะไม่แสดงรหัส รหัส placeholder ที่ขึ้นต้น CHANGE_ และ Demo@1234 ถูกปฏิเสธใน production


## 6.1 ตั้งค่าฐานให้คำสั่ง npm ด้วยไฟล์ .env.local

ในการติดตั้งบน Hostatom ครั้งนี้ Run Node.js commands ไม่เห็นค่า DB_* ที่บันทึกใน Custom Environment Variables จึงหยุดก่อนเชื่อมต่อฐานข้อมูล หากพบ `.env.local not found` ตามด้วย `Set DATABASE_URL before running db:setup` ให้ทำขั้นนี้ ใช้ DB_* ชุดเดิมได้ ไม่จำเป็นต้องประกอบ DATABASE_URL

Files → เข้า `90thsisat.tonpradoo.com` → + → Create File → ตั้งชื่อ **.env.local** ให้อยู่ข้าง package.json และ app.cjs (อย่าสร้างใน public/)

ใส่เนื้อหาด้านล่าง เปลี่ยนรหัส placeholder ทั้งสองตัวให้เป็นค่าเดียวกับที่ตั้งใน Plesk:

```dotenv
NODE_ENV=production
DB_DRIVER=mariadb
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=tonpra_reunion_v1
DB_USER=tonpra_reunion_app
DB_PASSWORD="CHANGE_DB_PASSWORD"
DATABASE_CONNECTION_LIMIT=5
APP_ORIGIN=https://90thsisat.tonpradoo.com
STORAGE_DIR=../90thsisat-storage
DEMO_PASSWORD="CHANGE_DEMO_PASSWORD"
```

- DB_PASSWORD คือรหัสของผู้ใช้ฐานใหม่; DEMO_PASSWORD คือรหัสบัญชีทดลองที่ตั้งไว้ อย่างน้อย 12 ตัว
- เก็บรหัสในเครื่องหมายคำพูด โดยเฉพาะรหัสที่มี #; ถ้ารหัสมีเครื่องหมาย double quote ให้ใช้ single quote ครอบแทนเมื่อรหัสไม่มี single quote
- บันทึกเป็นข้อความ UTF-8 และตรวจว่าไม่มี .txt ต่อท้ายชื่อ
- ตั้ง permissions ของ .env.local เป็น 600 (owner อ่าน/เขียน) หาก Plesk มีช่องปรับ ไม่ใช้ 777
- ไฟล์นี้มีรหัสจริง ห้ามส่งมาในแชต ใส่ Git หรือรวมใน source ZIP; .gitignore ยกเว้นไฟล์นี้ไว้แล้ว
- คงค่าบน Plesk กับไฟล์นี้ให้ตรงกันเมื่อเปลี่ยนการตั้งค่า โดยเฉพาะ DB_PASSWORD และ APP_ORIGIN
- คำสั่ง db:* ใช้ Node --env-file-if-exists=.env.local อยู่แล้ว; Next.js และ app.cjs โหลดไฟล์นี้ได้ด้วย ไม่ต้องแก้โค้ดบนโฮสต์

## 7. ติดตั้ง packages → สร้างฐาน → build

กลับ Dashboard กด **Enable Node.js** เฉพาะ subdomain นี้ก่อน (หากเปิดแล้วไม่ต้องกดซ้ำ) จากนั้น Node.js → **Run Node.js commands** เลือก Node 24 และ npm แล้วกรอกในช่องคำสั่งทีละบรรทัด (ช่อง npm ไม่ต้องเติม npm นำหน้า):

```text
ci --include=dev
run db:setup
run db:check
run build
```

รอแต่ละคำสั่งจบก่อนเริ่มถัดไป ใช้ --include=dev เพราะ TypeScript/tsx จำเป็นสำหรับ build และ setup แม้ Application Mode เป็น production

db:setup สร้างตารางและบัญชีเดโม 6 บัญชีพร้อมออเดอร์ตัวอย่าง 4 รายการ เมื่อฐานมีบัญชี/ออเดอร์แล้วจะข้าม seed และไม่ทับข้อมูล

ถ้า npm แสดงให้อนุมัติ install scripts ให้ตรวจชื่อ package และให้ Hostatom ช่วยยืนยัน อย่าปิดระบบตรวจทั้งหมด ไม่ต้องคัดลอก node_modules จาก Windows มาแทน

เมื่อ build สำเร็จ กลับ Dashboard กด **Restart App** ของ subdomain นี้

## 8. ตรวจว่าใช้งานได้

1. เปิด https://90thsisat.tonpradoo.com/api/health ต้องได้ status: ok และ version: 1.1.0
2. เข้าเว็บด้วย customer และรหัส DEMO_PASSWORD ที่ตั้งไว้ ลองจองโต๊ะ/สินค้า
3. เข้า finance ตรวจสลิปและอนุมัติ; กลับ customer ดู QR
4. เข้า gate ตรวจ QR ซ้ำต้องไม่ผ่าน
5. เข้า tableadmin ลองช่วยสั่งแทนลูกค้า; ทดลองยกเลิก/คืนเงินและส่งออก Excel
6. เปิดบนมือถือ ตรวจเมนูลัดและ countdown
7. ตรวจเว็บ WordPress เดิมยังเปิดและเข้า wp-admin ได้

จำกัดการแจก URL/บัญชีให้กลุ่มทดสอบ ใช้ข้อมูลสาธิตเท่านั้น หากใช้ Plesk จำกัด IP หรือรหัสป้องกันทั้ง subdomain ได้ ให้ใช้เพื่อจำกัดวงเดโม

สลิป 3 รูป รูปละ 5 MB ใช้คำขอรวมเกือบ 15 MB; หากอัปโหลดถูกปฏิเสธด้วย 413 ให้ Hostatom ตั้งขนาด request body ของ **subdomain นี้** อย่างน้อย 16 MB อย่าแก้ค่าทั้งเซิร์ฟเวอร์เพื่อทดสอบ

## 9. อัปเดตและย้อนกลับ

สำหรับเว็บที่เปิดใช้อยู่แล้ว ใช้ [คู่มืออัปเดตแบบง่าย](UPDATE_HOSTATOM.md) รุ่นนี้ต้องรัน security:migrate เพื่อเข้ารหัสสลิปเก่าและเก็บกุญแจตาม [SECURITY](SECURITY.md)


- ก่อนอัปเดต สำรอง MariaDB ของเดโมและโฟลเดอร์ 90thsisat-storage
- อัปโหลด source รุ่นใหม่เฉพาะ 90thsisat.tonpradoo.com; คง storage และ environment variables ไว้
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
