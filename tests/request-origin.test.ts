import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sameOrigin } from "../lib/request-origin";

const request = (url: string, origin: string) => new Request(url, { method: "POST", headers: { origin } });

describe("การเข้าเว็บในเครื่องเดียวกัน", () => {
  it("ยอมรับ localhost กับ 127.0.0.1 ในพอร์ตเดียวกัน", () => {
    assert.equal(sameOrigin(request("http://127.0.0.1:3000/api/demo", "http://localhost:3000")), true);
    assert.equal(sameOrigin(request("http://localhost:3000/api/demo", "http://127.0.0.1:3000")), true);
  });

  it("ปฏิเสธพอร์ตอื่นและเว็บไซต์อื่น", () => {
    assert.equal(sameOrigin(request("http://127.0.0.1:3000/api/demo", "http://localhost:3001")), false);
    assert.equal(sameOrigin(request("http://127.0.0.1:3000/api/demo", "https://example.com")), false);
  });
});
