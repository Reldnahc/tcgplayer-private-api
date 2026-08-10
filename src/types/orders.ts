export type SellerOrderSearchRange = "LastThreeMonths";
export const SellerOrderStatus = {
  Canceled: "Canceled",
  Delivered: "Delivered",
  PickedUp: "PickedUp",
  PickupOrderCanceled: "PickupOrderCanceled",
  Processing: "Processing",
  Pulling: "Pulling",
  ReadyForPickup: "ReadyForPickup",
  ReadyToShip: "ReadyToShip",
  Received: "Received",
  Shipped: "Shipped",
  ShippedOrderCanceled: "ShippedOrderCanceled",
  Unknown: "Unknown",
} as const;

export type SellerOrderStatus =
  (typeof SellerOrderStatus)[keyof typeof SellerOrderStatus];
export type SellerOrderStatusFilter = Exclude<
  SellerOrderStatus,
  typeof SellerOrderStatus.Unknown
>;
export type SellerOrderSortField = "orderStatus" | "orderDate";
export type SortDirection = "ascending" | "descending";

export interface SellerOrderSort {
  readonly field: SellerOrderSortField;
  readonly direction: SortDirection;
}

export interface SearchSellerOrdersInput {
  readonly sellerKey: string;
  readonly orderNumber?: string;
  readonly statuses?: readonly SellerOrderStatusFilter[];
  readonly searchRange?: SellerOrderSearchRange;
  readonly sort?: readonly SellerOrderSort[];
  readonly offset?: number;
  readonly limit?: number;
}

export interface SellerOrderSearchSummary {
  readonly orderNumber: string;
  readonly orderDate: string;
  readonly orderChannel: string;
  /** The validated provider label, preserved verbatim for display. */
  readonly orderStatus: string;
  /** A stable package enum derived only from observed provider status labels. */
  readonly orderStatusCode: SellerOrderStatus;
  readonly buyerName: string;
  readonly shippingType: string;
  readonly productAmount: number;
  readonly shippingAmount: number;
  readonly totalAmount: number;
  readonly buyerPaid: boolean;
  readonly orderFulfillment: string;
}

export interface SearchSellerOrdersResult {
  readonly totalOrders: number;
  readonly orders: readonly SellerOrderSearchSummary[];
}

export interface SellerOrderTax {
  readonly code: string;
  readonly amount: number;
}

export interface SellerOrderTransaction {
  readonly productAmount: number;
  readonly shippingAmount: number;
  readonly grossAmount: number;
  readonly feeAmount: number;
  readonly netAmount: number;
  readonly directFeeAmount: number;
  readonly taxes: readonly SellerOrderTax[];
}

export interface SellerOrderShippingAddress {
  readonly recipientName: string;
  readonly addressOne: string;
  readonly addressTwo?: string;
  readonly city: string;
  readonly territory: string;
  readonly country: string;
  readonly postalCode: string;
}

export interface SellerOrderProduct {
  readonly name: string;
  readonly unitPrice: number;
  readonly extendedPrice: number;
  readonly quantity: number;
  readonly url: string;
  readonly productId: string;
  readonly skuId: string;
  /** Present for order lines whose refund contract requires TCGplayer's line id. */
  readonly listoId?: string | number;
}

export interface SellerOrderRefundProduct {
  readonly skuId: string;
  readonly amount: number;
}

export interface SellerOrderRefund {
  readonly shippingAmount: number;
  readonly products: readonly SellerOrderRefundProduct[];
}

export interface SellerOrderRefundCapabilities {
  readonly full: boolean;
  readonly partial: boolean;
}

export interface SellerOrderTrackingNumber {
  readonly createdAt: string;
  readonly carrier: string;
  readonly trackingNumber: string;
  readonly status: string;
}

export interface SellerOrderDetail {
  readonly createdAt: string;
  /** The validated provider label, preserved verbatim for display. */
  readonly status: string;
  /** A stable package enum derived only from observed provider status labels. */
  readonly statusCode: SellerOrderStatus;
  readonly orderChannel: string;
  readonly orderFulfillment: string;
  readonly orderNumber: string;
  readonly sellerName: string;
  readonly buyerName: string;
  readonly paymentType: string;
  readonly pickupStatus: string;
  readonly shippingType: string;
  readonly estimatedDeliveryDate: string;
  readonly transaction: SellerOrderTransaction;
  readonly shippingAddress: SellerOrderShippingAddress;
  readonly products: readonly SellerOrderProduct[];
  readonly refunds: readonly SellerOrderRefund[];
  readonly refundStatus: string;
  /** Derived only from the provider's exact FullRefund/PartialRefund actions. */
  readonly refundCapabilities: SellerOrderRefundCapabilities;
  readonly trackingNumbers: readonly SellerOrderTrackingNumber[];
  readonly allowedActions: readonly string[];
}

export interface ConfirmSellerOrderInput {
  readonly sellerKey: string;
  readonly orderNumber: string;
}

export interface ConfirmedSellerOrder {
  readonly summary: SellerOrderSearchSummary;
  readonly order: SellerOrderDetail;
}

export interface ExportPackingSlipsInput {
  readonly orderNumbers: readonly string[];
  /** Matches JavaScript's `Date#getTimezoneOffset` convention. */
  readonly timezoneOffsetMinutes: number;
}

export interface GetPackingSlipInput {
  readonly orderNumber: string;
  readonly timezoneOffsetMinutes: number;
}

export interface PackingSlipDocument {
  readonly bytes: Uint8Array;
  readonly contentType: "application/pdf";
  readonly fileName: string;
  readonly orderNumbers: readonly string[];
}

export interface DetectCarrierResult {
  readonly carrier: string;
}

export interface ExportPullSheetInput {
  readonly orderNumbers: readonly string[];
  /** Matches JavaScript's `Date#getTimezoneOffset` convention. */
  readonly timezoneOffsetMinutes: number;
}

export interface PullSheetDocument {
  readonly text: string;
  readonly contentType: "text/csv";
  readonly fileName: "pull-sheet.csv";
  readonly orderNumbers: readonly string[];
  readonly rows: readonly PullSheetRow[];
}

export interface PullSheetRow {
  readonly productLine: string;
  readonly productName: string;
  readonly condition: string;
  readonly number: string;
  readonly setName: string;
  readonly rarity: string;
  readonly quantity: number;
  readonly mainPhotoUrl: string;
  readonly setReleaseDate: string;
  readonly skuId: string;
  readonly orderQuantity: number;
}

export interface AddOrderTrackingInput {
  readonly sellerKey: string;
  readonly orderNumber: string;
  readonly carrier: string;
  readonly trackingNumber: string;
}

export interface ShipOrderWithoutTrackingInput {
  readonly sellerKey: string;
  readonly orderNumber: string;
}

export type FulfillmentMutationOutcome = "applied" | "already-applied";

export interface OrderFulfillmentMutationResult {
  readonly orderNumber: string;
  readonly outcome: FulfillmentMutationOutcome;
}

export interface MarkOrdersShippedInput {
  readonly sellerKey: string;
  readonly orderNumbers: readonly string[];
}

export interface MarkOrdersShippedError {
  readonly orderNumber: string;
  readonly message?: string;
}

export interface MarkOrdersShippedResult {
  readonly updatedOrderNumbers: readonly string[];
  readonly alreadyShippedOrderNumbers: readonly string[];
  readonly errors: readonly MarkOrdersShippedError[];
}

export interface SellerOrderRefundOption {
  readonly name: string;
  readonly value: string;
}

export interface SellerOrderRefundOptions {
  readonly origins: readonly SellerOrderRefundOption[];
  readonly reasons: readonly SellerOrderRefundOption[];
}

interface RefundOrderInput {
  readonly sellerKey: string;
  readonly orderNumber: string;
  readonly origin: string;
  readonly reason: string;
  /** Sent to the buyer, seller, and TCGplayer by the provider. */
  readonly reasonText: string;
}

export type RefundOrderFullInput = RefundOrderInput;

export interface RefundOrderProductInput {
  readonly skuId: string;
  readonly refundAmount: number;
}

export interface RefundOrderPartialInput extends RefundOrderInput {
  readonly shippingRefundAmount: number;
  readonly products: readonly RefundOrderProductInput[];
}

export interface OrderRefundMutationResult {
  readonly orderNumber: string;
  readonly refundType: "full" | "partial";
  /** The provider returned a definitive successful HTTP response. */
  readonly outcome: "submitted";
}
