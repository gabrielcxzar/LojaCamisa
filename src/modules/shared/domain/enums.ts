export const OrderStatus = {
  AwaitingPayment: "AWAITING_PAYMENT",
  AwaitingSupplier: "AWAITING_SUPPLIER",
  Preparing: "PREPARING",
  Shipped: "SHIPPED",
  Delivered: "DELIVERED",
  Canceled: "CANCELED",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUS_VALUES = Object.values(OrderStatus);

export const PaymentType = {
  None: "NONE",
  Deposit50: "DEPOSIT_50",
  Full: "FULL",
} as const;

export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const PAYMENT_TYPE_VALUES = Object.values(PaymentType);

export const PaymentDirection = {
  Incoming: "INCOMING",
  Outgoing: "OUTGOING",
} as const;

export type PaymentDirection = (typeof PaymentDirection)[keyof typeof PaymentDirection];

export const PAYMENT_DIRECTION_VALUES = Object.values(PaymentDirection);

export const PackageMode = {
  New: "new",
  Existing: "existing",
  None: "none",
  InternalStock: "internal_stock",
} as const;

export type PackageMode = (typeof PackageMode)[keyof typeof PackageMode];

export const PACKAGE_MODE_VALUES = Object.values(PackageMode);
