const AWAITING_SUPPLIER_TERMS = [
  "not found",
  "info received",
  "information received",
  "label created",
  "pre-advice",
  "shipment accepted",
  "accepted by carrier",
  "awaiting dispatch",
  "postagem",
  "postado",
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
  "fiscalização",
  "analise",
  "análise",
  "importação",
  "importacao",
  "aduaneira",
  "tributado",
  "pagamento",
  "recebido no brasil",
];

const SHIPPED_TERMS = [
  "in transit",
  "intransit",
  "departed",
  "arrived",
  "processed",
  "out for delivery",
  "posted",
  "dispatched",
  "shipment on the way",
  "em trânsito",
  "em transito",
  "encaminhado",
  "saiu para entrega",
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
  "tributado",
  "pagamento",
  "fiscalização",
  "fiscalizacao",
  "taxa",
  "aguardando pagamento",
];

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function normalizeTrackingText(rawStatus: string) {
  return rawStatus
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim();
}

export function mapTrackingStatusToOrderStatus(rawStatus: string) {
  const normalized = normalizeTrackingText(rawStatus);

  if (!normalized) return null;
  if (containsAny(normalized, DELIVERED_TERMS)) return "DELIVERED";
  if (containsAny(normalized, PREPARING_TERMS)) return "PREPARING";
  if (containsAny(normalized, SHIPPED_TERMS)) return "SHIPPED";
  if (containsAny(normalized, AWAITING_SUPPLIER_TERMS)) return "AWAITING_SUPPLIER";

  return "SHIPPED";
}

export function isTrackingTaxPending(rawStatus: string | null | undefined) {
  if (!rawStatus) return false;
  const normalized = normalizeTrackingText(rawStatus);
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

export function translateTrackingStatus(rawStatus: string | null | undefined) {
  if (!rawStatus) return "Sem atualizacao";
  const normalized = normalizeTrackingText(rawStatus);

  if (containsAny(normalized, DELIVERED_TERMS)) return "Entregue";
  if (containsAny(normalized, PREPARING_TERMS)) return "Aguardando liberacao / taxa";
  if (containsAny(normalized, SHIPPED_TERMS)) return "Em transito (objeto postado)";
  if (containsAny(normalized, AWAITING_SUPPLIER_TERMS)) return "Aguardando postagem";

  return rawStatus;
}
