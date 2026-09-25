export type Role = "superadmin" | "tables" | "merch" | "finance" | "gate" | "customer";
export type OrderStatus = "awaiting_slip" | "assisted_draft" | "under_review" | "needs_revision" | "approved" | "cancellation_review" | "refund_pending" | "refunded" | "cancelled";
export type OrderType = "table" | "product";

export interface DemoUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  roles: Role[];
  phone?: string;
  contactSource?: "phone" | "line" | "walkin" | "web";
  passwordHash: string;
  active: boolean;
  createdAt: string;
}

export type PublicUser = Omit<DemoUser, "passwordHash">;

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  category: string;
  sizes: string[];
  options?: { id: string; label: string }[];
  active: boolean;
  archived?: boolean;
}

export interface Zone {
  id: string;
  price: number;
  color: string;
  softColor: string;
  label: string;
}

export interface OrderItem {
  id?: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  size?: string;
  optionId?: string;
}

export interface CancelledOrderItem extends OrderItem {
  cancelledAt: string;
  cancelReason: string;
}

export interface OrderRefund {
  id: string;
  amount: number;
  reason: string;
  status: "pending" | "refunded";
  requestedAt: string;
  completedAt?: string;
  completedBy?: string;
  reference?: string;
  itemIds: string[];
  tableIds: string[];
}

export interface DemoOrder {
  id: string;
  userId: string;
  type: OrderType;
  status: OrderStatus;
  tableIds: string[];
  items: OrderItem[];
  cancelledItems?: CancelledOrderItem[];
  cancelledTables?: { id: string; cancelledAt: string; cancelReason: string }[];
  refunds?: OrderRefund[];
  meal: string;
  dietaryNotes: string;
  amount: number;
  paidAmount?: number;
  tablePrices?: Record<string, number>;
  createdAt: string;
  holdUntil: string;
  slipFile?: string;
  slipName?: string;
  financeComment?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  ticketCodes: string[];
  checkedInCodes: string[];
  pickupCode?: string;
  pickedUpAt?: string;
  cancelledTicketCodes?: string[];
  assistedBy?: string;
  channel?: "phone" | "line" | "walkin" | "web";
  history?: { at: string; actor: string; summary: string }[];
}

export interface AuditEntry {
  at: string;
  actorId: string;
  action: string;
  detail: string;
}

export interface DemoData {
  schemaVersion?: number;
  users: DemoUser[];
  sessions: { token: string; userId: string; expiresAt: string }[];
  products: Product[];
  zones: Zone[];
  orders: DemoOrder[];
  blockedTables: string[];
  audit: AuditEntry[];
  categories?: string[];
}

export interface DemoSnapshot {
  me: PublicUser | null;
  products: Product[];
  zones: Zone[];
  tableStatuses: Record<string, "reserved" | "sold">;
  productAvailable: Record<string, number>;
  orders: DemoOrder[];
  users: PublicUser[];
  customers: PublicUser[];
  orderCustomers: { id: string; displayName: string; username: string; phone?: string }[];
  categories: string[];
  audit: AuditEntry[];
}
