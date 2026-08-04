import { invalidResponse } from "./errors.js";
import type {
  DetectCarrierResult,
  MarkOrdersShippedError,
  SearchSellerOrdersResult,
  SellerOrderDetail,
  SellerOrderProduct,
  SellerOrderSearchSummary,
  SellerOrderShippingAddress,
  SellerOrderTax,
  SellerOrderTrackingNumber,
  SellerOrderTransaction,
} from "./types.js";

export interface ParsedMarkOrdersShippedResponse {
  readonly updatedCount: number;
  readonly errorCount: number;
  readonly errors: readonly MarkOrdersShippedError[];
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidResponse(`Expected an object at ${path}.`);
  }

  return value as UnknownRecord;
}

function stringValue(source: UnknownRecord, key: string, path: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw invalidResponse(`Expected a string at ${path}.${key}.`);
  }
  return value;
}

function optionalStringValue(
  source: UnknownRecord,
  key: string,
  path: string,
): string | undefined {
  const value = source[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw invalidResponse(`Expected a string at ${path}.${key}.`);
  }
  return value;
}

function numberValue(source: UnknownRecord, key: string, path: string): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw invalidResponse(`Expected a finite number at ${path}.${key}.`);
  }
  return value;
}

function integerValue(
  source: UnknownRecord,
  key: string,
  path: string,
): number {
  const value = numberValue(source, key, path);
  if (!Number.isInteger(value)) {
    throw invalidResponse(`Expected an integer at ${path}.${key}.`);
  }
  return value;
}

function booleanValue(
  source: UnknownRecord,
  key: string,
  path: string,
): boolean {
  const value = source[key];
  if (typeof value !== "boolean") {
    throw invalidResponse(`Expected a boolean at ${path}.${key}.`);
  }
  return value;
}

function arrayValue(
  source: UnknownRecord,
  key: string,
  path: string,
): unknown[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    throw invalidResponse(`Expected an array at ${path}.${key}.`);
  }
  return value;
}

function stringArrayValue(
  source: UnknownRecord,
  key: string,
  path: string,
): string[] {
  return arrayValue(source, key, path).map((value, index) => {
    if (typeof value !== "string") {
      throw invalidResponse(`Expected a string at ${path}.${key}[${index}].`);
    }
    return value;
  });
}

function parseSummary(value: unknown, path: string): SellerOrderSearchSummary {
  const source = record(value, path);
  return {
    orderNumber: stringValue(source, "orderNumber", path),
    orderDate: stringValue(source, "orderDate", path),
    orderChannel: stringValue(source, "orderChannel", path),
    orderStatus: stringValue(source, "orderStatus", path),
    buyerName: stringValue(source, "buyerName", path),
    shippingType: stringValue(source, "shippingType", path),
    productAmount: numberValue(source, "productAmount", path),
    shippingAmount: numberValue(source, "shippingAmount", path),
    totalAmount: numberValue(source, "totalAmount", path),
    buyerPaid: booleanValue(source, "buyerPaid", path),
    orderFulfillment: stringValue(source, "orderFulfillment", path),
  };
}

function parseTax(value: unknown, path: string): SellerOrderTax {
  const source = record(value, path);
  return {
    code: stringValue(source, "code", path),
    amount: numberValue(source, "amount", path),
  };
}

function parseTransaction(
  value: unknown,
  path: string,
): SellerOrderTransaction {
  const source = record(value, path);
  return {
    productAmount: numberValue(source, "productAmount", path),
    shippingAmount: numberValue(source, "shippingAmount", path),
    grossAmount: numberValue(source, "grossAmount", path),
    feeAmount: numberValue(source, "feeAmount", path),
    netAmount: numberValue(source, "netAmount", path),
    directFeeAmount: numberValue(source, "directFeeAmount", path),
    taxes: arrayValue(source, "taxes", path).map((tax, index) =>
      parseTax(tax, `${path}.taxes[${index}]`),
    ),
  };
}

function parseAddress(
  value: unknown,
  path: string,
): SellerOrderShippingAddress {
  const source = record(value, path);
  const addressTwo = optionalStringValue(source, "addressTwo", path);
  return {
    recipientName: stringValue(source, "recipientName", path),
    addressOne: stringValue(source, "addressOne", path),
    ...(addressTwo === undefined ? {} : { addressTwo }),
    city: stringValue(source, "city", path),
    territory: stringValue(source, "territory", path),
    country: stringValue(source, "country", path),
    postalCode: stringValue(source, "postalCode", path),
  };
}

function parseProduct(value: unknown, path: string): SellerOrderProduct {
  const source = record(value, path);
  const quantity = integerValue(source, "quantity", path);
  if (quantity < 0) {
    throw invalidResponse(`Expected ${path}.quantity to be non-negative.`);
  }
  return {
    name: stringValue(source, "name", path),
    unitPrice: numberValue(source, "unitPrice", path),
    extendedPrice: numberValue(source, "extendedPrice", path),
    quantity,
    url: stringValue(source, "url", path),
    productId: stringValue(source, "productId", path),
    skuId: stringValue(source, "skuId", path),
  };
}

function parseTrackingNumber(
  value: unknown,
  path: string,
): SellerOrderTrackingNumber {
  const source = record(value, path);
  return {
    createdAt: stringValue(source, "createdAt", path),
    carrier: stringValue(source, "carrier", path),
    trackingNumber: stringValue(source, "trackingNumber", path),
    status: stringValue(source, "status", path),
  };
}

export function parseSearchSellerOrdersResult(
  value: unknown,
): SearchSellerOrdersResult {
  const source = record(value, "response");
  const totalOrders = integerValue(source, "totalOrders", "response");
  if (totalOrders < 0) {
    throw invalidResponse("Expected response.totalOrders to be non-negative.");
  }

  return {
    totalOrders,
    orders: arrayValue(source, "orders", "response").map((order, index) =>
      parseSummary(order, `response.orders[${index}]`),
    ),
  };
}

export function parseSellerOrderDetail(value: unknown): SellerOrderDetail {
  const path = "response";
  const source = record(value, path);
  return {
    createdAt: stringValue(source, "createdAt", path),
    status: stringValue(source, "status", path),
    orderChannel: stringValue(source, "orderChannel", path),
    orderFulfillment: stringValue(source, "orderFulfillment", path),
    orderNumber: stringValue(source, "orderNumber", path),
    sellerName: stringValue(source, "sellerName", path),
    buyerName: stringValue(source, "buyerName", path),
    paymentType: stringValue(source, "paymentType", path),
    pickupStatus: stringValue(source, "pickupStatus", path),
    shippingType: stringValue(source, "shippingType", path),
    estimatedDeliveryDate: stringValue(source, "estimatedDeliveryDate", path),
    transaction: parseTransaction(
      source["transaction"],
      "response.transaction",
    ),
    shippingAddress: parseAddress(
      source["shippingAddress"],
      "response.shippingAddress",
    ),
    products: arrayValue(source, "products", path).map((product, index) =>
      parseProduct(product, `response.products[${index}]`),
    ),
    refundStatus: stringValue(source, "refundStatus", path),
    trackingNumbers: arrayValue(source, "trackingNumbers", path).map(
      (trackingNumber, index) =>
        parseTrackingNumber(
          trackingNumber,
          `response.trackingNumbers[${index}]`,
        ),
    ),
    allowedActions: stringArrayValue(source, "allowedActions", path),
  };
}

export function parseDetectCarrierResult(value: unknown): DetectCarrierResult {
  const source = record(value, "response");
  const carrier = stringValue(source, "carrier", "response").trim();
  if (!carrier) {
    throw invalidResponse("Expected response.carrier to be non-empty.");
  }
  return { carrier };
}

export function parseMarkOrdersShippedResponse(
  value: unknown,
): ParsedMarkOrdersShippedResponse {
  const source = record(value, "response");
  const updatedCount = integerValue(source, "updatedCount", "response");
  const errorCount = integerValue(source, "errorCount", "response");
  if (updatedCount < 0 || errorCount < 0) {
    throw invalidResponse(
      "Expected response shipment counts to be non-negative.",
    );
  }

  const errors = arrayValue(source, "errors", "response").map(
    (value, index): MarkOrdersShippedError => {
      const path = `response.errors[${index}]`;
      const error = record(value, path);
      const orderNumber = stringValue(error, "orderNumber", path);
      const message =
        optionalStringValue(error, "errorMessage", path) ??
        optionalStringValue(error, "message", path);
      return {
        orderNumber,
        ...(message === undefined ? {} : { message }),
      };
    },
  );
  if (errorCount !== errors.length) {
    throw invalidResponse(
      "Expected response.errorCount to match response.errors.",
    );
  }
  return { updatedCount, errorCount, errors };
}
