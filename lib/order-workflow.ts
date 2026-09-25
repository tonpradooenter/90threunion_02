import { randomUUID } from "node:crypto";
import type { DemoOrder, DemoUser, OrderItem, OrderRefund } from "./demo-types";

export function orderIsUsed(order: DemoOrder): boolean {
  return !!order.pickedUpAt || order.checkedInCodes.length > 0;
}

export function appendHistory(order: DemoOrder, actor: DemoUser, summary: string): void {
  order.history = [...(order.history ?? []), { at: new Date().toISOString(), actor: actor.displayName, summary }];
}

export function cancelEntireOrder(order: DemoOrder, actor: DemoUser, reason: string): void {
  if (order.status === "cancelled" || order.status === "refund_pending" || order.status === "refunded" || order.status === "cancellation_review") {
    throw new Error("ALREADY_CANCELLED");
  }
  if (order.status === "approved") {
    if (orderIsUsed(order)) throw new Error("ALREADY_USED");
    const refund: OrderRefund = {
      id: randomUUID(), amount: Math.max(0, (order.paidAmount ?? order.amount) - (order.refunds ?? []).reduce((sum, entry) => sum + entry.amount, 0)), reason, status: "pending",
      requestedAt: new Date().toISOString(), itemIds: order.items.map((item) => item.id ?? item.productId),
      tableIds: [...order.tableIds],
    };
    order.refunds = [...(order.refunds ?? []), refund];
    order.status = "refund_pending";
    appendHistory(order, actor, `ยกเลิกรายการที่ชำระแล้ว · รอคืนเงิน ฿${refund.amount}: ${reason}`);
    return;
  }
  if (order.status === "under_review") {
    order.status = "cancellation_review";
    appendHistory(order, actor, `ขอยกเลิกหลังส่งสลิป · รอการเงินตรวจยอด: ${reason}`);
    return;
  }
  order.status = "cancelled";
  appendHistory(order, actor, `ยกเลิก: ${reason}`);
}

export function resolveCancellation(order: DemoOrder, actor: DemoUser, paymentFound: boolean, reference: string): void {
  if (order.status !== "cancellation_review") throw new Error("WRONG_STATUS");
  if (paymentFound) {
    const refund: OrderRefund = {
      id: randomUUID(), amount: order.amount, reason: "ยกเลิกหลังส่งสลิป", status: "pending",
      requestedAt: new Date().toISOString(), itemIds: order.items.map((item) => item.id ?? item.productId),
      tableIds: [...order.tableIds],
    };
    order.refunds = [...(order.refunds ?? []), refund];
    order.paidAmount ??= order.amount;
    order.status = "refund_pending";
    appendHistory(order, actor, `พบยอดชำระ ${reference} · ส่งงานคืนเงิน ฿${refund.amount}`);
  } else {
    order.status = "cancelled";
    appendHistory(order, actor, `ไม่พบยอดชำระ ${reference} · ปิดรายการยกเลิก`);
  }
}

export function completeRefund(order: DemoOrder, refundId: string, actor: DemoUser, reference: string): void {
  const refund = order.refunds?.find((entry) => entry.id === refundId && entry.status === "pending");
  if (!refund) throw new Error("REFUND_NOT_FOUND");
  refund.status = "refunded";
  refund.reference = reference;
  refund.completedAt = new Date().toISOString();
  refund.completedBy = actor.id;
  if (order.status === "refund_pending" && order.refunds?.every((entry) => entry.status === "refunded")) order.status = "refunded";
  appendHistory(order, actor, `คืนเงิน ฿${refund.amount} เสร็จแล้ว · อ้างอิง ${reference}`);
}

export function recordRemovedSelections(order: DemoOrder, newTables: string[], newItems: OrderItem[], actor: DemoUser, reason: string): number {
  const now = new Date().toISOString();
  const removedTables = order.tableIds.filter((id) => !newTables.includes(id));
  const oldItems = order.items;
  let refundAmount = 0;
  for (const id of removedTables) {
    order.cancelledTables = [...(order.cancelledTables ?? []), { id, cancelledAt: now, cancelReason: reason }];
    refundAmount += order.tablePrices?.[id] ?? Math.round(order.amount / Math.max(1, order.tableIds.length));
  }
  for (const old of oldItems) {
    const current = newItems.find((item) => item.id === old.id && item.productId === old.productId && item.optionId === old.optionId);
    const removedQuantity = Math.max(0, old.quantity - (current?.quantity ?? 0));
    if (removedQuantity) {
      order.cancelledItems = [...(order.cancelledItems ?? []), { ...old, quantity: removedQuantity, cancelledAt: now, cancelReason: reason }];
      refundAmount += old.unitPrice * removedQuantity;
    }
  }
  if (removedTables.length && order.ticketCodes.length) {
    const revoked = order.ticketCodes.filter((code) => removedTables.some((id) => code.startsWith(`${id}-`)));
    order.ticketCodes = order.ticketCodes.filter((code) => !revoked.includes(code));
    order.cancelledTicketCodes = [...(order.cancelledTicketCodes ?? []), ...revoked];
  }
  if (removedTables.length || (order.cancelledItems?.some((item) => item.cancelledAt === now) ?? false)) {
    appendHistory(order, actor, `${reason} · ยกเลิก ${removedTables.length} โต๊ะ / ยอดสินค้า ฿${refundAmount}`);
  }
  return refundAmount;
}
