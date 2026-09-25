import type { DemoData, EventSettings, SiteBranding } from "./demo-types";

export const defaultBranding: SiteBranding = {
  eventLogo: "/assets/event-mark-transparent.png",
  ovcLogo: "/assets/ovc-seal-transparent.png",
  heroDesktop: "/assets/venue-evening.png",
  heroMobile: "/assets/venue-evening.png",
  introImage: "/assets/venue-evening.png",
  tableBanner: "/assets/banquet-evening.png",
  shopBanner: "/assets/shirt-reference.png",
  closingImage: "",
  primaryColor: "#102e60",
  accentColor: "#03acd4",
  brandName: "SISAT 90",
  brandSubtitle: "คืนสู่เหย้า · วิทยาลัยเทคนิคศรีสะเกษ",
  kicker: "SISAT 90TH ANNIVERSARY",
  heroTitle: "เก้าทศวรรษ",
  heroAccent: "แห่งความผูกพัน",
  heroLead: "กลับมาพบกันอีกครั้ง ในคืนแห่งความทรงจำ",
  heroLeadSecond: "งานคืนสู่เหย้า 90 ปี วิทยาลัยเทคนิคศรีสะเกษ",
  venueText: "วิทยาลัยเทคนิคศรีสะเกษ",
  dateText: "วันจัดงานจะแจ้งภายหลัง",
  welcomeText: "จากห้องเรียนวันนั้น สู่ค่ำคืนที่เราจะกลับมาเจอกันอีกครั้ง",
  introTitle: "เรื่องราวของเรา",
  introAccent: "ยังคงดำเนินต่อ",
  introBody: "ร่วมโต๊ะอาหารกับเพื่อนเก่า ฟังเพลงที่คุ้นเคย และสร้างความทรงจำบทใหม่ไปด้วยกันในวาระครบรอบ 90 ปี",
  tableTitle: "เลือกโต๊ะในโซนที่ใช่",
  tableDescription: "แผนผังเข้าใจง่าย เลือกโต๊ะได้ด้วยตัวเอง เห็นสถานะก่อนจอง",
  shopTitle: "ความทรงจำที่หยิบกลับบ้านได้",
  shopDescription: "ของที่ระลึก 90 ปี ออกแบบเพื่อช่วงเวลาที่มีความหมาย",
  stepsTitle: "ง่าย ตั้งแต่จอง",
  stepsAccent: "จนถึงวันพบกัน",
  closingTitle: "แล้วพบกัน",
  closingAccent: "ในคืนของเรา",
  ctaTables: "เลือกโต๊ะร่วมงาน",
  ctaShop: "ชมของที่ระลึก",
};

export const defaultSettings: EventSettings = {
  tableHoldMinutes: 60,
  productHoldMinutes: 60,
  assistedTableHoldMinutes: 1440,
  assistedProductHoldMinutes: 1440,
  revisionHoldMinutes: 1440,
  idleSeconds: 300,
  branding: defaultBranding,
};

export function settingsOf(data: Pick<DemoData, "settings">): EventSettings {
  return { ...defaultSettings, ...data.settings, branding: { ...defaultBranding, ...data.settings?.branding } };
}

export const minutesFromInput = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 43200) throw new Error("เวลาต้องอยู่ระหว่าง 1 นาทีถึง 30 วัน");
  return parsed;
};

export const validSiteImage = (value: string): boolean =>
  value === "" || /^\/(?:assets|uploads|api\/site-image)\/[a-zA-Z0-9._/-]+\.(?:png|jpg|jpeg|webp)$/.test(value);