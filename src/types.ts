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

/**
 * The complete current listing state required by Seller Portal's observed
 * price-only inventory update. Supplying quantity and reserve quantity avoids
 * accidentally clearing either value while changing the price.
 */
export interface SellerPriceUpdate {
  readonly productId: number;
  readonly productName: string;
  /** Seller Portal calls this ProductConditionId; it is the listing SKU id. */
  readonly productConditionId: number;
  readonly conditionId: number;
  readonly channelId: number;
  readonly categoryName: string;
  readonly quantity: number;
  readonly price: number;
  readonly storePriceCustomId: number | null;
  readonly reserveQuantity: number;
}

export interface UpdateSellerPricesInput {
  readonly updates: readonly SellerPriceUpdate[];
}

export interface UpdateSellerPricesResult {
  readonly submittedProductConditionIds: readonly number[];
}

/**
 * A relative live-inventory addition submitted with its initial marketplace
 * price. The caller must obtain currentQuantity immediately before enqueueing
 * or applying the mutation so a stale request can be rejected safely.
 */
export interface SellerInventoryAddition {
  readonly productId: number;
  readonly productName: string;
  /** Seller Portal calls this ProductConditionId; it is the listing SKU id. */
  readonly productConditionId: number;
  readonly conditionId: number;
  readonly channelId: number;
  readonly categoryName: string;
  readonly currentQuantity: number;
  readonly addQuantity: number;
  readonly price: number;
  readonly storePriceCustomId: number | null;
  readonly reserveQuantity: number;
}

export interface AddSellerInventoryInput {
  readonly additions: readonly SellerInventoryAddition[];
}

export interface AddSellerInventoryResult {
  readonly submittedProductConditionIds: readonly number[];
}

/**
 * A complete live listing snapshot used to clear one exact SKU. The caller
 * must re-read currentQuantity immediately before applying the mutation.
 * Removal is intentionally unavailable for reserved inventory.
 */
export interface SellerInventoryRemoval {
  readonly productId: number;
  readonly productName: string;
  /** Seller Portal calls this ProductConditionId; it is the listing SKU id. */
  readonly productConditionId: number;
  readonly conditionId: number;
  readonly channelId: number;
  readonly categoryName: string;
  readonly currentQuantity: number;
  readonly price: number;
  readonly storePriceCustomId: number | null;
  readonly reserveQuantity: number;
}

export interface RemoveSellerInventoryInput {
  readonly removals: readonly SellerInventoryRemoval[];
}

export interface RemoveSellerInventoryResult {
  readonly submittedProductConditionIds: readonly number[];
}

export interface CatalogProductSummary {
  readonly productId: number;
  /** Public TCGplayer product artwork sized for catalog-result thumbnails. */
  readonly imageUrl: string;
  readonly productName: string;
  readonly productLineName: string;
  readonly setName: string;
  readonly rarityName: string;
  readonly cardNumber: string;
  /** English Near Mint Foil market price when explicitly requested and available. */
  readonly foilMarketPrice?: number;
  readonly marketPrice: number;
  readonly sellerListable: boolean;
}

export interface CatalogProductSku {
  /** Seller Portal calls this ProductConditionId; it is the listing SKU id. */
  readonly productConditionId: number;
  readonly conditionId: number;
  readonly condition: string;
  readonly printing: string;
  readonly language: string;
}

export interface CatalogProductDetails extends CatalogProductSummary {
  readonly skus: readonly CatalogProductSku[];
}

export interface CatalogSetFacet {
  readonly name: string;
  readonly count: number;
}

export interface CatalogProductLineFacet {
  readonly name: string;
  readonly count: number;
}

export interface SearchCatalogProductsInput {
  readonly query: string;
  readonly productLineName?: string;
  readonly productTypeName?: string;
  readonly setName?: string;
  readonly offset?: number;
  /** TCGplayer's observed maximum page size is 24. */
  readonly limit?: number;
  /** Adds one batched price-point request for English Near Mint Foil SKUs. */
  readonly includeFoilMarketPrices?: boolean;
}

export interface SearchCatalogProductsResult {
  readonly totalProducts: number;
  readonly productLines: readonly CatalogProductLineFacet[];
  readonly sets: readonly CatalogSetFacet[];
  readonly products: readonly CatalogProductSummary[];
}

export interface GetCatalogProductInput {
  readonly productId: number;
}

export interface MarketplaceListingCustomData {
  readonly customListingId?: number;
}

/** A live marketplace listing returned by TCGplayer's marketplace search. */
export interface MarketplaceListing {
  readonly listingId: number;
  readonly productId: number;
  /** Seller Portal calls this ProductConditionId; it is the listing SKU id. */
  readonly productConditionId: number;
  readonly conditionId: number;
  readonly condition: string;
  readonly channelId: number;
  readonly printing: string;
  readonly language: string;
  readonly languageId: number;
  readonly sellerKey: string;
  readonly sellerName: string;
  readonly quantity: number;
  readonly price: number;
  readonly shippingPrice: number;
  /**
   * TCGplayer's computed Direct-listing flag when present. It must be combined
   * with the availability evidence below before treating the offer as buyable.
   */
  readonly directListing?: boolean;
  /** Authentication Center inventory reported for this exact product-condition. */
  readonly directInventory?: number;
  /** Whether TCGplayer currently treats the product as Direct-capable. */
  readonly directProduct?: boolean;
  /** Whether this seller currently participates in Direct. */
  readonly directSeller?: boolean;
  /** Observed marketplace listing classification, such as `standard`. */
  readonly listingType?: string;
  /** Seller-program flags used by TCGplayer's buyer-facing marketplace ranking. */
  readonly sellerPrograms?: readonly string[];
  readonly customData: MarketplaceListingCustomData;
}

/** Product-level search result containing its currently visible listings. */
export interface MarketplaceProduct {
  readonly productId: number;
  readonly productName: string;
  readonly productLineName: string;
  readonly setName: string;
  readonly rarityName: string;
  readonly marketPrice: number;
  readonly lowestPrice?: number;
  readonly lowestPriceWithShipping?: number;
  readonly totalListings: number;
  readonly listings: readonly MarketplaceListing[];
}

export interface SearchMarketplaceProductsInput {
  readonly productIds?: readonly number[];
  readonly sellerKey?: string;
  readonly conditions?: readonly string[];
  readonly printings?: readonly string[];
  readonly languages?: readonly string[];
  readonly channelId?: number;
  readonly offset?: number;
  /** TCGplayer's observed maximum page size is 24. */
  readonly limit?: number;
}

export interface SearchMarketplaceProductsResult {
  readonly totalProducts: number;
  readonly products: readonly MarketplaceProduct[];
}

export type MarketplaceListingSort = "price" | "price+shipping";

export interface SearchMarketplaceProductListingsInput {
  readonly productId: number;
  readonly conditions?: readonly string[];
  readonly printings?: readonly string[];
  readonly languages?: readonly string[];
  readonly channelIds?: readonly number[];
  readonly listingTypes?: readonly string[];
  readonly offset?: number;
  /** TCGplayer's product page offers at most 50 listings per page. */
  readonly limit?: number;
  /** Defaults to buyer-facing price-plus-shipping order. */
  readonly sort?: MarketplaceListingSort;
}

export interface SearchMarketplaceProductListingsResult {
  readonly productId: number;
  readonly totalListings: number;
  readonly listings: readonly MarketplaceListing[];
}

export interface ListSellerInventoryInput {
  readonly sellerKey: string;
  readonly channelId?: number;
  /** Maximum number of pages to read. Each page contains at most 24 products. */
  readonly maximumPages?: number;
}
