import type { RequestOptions } from "./core.js";

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
  /** Provider-supplied card colors when the product line defines them. */
  readonly colors?: readonly string[];
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
  /** Provider-supplied card colors when the product line defines them. */
  readonly colors?: readonly string[];
  /** Provider-supplied card types when the product line defines them. */
  readonly cardTypes?: readonly string[];
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

export interface GetSkuMarketPricesInput {
  /** Exact TCGplayer SKU identifiers, exposed elsewhere as ProductConditionId. */
  readonly productConditionIds: readonly number[];
}

export interface SkuMarketPrice {
  /** Exact TCGplayer SKU identifier, exposed elsewhere as ProductConditionId. */
  readonly productConditionId: number;
  readonly marketPrice: number;
}

export interface GetSkuMarketPricesResult {
  /** Requested SKUs with a currently available TCGplayer market price. */
  readonly prices: readonly SkuMarketPrice[];
}

export interface ListSellerInventoryInput {
  readonly sellerKey: string;
  readonly channelId?: number;
  /** Maximum number of pages to read. Each page contains at most 24 products. */
  readonly maximumPages?: number;
}

export interface SellerInventoryProgress {
  readonly channelId: number;
  readonly pagesLoaded: number;
  readonly productsLoaded: number;
  readonly totalProducts: number;
}

export interface ListSellerInventoryOptions extends RequestOptions {
  /** Called after each validated page without making additional requests. */
  readonly onProgress?: (progress: SellerInventoryProgress) => void;
}
