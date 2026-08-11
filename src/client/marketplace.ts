import { invalidArgument, TcgplayerApiError } from "../errors.js";
import {
  parseCatalogFoilSkuIds,
  parseCatalogProduct,
  parseRequestedSkuMarketPrices,
  parseCatalogSearch,
  parseCatalogSkuMarketPrices,
  rankCatalogProducts,
  withCatalogFoilMarketPrices,
} from "../catalog-validation.js";
import {
  parseMarketplaceProductListings,
  parseMarketplaceProducts,
} from "../marketplace-validation.js";
import type {
  CatalogProductDetails,
  GetSkuMarketPricesInput,
  GetSkuMarketPricesResult,
  GetCatalogProductInput,
  ListSellerInventoryInput,
  ListSellerInventoryOptions,
  MarketplaceProduct,
  RequestOptions,
  SearchCatalogProductsInput,
  SearchCatalogProductsResult,
  SearchMarketplaceProductListingsInput,
  SearchMarketplaceProductListingsResult,
  SearchMarketplaceProductsInput,
  SearchMarketplaceProductsResult,
} from "../types.js";
import {
  boundedInteger,
  requestSignal,
  requiredText,
  uniqueProductConditionIds,
  uniqueProductIds,
  uniqueTextValues,
} from "./input.js";
import { SellerClientCore } from "./core.js";

const MARKETPLACE_SEARCH_PATH = "/v1/search/request";
const MARKETPLACE_PRODUCT_LISTINGS_PATH = "/v1/product";
const MARKETPLACE_PRODUCT_PATH = "/v2/product";
const MARKETPLACE_SKU_PRICE_PATH = "/v1/pricepoints/marketprice/skus/search";

export class SellerMarketplaceClient extends SellerClientCore {
  async searchMarketplaceProducts(
    input: SearchMarketplaceProductsInput,
    options?: RequestOptions,
  ): Promise<SearchMarketplaceProductsResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Marketplace search input is required.");
    }
    const productIds = uniqueProductIds(input.productIds);
    const sellerKey =
      input.sellerKey === undefined
        ? undefined
        : requiredText("sellerKey", input.sellerKey, 256);
    if (productIds === undefined && sellerKey === undefined) {
      throw invalidArgument("productIds or sellerKey is required.");
    }
    const conditions = uniqueTextValues("conditions", input.conditions);
    const printings = uniqueTextValues("printings", input.printings);
    const languages = uniqueTextValues("languages", input.languages);
    const channelId = boundedInteger(
      "channelId",
      input.channelId,
      0,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    const offset = boundedInteger("offset", input.offset, 0, 0, 1_000_000);
    const limit = boundedInteger("limit", input.limit, 24, 1, 24);

    const payload = {
      from: offset,
      size: limit,
      ...(productIds === undefined
        ? {}
        : { filters: { term: { productId: productIds } } }),
      listingSearch: {
        context: { cart: {} },
        filters: {
          term: {
            sellerStatus: "Live",
            channelId,
            ...(sellerKey === undefined ? {} : { sellerKey: [sellerKey] }),
            ...(conditions === undefined ? {} : { condition: conditions }),
            ...(printings === undefined ? {} : { printing: printings }),
            ...(languages === undefined ? {} : { language: languages }),
          },
          range: { quantity: { gte: 1 } },
          exclude: { channelExclusion: 0 },
        },
      },
      context: {
        cart: {},
        shippingCountry: "US",
        userProfile: {
          productLineAffinity: "",
          priceAffinity: 0,
        },
      },
    };
    return parseMarketplaceProducts(
      await this.transport.marketplaceJson(
        "POST",
        MARKETPLACE_SEARCH_PATH,
        payload,
        requestSignal(options),
      ),
    );
  }

  async searchMarketplaceProductListings(
    input: SearchMarketplaceProductListingsInput,
    options?: RequestOptions,
  ): Promise<SearchMarketplaceProductListingsResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Marketplace product-listings input is required.");
    }
    const productId = boundedInteger(
      "productId",
      input.productId,
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const conditions = uniqueTextValues("conditions", input.conditions);
    const printings = uniqueTextValues("printings", input.printings);
    const languages = uniqueTextValues("languages", input.languages);
    const listingTypes = uniqueTextValues("listingTypes", input.listingTypes);
    let channelIds: readonly number[] | undefined;
    if (input.channelIds !== undefined) {
      if (
        !Array.isArray(input.channelIds) ||
        input.channelIds.length === 0 ||
        input.channelIds.length > 8
      ) {
        throw invalidArgument("channelIds must contain 1-8 channel IDs.");
      }
      channelIds = [
        ...new Set(
          input.channelIds.map((channelId, index) =>
            boundedInteger(
              `channelIds[${String(index)}]`,
              channelId,
              0,
              0,
              Number.MAX_SAFE_INTEGER,
            ),
          ),
        ),
      ];
    }
    const offset = boundedInteger("offset", input.offset, 0, 0, 1_000_000);
    const limit = boundedInteger("limit", input.limit, 24, 1, 50);
    const sort = input.sort ?? "price+shipping";
    if (sort !== "price" && sort !== "price+shipping") {
      throw invalidArgument("sort must be price or price+shipping.");
    }
    const payload = {
      from: offset,
      size: limit,
      filters: {
        term: {
          sellerStatus: "Live",
          channelId: channelIds ?? [0, 1],
          ...(conditions === undefined ? {} : { condition: conditions }),
          ...(printings === undefined ? {} : { printing: printings }),
          ...(languages === undefined ? {} : { language: languages }),
          ...(listingTypes === undefined ? {} : { listingType: listingTypes }),
        },
        range: { quantity: { gte: 1 } },
        exclude: { channelExclusion: 0 },
      },
      context: {
        cart: {},
        shippingCountry: "US",
        userProfile: {
          productLineAffinity: "",
          priceAffinity: 0,
        },
      },
      sort: { field: sort, order: "asc" },
    };
    return parseMarketplaceProductListings(
      await this.transport.marketplaceJson(
        "POST",
        `${MARKETPLACE_PRODUCT_LISTINGS_PATH}/${String(productId)}/listings`,
        payload,
        requestSignal(options),
      ),
      productId,
    );
  }

  async searchCatalogProducts(
    input: SearchCatalogProductsInput,
    options?: RequestOptions,
  ): Promise<SearchCatalogProductsResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Catalog search input is required.");
    }
    const query = requiredText("query", input.query, 200);
    const productLineName =
      input.productLineName === undefined
        ? undefined
        : requiredText("productLineName", input.productLineName, 256);
    const productTypeName =
      input.productTypeName === undefined
        ? undefined
        : requiredText("productTypeName", input.productTypeName, 256);
    const setName =
      input.setName === undefined
        ? undefined
        : requiredText("setName", input.setName, 256);
    const offset = boundedInteger("offset", input.offset, 0, 0, 1_000_000);
    const limit = boundedInteger("limit", input.limit, 24, 1, 24);
    if (
      input.includeFoilMarketPrices !== undefined &&
      typeof input.includeFoilMarketPrices !== "boolean"
    ) {
      throw invalidArgument("includeFoilMarketPrices must be a boolean.");
    }
    const includeFoilMarketPrices = input.includeFoilMarketPrices === true;
    const payload = {
      algorithm: "sales_synonym_v2",
      from: offset,
      size: limit,
      filters: {
        term: {
          ...(productLineName === undefined
            ? {}
            : { productLineName: [productLineName] }),
          ...(productTypeName === undefined
            ? {}
            : { productTypeName: [productTypeName] }),
          ...(setName === undefined ? {} : { setName: [setName] }),
        },
        range: {},
        match: {},
      },
      listingSearch: {
        context: { cart: {} },
        filters: {
          term: {
            sellerStatus: "Live",
            channelId: 0,
            ...(includeFoilMarketPrices
              ? {
                  condition: ["Near Mint"],
                  printing: ["Foil"],
                  language: ["English"],
                }
              : {}),
          },
          range: { quantity: { gte: 1 } },
          exclude: { channelExclusion: 0 },
        },
      },
      context: {
        cart: {},
        shippingCountry: "US",
        userProfile: {
          productLineAffinity: productLineName ?? "",
          priceAffinity: 0,
        },
      },
      settings: { useFuzzySearch: true, didYouMean: {} },
      aggregations: ["productLineName", "setName"],
      sort: {},
    };
    const searchParameters = new URLSearchParams({
      q: query,
      isList: "false",
    });
    const rawResult = await this.transport.marketplaceJson(
      "POST",
      `${MARKETPLACE_SEARCH_PATH}?${searchParameters.toString()}`,
      payload,
      requestSignal(options),
    );
    let result = parseCatalogSearch(rawResult);
    if (includeFoilMarketPrices) {
      const foilSkuIds = parseCatalogFoilSkuIds(rawResult);
      const requestedSkuIds = [...new Set(foilSkuIds.values())];
      if (requestedSkuIds.length > 0) {
        const prices = parseCatalogSkuMarketPrices(
          await this.transport.marketplaceGatewayJson(
            "POST",
            MARKETPLACE_SKU_PRICE_PATH,
            { skuIds: requestedSkuIds },
            requestSignal(options),
          ),
        );
        result = withCatalogFoilMarketPrices(result, foilSkuIds, prices);
      }
    }
    return rankCatalogProducts(result, query);
  }

  async getCatalogProduct(
    input: GetCatalogProductInput,
    options?: RequestOptions,
  ): Promise<CatalogProductDetails> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Catalog product input is required.");
    }
    const productId = boundedInteger(
      "productId",
      input.productId,
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    return parseCatalogProduct(
      await this.transport.marketplaceJson(
        "GET",
        `${MARKETPLACE_PRODUCT_PATH}/${String(productId)}/details`,
        undefined,
        requestSignal(options),
      ),
    );
  }

  async getSkuMarketPrices(
    input: GetSkuMarketPricesInput,
    options?: RequestOptions,
  ): Promise<GetSkuMarketPricesResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("SKU market-price input is required.");
    }
    const productConditionIds = uniqueProductConditionIds(
      input.productConditionIds,
    );
    return parseRequestedSkuMarketPrices(
      await this.transport.marketplaceGatewayJson(
        "POST",
        MARKETPLACE_SKU_PRICE_PATH,
        { skuIds: productConditionIds },
        requestSignal(options),
      ),
      productConditionIds,
    );
  }

  async listSellerInventory(
    input: ListSellerInventoryInput,
    options?: ListSellerInventoryOptions,
  ): Promise<readonly MarketplaceProduct[]> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Seller inventory input is required.");
    }
    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    const channelId = boundedInteger(
      "channelId",
      input.channelId,
      0,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    const maximumPages = boundedInteger(
      "maximumPages",
      input.maximumPages,
      1000,
      1,
      10_000,
    );
    const products: MarketplaceProduct[] = [];
    let expectedTotal = Number.POSITIVE_INFINITY;
    for (
      let page = 0;
      page < maximumPages && products.length < expectedTotal;
      page += 1
    ) {
      const result = await this.searchMarketplaceProducts(
        { sellerKey, channelId, offset: page * 24, limit: 24 },
        options,
      );
      expectedTotal = result.totalProducts;
      products.push(...result.products);
      options?.onProgress?.({
        channelId,
        pagesLoaded: page + 1,
        productsLoaded: Math.min(products.length, expectedTotal),
        totalProducts: expectedTotal,
      });
      if (result.products.length === 0) break;
    }
    if (products.length < expectedTotal) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        `Seller inventory exceeded maximumPages before all ${String(expectedTotal)} products were read.`,
      );
    }
    return products;
  }
}
