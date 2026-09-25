import type { DemoData, DemoOrder } from "./demo-types";

type Filters = { customerId?: string; category?: string; productId?: string; status?: string; query?: string };
export const exportHeading = ["ลูกค้า ID", "ชื่อลูกค้า", "ชื่อผู้ใช้", "เบอร์โทร", "ออเดอร์ ID", "ประเภท", "ประเภทสินค้า", "สินค้า/โต๊ะ", "คุณลักษณะ", "จำนวน", "สถานะรายการ", "สถานะออเดอร์", "ยอดออเดอร์", "ยอดรอคืน", "วันที่สั่ง", "ช่องทาง"];
const safeCell = (value: unknown): string => {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};
const statusName: Record<DemoOrder["status"], string> = {
  awaiting_slip: "รออัปโหลดสลิป", assisted_draft: "รอชำระเงิน", under_review: "รอตรวจสลิป",
  needs_revision: "ขอสลิปใหม่", approved: "ชำระแล้ว", cancellation_review: "รอตรวจยอดก่อนยกเลิก",
  refund_pending: "รอคืนเงิน", refunded: "คืนเงินแล้ว", cancelled: "ยกเลิกแล้ว",
};

export function customerExportRows(data: DemoData, filters: Filters = {}): (string | number)[][] {
  const rows: (string | number)[][] = [];
  const users = new Map(data.users.map((user) => [user.id, user]));
  const products = new Map(data.products.map((product) => [product.id, product]));
  const query = filters.query?.trim().toLocaleLowerCase() ?? "";
  const orders = data.orders.filter((order) => {
    const customer = users.get(order.userId);
    if (!customer || (filters.customerId && order.userId !== filters.customerId)) return false;
    if (query && ![customer.displayName, customer.username, customer.phone ?? "", customer.id, order.id, ...[...order.items, ...(order.cancelledItems ?? [])].flatMap((item) => [item.name, item.productId])].some((value) => value.toLocaleLowerCase().includes(query))) return false;
    return true;
  });
  const add = (order: DemoOrder, name: string, category: string, option: string, quantity: number, lineStatus: string, productId = "", isCancelledLine = false) => {
    if (filters.productId && filters.productId !== productId) return;
    if (filters.category && filters.category !== category) return;
    if (filters.status === "cancelled" && !isCancelledLine && !["cancelled", "refund_pending", "refunded"].includes(order.status)) return;
    if (filters.status && filters.status !== "cancelled" && (order.status !== filters.status || (isCancelledLine && order.status === "approved"))) return;
    const customer = users.get(order.userId)!;
    const pendingRefund = (order.refunds ?? []).filter((refund) => refund.status === "pending").reduce((sum, refund) => sum + refund.amount, 0);
    rows.push([customer.id, customer.displayName, customer.username, customer.phone ?? "", order.id,
      order.type === "table" ? "โต๊ะจีน" : "ของที่ระลึก", category, name, option, quantity, lineStatus,
      statusName[order.status], order.amount, pendingRefund, order.createdAt, order.channel ?? "web"]);
  };
  for (const order of orders) {
    if (order.type === "table") {
      for (const id of order.tableIds) add(order, `โต๊ะ ${id}`, "โต๊ะจีน", "", 1, ["cancelled", "refund_pending", "refunded"].includes(order.status) ? statusName[order.status] : "ยังถือสิทธิ์");
      for (const entry of order.cancelledTables ?? []) add(order, `โต๊ะ ${entry.id}`, "โต๊ะจีน", "", 1, "ยกเลิกแล้ว", "", true);
    } else {
      for (const item of order.items) {
        const product = products.get(item.productId);
        const option = product?.options?.find((entry) => entry.id === item.optionId)?.label ?? item.size ?? "";
        add(order, item.name, product?.category ?? "สินค้าเดิม", option, item.quantity, ["cancelled", "refund_pending", "refunded"].includes(order.status) ? statusName[order.status] : "ยังถือรายการ", item.productId);
      }
      for (const item of order.cancelledItems ?? []) {
        const product = products.get(item.productId);
        const option = product?.options?.find((entry) => entry.id === item.optionId)?.label ?? item.size ?? "";
        add(order, item.name, product?.category ?? "สินค้าเดิม", option, item.quantity, "ยกเลิกแล้ว", item.productId, true);
      }
    }
  }
  return rows;
}

export function exportCustomerCsv(data: DemoData, filters: Filters = {}): string {
  return "\uFEFF" + [exportHeading, ...customerExportRows(data, filters)].map((row) => row.map(safeCell).join(",")).join("\r\n") + "\r\n";
}