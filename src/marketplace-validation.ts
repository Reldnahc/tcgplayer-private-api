import { TcgplayerApiError } from "./errors.js";
import type {
  MarketplaceListing,
  MarketplaceProduct,
  SearchMarketplaceProductListingsResult,
  SearchMarketplaceProductsResult,
} from "./types.js";

type UnknownRecord = Record<string, unknown>;

function invalidResponse(message: string): never {
  throw new TcgplayerApiError("INVALID_RESPONSE", message);
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalidResponse(`${path} must be an object.`);
  }
  return value as UnknownRecord;
}

function text(value: unknown, path: string, allowEmpty = false): string {
  if (
    typeof value !== "string" ||
    (!allowEmpty && value.trim().length === 0) ||
    value.length > 2048
  ) {
    return invalidResponse(`${path} must be a string.`);
  }
  return value;
}

function finite(value: unknown, path: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    return invalidResponse(`${path} must be a finite number.`);
  }
  return value;
}

function integer(value: unknown, path: string, minimum = 0): number {
  const result = finite(value, path, minimum);
  if (!Number.isSafeInteger(result)) {
    return invalidResponse(`${path} must be a safe integer.`);
  }
  return result;
}

function optionalFinite(value: unknown, path: string): number | undefined {
  return value === undefined || value === null
    ? undefined
    : finite(value, path);
}

function optionalText(value: unknown, path: string): string {
  return value === undefined || value === null ? "" : text(value, path, true);
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    return invalidResponse(`${path} must be a boolean.`);
  }
  return value;
}

function optionalString(value: unknown, path: string): string | undefined {
  return value === undefined || value === null ? undefined : text(value, path);
}

function optionalStringArray(
  value: unknown,
  path: string,
): readonly string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > 128) {
    return invalidResponse(`${path} must be an array of at most 128 strings.`);
  }
  return value.map((item, index) => text(item, `${path}[${String(index)}]`));
}

function parseListing(value: unknown, path: string): MarketplaceListing {
  const source = record(value, path);
  const customDataSource =
    source.customData === undefined || source.customData === null
      ? {}
      : record(source.customData, `${path}.customData`);
  const customListingId =
    customDataSource.customListingId === undefined ||
    customDataSource.customListingId === null
      ? undefined
      : integer(
          customDataSource.customListingId,
          `${path}.customData.customListingId`,
        );
  const directListing = optionalBoolean(
    source.directListing,
    `${path}.directListing`,
  );
  const directInventory = optionalFinite(
    source.directInventory,
    `${path}.directInventory`,
  );
  if (directInventory !== undefined && !Number.isSafeInteger(directInventory)) {
    return invalidResponse(`${path}.directInventory must be a safe integer.`);
  }
  const directProduct = optionalBoolean(
    source.directProduct,
    `${path}.directProduct`,
  );
  const directSeller = optionalBoolean(
    source.directSeller,
    `${path}.directSeller`,
  );
  const listingType = optionalString(source.listingType, `${path}.listingType`);
  const sellerPrograms = optionalStringArray(
    source.sellerPrograms,
    `${path}.sellerPrograms`,
  );

  return {
    listingId: integer(source.listingId, `${path}.listingId`),
    productId: integer(source.productId, `${path}.productId`),
    productConditionId: integer(
      source.productConditionId,
      `${path}.productConditionId`,
    ),
    conditionId: integer(source.conditionId, `${path}.conditionId`),
    condition: text(source.condition, `${path}.condition`),
    channelId: integer(source.channelId, `${path}.channelId`),
    printing: text(source.printing, `${path}.printing`),
    language: text(source.language, `${path}.language`),
    languageId: integer(source.languageId, `${path}.languageId`),
    sellerKey: text(source.sellerKey, `${path}.sellerKey`),
    sellerName: text(source.sellerName, `${path}.sellerName`),
    quantity: integer(source.quantity, `${path}.quantity`),
    price: finite(source.price, `${path}.price`),
    shippingPrice: finite(source.shippingPrice, `${path}.shippingPrice`),
    ...(directListing === undefined ? {} : { directListing }),
    ...(directInventory === undefined ? {} : { directInventory }),
    ...(directProduct === undefined ? {} : { directProduct }),
    ...(directSeller === undefined ? {} : { directSeller }),
    ...(listingType === undefined ? {} : { listingType }),
    ...(sellerPrograms === undefined ? {} : { sellerPrograms }),
    customData: {
      ...(customListingId === undefined ? {} : { customListingId }),
    },
  };
}

function parseProduct(value: unknown, path: string): MarketplaceProduct {
  const source = record(value, path);
  if (!Array.isArray(source.listings)) {
    return invalidResponse(`${path}.listings must be an array.`);
  }
  const lowestPrice = optionalFinite(source.lowestPrice, `${path}.lowestPrice`);
  const lowestPriceWithShipping = optionalFinite(
    source.lowestPriceWithShipping,
    `${path}.lowestPriceWithShipping`,
  );
  const customAttributes =
    source.customAttributes === undefined || source.customAttributes === null
      ? {}
      : record(source.customAttributes, `${path}.customAttributes`);
  const parsedColors = optionalStringArray(
    customAttributes.color,
    `${path}.customAttributes.color`,
  );
  const colors =
    parsedColors === undefined || parsedColors.length === 0
      ? undefined
      : [...new Set(parsedColors)];
  const parsedCardTypes = optionalStringArray(
    customAttributes.cardType,
    `${path}.customAttributes.cardType`,
  );
  const cardTypes =
    parsedCardTypes === undefined || parsedCardTypes.length === 0
      ? undefined
      : [...new Set(parsedCardTypes)];
  return {
    productId: integer(source.productId, `${path}.productId`),
    productName: text(source.productName, `${path}.productName`),
    productLineName: text(source.productLineName, `${path}.productLineName`),
    setName: text(source.setName, `${path}.setName`),
    rarityName: optionalText(source.rarityName, `${path}.rarityName`),
    ...(colors === undefined ? {} : { colors }),
    ...(cardTypes === undefined ? {} : { cardTypes }),
    marketPrice: finite(source.marketPrice ?? 0, `${path}.marketPrice`),
    ...(lowestPrice === undefined ? {} : { lowestPrice }),
    ...(lowestPriceWithShipping === undefined
      ? {}
      : { lowestPriceWithShipping }),
    totalListings: integer(source.totalListings, `${path}.totalListings`),
    listings: source.listings.map((listing, index) =>
      parseListing(listing, `${path}.listings[${String(index)}]`),
    ),
  };
}

export function parseMarketplaceProducts(
  value: unknown,
): SearchMarketplaceProductsResult {
  const source = record(value, "response");
  if (!Array.isArray(source.results) || source.results.length !== 1) {
    return invalidResponse("response.results must contain one search result.");
  }
  const result = record(source.results[0], "response.results[0]");
  if (!Array.isArray(result.results)) {
    return invalidResponse("response.results[0].results must be an array.");
  }
  return {
    totalProducts: integer(
      result.totalResults,
      "response.results[0].totalResults",
    ),
    products: result.results.map((product, index) =>
      parseProduct(product, `response.results[0].results[${String(index)}]`),
    ),
  };
}

export function parseMarketplaceProductListings(
  value: unknown,
  productId: number,
): SearchMarketplaceProductListingsResult {
  const source = record(value, "response");
  if (!Array.isArray(source.results) || source.results.length !== 1) {
    return invalidResponse("response.results must contain one listing result.");
  }
  const result = record(source.results[0], "response.results[0]");
  if (!Array.isArray(result.results)) {
    return invalidResponse("response.results[0].results must be an array.");
  }
  const listings = result.results.map((listing, index) =>
    parseListing(listing, `response.results[0].results[${String(index)}]`),
  );
  if (listings.some((listing) => listing.productId !== productId)) {
    return invalidResponse(
      "response.results[0].results contains a different product.",
    );
  }
  return {
    productId,
    totalListings: integer(
      result.totalResults,
      "response.results[0].totalResults",
    ),
    listings,
  };
}
