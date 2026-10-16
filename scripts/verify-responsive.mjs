import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";

export async function verifyResponsive(origin, customerCookie) {
  await mkdir("playwright-report", { recursive: true });
  const sizes = [[390,844],[768,832],[810,1080],[820,1180],[1024,768],[1366,900]];
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const [width,height] of (engine === webkit ? [[768,832],[1024,768]] : sizes)) {
        const context = await browser.newContext({ viewport: { width,height }, hasTouch: width <= 1100, isMobile: width <= 1100 });
        const page = await context.newPage();
        const failures = [];
        page.on("pageerror", (error) => failures.push(error.message));
        await page.goto(origin, { waitUntil: "networkidle" });
        await page.locator(".hero h1").waitFor();
        await page.evaluate(() => document.fonts.ready);
        const layout = await page.evaluate(() => {
          const dock = document.querySelector(".mobile-dock");
          const rect = dock.getBoundingClientRect();
          const meta = document.querySelector(".hero-meta").getBoundingClientRect();
          return {
            width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
            dockVisible: getComputedStyle(dock).display !== "none", top: rect.top, bottom: rect.bottom,
            children: [...dock.querySelectorAll("button")].map((el) => { const r=el.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}; }),
            metaBottom: meta.bottom,
          };
        });
        assert.ok(layout.documentWidth <= layout.width + 1, JSON.stringify({engine:engine.name(),width,layout}));
        if (width <= 1100) {
          assert.equal(layout.dockVisible, true);
          assert.ok(Math.abs(layout.bottom - layout.height) <= 1, JSON.stringify(layout));
          assert.ok(layout.children.every((r) => r.top >= layout.top && r.bottom <= layout.height + 1 && r.left >= 0 && r.right <= layout.width + 1));
          if (width >= 768) assert.ok(layout.metaBottom <= layout.top - 8, JSON.stringify(layout));
        } else assert.equal(layout.dockVisible, false);
        await page.screenshot({ path: `playwright-report/${engine.name()}-${width}x${height}-home.png`, animations: "disabled" });
        await page.locator(".nav-actions").getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
        const modal = page.getByRole("dialog", { name: "เข้าสู่ระบบ", exact: true });
        await modal.waitFor();
        const bounds = await modal.boundingBox();
        assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height + 1, JSON.stringify(bounds));
        await modal.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `playwright-report/${engine.name()}-${width}x${height}-login.png`, animations: "disabled" });
        await modal.getByRole("button", { name: "ปิด", exact: true }).click();

        const cookieValue = customerCookie.slice(customerCookie.indexOf("=") + 1);
        await context.addCookies([{ name: "sisat_demo_session", value: cookieValue, url: origin, sameSite: "Strict", httpOnly: true }]);
        await page.reload({ waitUntil: "networkidle" });
        await page.locator(".hero h1").waitFor();
        if (width <= 1100) await page.locator(".mobile-dock").getByRole("button", { name: "ออเดอร์", exact: true }).click();
        else await page.locator(".main-nav").getByRole("button", { name: "คำสั่งซื้อของฉัน", exact: true }).click();
        await page.locator(".order-card").first().waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.screenshot({ path: `playwright-report/${engine.name()}-${width}x${height}-orders.png`, animations: "disabled" });
        assert.deepEqual(failures, []);
        await context.close();
        console.log(`Responsive verified: ${engine.name()} ${width}x${height}, home, dock, login and orders.`);
      }
    } finally { await browser.close(); }
  }
}
