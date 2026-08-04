export type Awaitable<T> = T | PromiseLike<T>;

export interface TcgplayerSession {
  /** The value only, without the `TCGAuthTicket_Production=` prefix. */
  readonly authCookie: string;
  /** Optional caller-selected user agent. It must not contain control characters. */
  readonly userAgent?: string;
}

export type TcgplayerSessionProvider = () => Awaitable<TcgplayerSession>;

export interface RetryOptions {
  /** Number of retries after the initial request. */
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
}

export interface TcgplayerSellerClientOptions {
  readonly session: TcgplayerSession | TcgplayerSessionProvider;
  /** Injectable for deterministic tests. Production requests always target TCGplayer. */
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
  readonly requestDelayMs?: number;
  readonly maxJsonResponseBytes?: number;
  readonly maxPdfResponseBytes?: number;
  readonly maxTextResponseBytes?: number;
  readonly retry?: RetryOptions;
}

export interface RequestOptions {
  readonly signal?: AbortSignal;
}

export type SellerOrderSearchRange = "LastThreeMonths";
export type SellerOrderStatusFilter =
  | "Canceled"
  | "Delivered"
  | "PickedUp"
  | "PickupOrderCanceled"
  | "Processing"
  | "Pulling"
  | "ReadyForPickup"
  | "ReadyToShip"
  | "Received"
  | "Shipped"
  | "ShippedOrderCanceled";
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
  readonly orderStatus: string;
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
}

export interface SellerOrderTrackingNumber {
  readonly createdAt: string;
  readonly carrier: string;
  readonly trackingNumber: string;
  readonly status: string;
}

export interface SellerOrderDetail {
  readonly createdAt: string;
  readonly status: string;
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
  readonly refundStatus: string;
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
