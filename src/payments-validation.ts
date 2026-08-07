import { invalidResponse } from "./errors.js";
import type {
  ListSellerPayoutsResult,
  SellerPayoutDetail,
  SellerPayoutMetadata,
  SellerPayoutSummary,
  SellerPayoutTransaction,
  SellerPayoutTransactionType,
  SellerUnpaidBalance,
} from "./types.js";

type UnknownRecord = Record<string, unknown>;

const DISPLAYED_TRANSACTION_TYPES: ReadonlySet<SellerPayoutTransactionType> =
  new Set(["SettleOrder", "ApplyRefund", "ApplyAdjustment"]);

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidResponse(`Expected an object at ${path}.`);
  }
  return value as UnknownRecord;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw invalidResponse(`Expected an array at ${path}.`);
  }
  return value;
}

function stringValue(source: UnknownRecord, key: string, path: string): string {
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidResponse(`Expected a non-empty string at ${path}.${key}.`);
  }
  return value;
}

function optionalStringValue(
  source: UnknownRecord,
  key: string,
  path: string,
): string | undefined {
  const value = source[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw invalidResponse(`Expected a string at ${path}.${key}.`);
  }
  return value;
}

function nullableStringValue(
  source: UnknownRecord,
  key: string,
  path: string,
): string | null {
  const value = source[key];
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw invalidResponse(`Expected a string or null at ${path}.${key}.`);
  }
  return value;
}

function minorUnits(source: UnknownRecord, key: string, path: string): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw invalidResponse(`Expected integer minor units at ${path}.${key}.`);
  }
  return value;
}

function nonNegativeInteger(
  source: UnknownRecord,
  key: string,
  path: string,
): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalidResponse(`Expected a non-negative integer at ${path}.${key}.`);
  }
  return value;
}

function metadataValue(
  value: unknown,
  path: string,
): SellerPayoutMetadata | undefined {
  if (value === undefined || value === null) return undefined;
  const source = record(value, path);
  const rawAmount = source["TargetAmount"];
  const rawCurrency = source["TargetCurrency"];
  const targetAmount =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount === "string" && rawAmount.trim() !== ""
        ? Number(rawAmount)
        : undefined;
  if (targetAmount !== undefined && !Number.isFinite(targetAmount)) {
    throw invalidResponse(`Expected a finite amount at ${path}.TargetAmount.`);
  }
  if (
    rawCurrency !== undefined &&
    rawCurrency !== null &&
    typeof rawCurrency !== "string"
  ) {
    throw invalidResponse(`Expected a string at ${path}.TargetCurrency.`);
  }
  const targetCurrency =
    typeof rawCurrency === "string" && rawCurrency.trim() !== ""
      ? rawCurrency
      : undefined;
  if (targetAmount === undefined && targetCurrency === undefined) {
    return undefined;
  }
  return {
    ...(targetAmount === undefined ? {} : { targetAmount }),
    ...(targetCurrency === undefined ? {} : { targetCurrency }),
  };
}

function parseSummary(value: unknown, path: string): SellerPayoutSummary {
  const source = record(value, path);
  const holdUntil = optionalStringValue(source, "holdUntil", path);
  const lastSentAt = optionalStringValue(source, "lastSentAt", path);
  const metadata = metadataValue(source["metadata"], `${path}.metadata`);
  return {
    payoutId: stringValue(source, "payoutId", path),
    referenceId: nullableStringValue(source, "referenceId", path),
    createdAt: stringValue(source, "createdAt", path),
    ...(holdUntil === undefined ? {} : { holdUntil }),
    ...(lastSentAt === undefined ? {} : { lastSentAt }),
    amount: minorUnits(source, "amount", path),
    ordersCount: nonNegativeInteger(source, "ordersCount", path),
    status: stringValue(source, "status", path),
    ...(metadata === undefined ? {} : { metadata }),
  };
}

function parseTransaction(
  value: unknown,
  path: string,
  nestedEntries: boolean,
): SellerPayoutTransaction | undefined {
  const source = record(value, path);
  const type = stringValue(source, "type", path);
  if (!DISPLAYED_TRANSACTION_TYPES.has(type as SellerPayoutTransactionType)) {
    return undefined;
  }
  const amounts = nestedEntries
    ? record(source["entries"], `${path}.entries`)
    : source;
  const orderNumber = optionalStringValue(source, "orderNumber", path);
  return {
    createdAt: stringValue(source, "createdAt", path),
    type: type as SellerPayoutTransactionType,
    ...(orderNumber === undefined ? {} : { orderNumber }),
    amount: minorUnits(
      amounts,
      "amount",
      nestedEntries ? `${path}.entries` : path,
    ),
    feeAmount: minorUnits(
      amounts,
      "feeAmount",
      nestedEntries ? `${path}.entries` : path,
    ),
    netAmount: minorUnits(
      amounts,
      "netAmount",
      nestedEntries ? `${path}.entries` : path,
    ),
  };
}

export function parseSellerPayouts(
  value: unknown,
  totalCount: number | undefined,
  page: number,
  pageSize: number,
): ListSellerPayoutsResult {
  const payouts = array(value, "response").map((item, index) =>
    parseSummary(item, `response[${String(index)}]`),
  );
  const totalPayouts = totalCount ?? payouts.length;
  if (!Number.isSafeInteger(totalPayouts) || totalPayouts < payouts.length) {
    throw invalidResponse(
      "Expected the payout total to be a non-negative integer at least as large as the returned page.",
    );
  }
  return { totalPayouts, page, pageSize, payouts };
}

export function parseSellerPayoutDetail(value: unknown): SellerPayoutDetail {
  const path = "response";
  const source = record(value, path);
  const lastSentAt = optionalStringValue(source, "lastSentAt", path);
  const metadata = metadataValue(source["metadata"], `${path}.metadata`);
  const transactions = array(source["transactions"], `${path}.transactions`)
    .map((item, index) =>
      parseTransaction(item, `${path}.transactions[${String(index)}]`, true),
    )
    .filter(
      (transaction): transaction is SellerPayoutTransaction =>
        transaction !== undefined,
    );
  return {
    payoutId: stringValue(source, "payoutId", path),
    referenceId: stringValue(source, "referenceId", path),
    createdAt: stringValue(source, "createdAt", path),
    ...(lastSentAt === undefined ? {} : { lastSentAt }),
    amount: minorUnits(source, "amount", path),
    status: stringValue(source, "status", path),
    totalSales: minorUnits(source, "totalSales", path),
    totalRefunds: minorUnits(source, "totalRefunds", path),
    totalFees: minorUnits(source, "totalFees", path),
    totalAdjustments: minorUnits(source, "totalAdjustments", path),
    ...(metadata === undefined ? {} : { metadata }),
    transactions,
  };
}

export function parseSellerUnpaidBalance(value: unknown): SellerUnpaidBalance {
  const path = "response";
  const source = record(value, path);
  const transactions = array(source["transactions"], `${path}.transactions`)
    .map((item, index) =>
      parseTransaction(item, `${path}.transactions[${String(index)}]`, false),
    )
    .filter(
      (transaction): transaction is SellerPayoutTransaction =>
        transaction !== undefined,
    );
  return {
    totalBalance: minorUnits(source, "totalBalance", path),
    transactions,
  };
}
