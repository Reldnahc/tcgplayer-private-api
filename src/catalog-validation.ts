import { TcgplayerApiError } from "./errors.js";
import type {
  CatalogProductDetails,
  CatalogProductSku,
  CatalogProductSummary,
  SearchCatalogProductsResult,
} from "./types.js";

type UnknownRecord = Record<string, unknown>;

const PRODUCT_IMAGE_ORIGIN = "https://product-images.tcgplayer.com";

const CONDITION_IDS: Readonly<Record<string, number>> = {
  "Near Mint": 1,
  "Lightly Played": 2,
  "Moderately Played": 3,
  "Heavily Played": 4,
  Damaged: 5,
  Unopened: 6,
};

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

function integer(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return invalidResponse(`${path} must be a non-negative safe integer.`);
  }
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return invalidResponse(`${path} must be a non-negative finite number.`);
  }
  return value;
}

function optionalText(value: unknown, path: string): string {
  return value === undefined || value === null ? "" : text(value, path, true);
}

function summary(value: unknown, path: string): CatalogProductSummary {
  const source = record(value, path);
  const productId = integer(source.productId, `${path}.productId`);
  const attributes =
    source.customAttributes === undefined || source.customAttributes === null
      ? {}
      : record(source.customAttributes, `${path}.customAttributes`);
  if (typeof source.sellerListable !== "boolean") {
    return invalidResponse(`${path}.sellerListable must be a boolean.`);
  }
  return {
    productId,
    imageUrl: `${PRODUCT_IMAGE_ORIGIN}/fit-in/200x279/${String(productId)}.jpg`,
    productName: text(source.productName, `${path}.productName`),
    productLineName: text(source.productLineName, `${path}.productLineName`),
    setName: text(source.setName, `${path}.setName`),
    rarityName: optionalText(source.rarityName, `${path}.rarityName`),
    cardNumber: optionalText(
      attributes.number,
      `${path}.customAttributes.number`,
    ),
    marketPrice: finite(source.marketPrice ?? 0, `${path}.marketPrice`),
    sellerListable: source.sellerListable,
  };
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function editDistance(left: string, right: string): number {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution =
        (previous[rightIndex - 1] ?? 0) +
        (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        (previous[rightIndex] ?? 0) + 1,
        (current[rightIndex - 1] ?? 0) + 1,
        substitution,
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? 0;
}

function likenessRank(query: string, productName: string): readonly number[] {
  const name = normalizeSearchText(productName);
  if (name === query) return [0, 0];
  if (name.startsWith(query)) return [1, name.length - query.length];
  const containedAt = name.indexOf(query);
  if (containedAt >= 0) {
    return [2, containedAt, name.length - query.length];
  }
  const queryTokens = query.split(" ");
  const nameTokens = new Set(name.split(" "));
  const matchedTokens = queryTokens.filter((token) => nameTokens.has(token));
  if (matchedTokens.length === queryTokens.length) {
    return [3, nameTokens.size - queryTokens.length];
  }
  const maximumLength = Math.max(query.length, name.length, 1);
  return [
    4,
    1 - matchedTokens.length / queryTokens.length,
    editDistance(query, name) / maximumLength,
  ];
}

function compareRank(
  left: readonly number[],
  right: readonly number[],
): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function rankCatalogProducts(
  result: SearchCatalogProductsResult,
  query: string,
): SearchCatalogProductsResult {
  const normalizedQuery = normalizeSearchText(query);
  return {
    ...result,
    products: [...result.products].sort((left, right) =>
      compareRank(
        likenessRank(normalizedQuery, left.productName),
        likenessRank(normalizedQuery, right.productName),
      ),
    ),
  };
}

function sku(value: unknown, path: string): CatalogProductSku {
  const source = record(value, path);
  const condition = text(source.condition, `${path}.condition`);
  const conditionId = CONDITION_IDS[condition];
  if (conditionId === undefined) {
    return invalidResponse(`${path}.condition is unsupported.`);
  }
  return {
    productConditionId: integer(source.sku, `${path}.sku`),
    conditionId,
    condition,
    printing: text(source.variant, `${path}.variant`),
    language: text(source.language, `${path}.language`),
  };
}

export function parseCatalogSearch(
  value: unknown,
): SearchCatalogProductsResult {
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
      summary(product, `response.results[0].results[${String(index)}]`),
    ),
  };
}

export function parseCatalogProduct(value: unknown): CatalogProductDetails {
  const source = record(value, "response");
  if (!Array.isArray(source.skus) || source.skus.length === 0) {
    return invalidResponse("response.skus must be a non-empty array.");
  }
  return {
    ...summary(source, "response"),
    skus: source.skus.map((value, index) =>
      sku(value, `response.skus[${String(index)}]`),
    ),
  };
}
