const AWAITING_SUPPLIER_TERMS = [
  "not found",
  "info received",
  "information received",
  "label created",
  "pre-advice",
  "shipment accepted",
  "accepted by carrier",
  "awaiting dispatch",
];

const PREPARING_TERMS = [
  "customs",
  "clearance",
  "import",
  "tax",
  "duties",
  "inward office",
  "arrived at destination country",
  "arrived in destination",
  "held by customs",
];

const SHIPPED_TERMS = [
  "in transit",
  "departed",
  "arrived",
  "processed",
  "out for delivery",
  "posted",
  "dispatched",
  "shipment on the way",
];

const DELIVERED_TERMS = [
  "delivered",
  "entregue",
  "delivery confirmed",
  "signed",
  "picked up",
];

const TAX_PENDING_TERMS = [
  "tax",
  "customs",
  "clearance",
  "duties",
  "import",
];

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function mapTrackingStatusToOrderStatus(rawStatus: string) {
  const normalized = rawStatus.toLowerCase().trim();

  if (!normalized) return null;
  if (containsAny(normalized, DELIVERED_TERMS)) return "DELIVERED";
  if (containsAny(normalized, PREPARING_TERMS)) return "PREPARING";
  if (containsAny(normalized, SHIPPED_TERMS)) return "SHIPPED";
  if (containsAny(normalized, AWAITING_SUPPLIER_TERMS)) return "AWAITING_SUPPLIER";

  return "SHIPPED";
}

export function isTrackingTaxPending(rawStatus: string | null | undefined) {
  if (!rawStatus) return false;
  const normalized = rawStatus.toLowerCase();
  return containsAny(normalized, TAX_PENDING_TERMS);
}

const STATUS_RANK: Record<string, number> = {
  AWAITING_PAYMENT: 0,
  AWAITING_SUPPLIER: 1,
  PREPARING: 2,
  SHIPPED: 3,
  DELIVERED: 4,
};

export function shouldAdvanceOrderStatus(current: string, next: string) {
  if (current === "CANCELED") return false;
  const currentRank = STATUS_RANK[current] ?? 0;
  const nextRank = STATUS_RANK[next] ?? 0;
  return nextRank > currentRank;
}
