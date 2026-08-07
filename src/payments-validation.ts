import { invalidResponse } from "./errors.js";
import type {
  LegacySellerPayment,
  ListLegacySellerPaymentsResult,
  ListLegacyUpcomingSellerPaymentsResult,
  ListSellerPayoutsResult,
  SellerPaymentExperience,
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
const PAYMENTS_EPS_FEATURE = "Seller Portal Payments EPS Integration";
const LEGACY_PAYMENT_HEADERS = [
  "estimated transfer arrival",
  "payment initiated on",
  "orders",
  "total sales (+)",
  "total fees (-)",
  "refunded orders (-)",
  "refunded fees (+)",
  "adjustments",
  "payment",
] as const;

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

function decodeHtmlEntities(value: string): string {
  const named: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(
    /&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]{2,8}));/giu,
    (entity, decimal: string, hexadecimal: string, name: string) => {
      const codePoint =
        decimal !== undefined
          ? Number(decimal)
          : hexadecimal !== undefined
            ? Number.parseInt(hexadecimal, 16)
            : undefined;
      if (
        codePoint !== undefined &&
        Number.isInteger(codePoint) &&
        codePoint > 0 &&
        codePoint <= 0x10ffff
      ) {
        return String.fromCodePoint(codePoint);
      }
      return named[name?.toLowerCase()] ?? entity;
    },
  );
}

function htmlText(value: string): string {
  return decodeHtmlEntities(
    value.replace(/<br\b[^>]*>/giu, " ").replace(/<[^>]*>/gu, " "),
  )
    .replace(/\s+/gu, " ")
    .trim();
}

function legacyDate(value: string, path: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u.exec(value.trim());
  if (match === null) {
    throw invalidResponse(`Expected a calendar date at ${path}.`);
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw invalidResponse(`Expected a valid calendar date at ${path}.`);
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function legacyMoney(value: string, path: string): number {
  let normalized = value.trim().replace(/[\u2212\u2013\u2014]/gu, "-");
  if (normalized === "-") return 0;
  let sign = 1;
  if (normalized.startsWith("(") && normalized.endsWith(")")) {
    sign = -1;
    normalized = normalized.slice(1, -1).trim();
  }
  if (normalized.startsWith("-")) {
    sign = -1;
    normalized = normalized.slice(1).trim();
  }
  if (normalized.startsWith("$")) normalized = normalized.slice(1).trim();
  if (normalized.startsWith("-")) {
    sign = -1;
    normalized = normalized.slice(1).trim();
  }
  const match = /^(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})$/u.exec(normalized);
  if (match === null) {
    throw invalidResponse(`Expected a USD amount at ${path}.`);
  }
  const dollars = Number((match[1] ?? "").replaceAll(",", ""));
  const cents = Number(match[2] ?? "");
  const amount = dollars * 100 + cents;
  if (!Number.isSafeInteger(amount)) {
    throw invalidResponse(`Expected a safe USD amount at ${path}.`);
  }
  return sign * amount;
}

function legacyOrders(value: string, path: string): number {
  const normalized = value.trim().replaceAll(",", "");
  if (!/^\d+$/u.test(normalized)) {
    throw invalidResponse(`Expected an order count at ${path}.`);
  }
  const count = Number(normalized);
  if (!Number.isSafeInteger(count)) {
    throw invalidResponse(`Expected a safe order count at ${path}.`);
  }
  return count;
}

function tableCells(row: string, cell: "td" | "th"): string[] {
  const expression = new RegExp(
    `<${cell}\\b[^>]*>([\\s\\S]*?)<\\/${cell}>`,
    "giu",
  );
  return [...row.matchAll(expression)].map((match) => htmlText(match[1] ?? ""));
}

function legacyPaymentRows(html: string): readonly LegacySellerPayment[] {
  for (const tableMatch of html.matchAll(
    /<table\b[^>]*>([\s\S]*?)<\/table>/giu,
  )) {
    const table = tableMatch[1] ?? "";
    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu)];
    const header = rows
      .map((row) => tableCells(row[1] ?? "", "th"))
      .find((cells) => cells.length >= LEGACY_PAYMENT_HEADERS.length);
    if (
      header === undefined ||
      !LEGACY_PAYMENT_HEADERS.every(
        (expected, index) => header[index]?.toLowerCase() === expected,
      )
    ) {
      continue;
    }

    const payments: LegacySellerPayment[] = [];
    for (const [rowIndex, row] of rows.entries()) {
      const cells = tableCells(row[1] ?? "", "td");
      if (cells.length === 0) continue;
      if (cells.length === 1 && /^no\b/iu.test(cells[0] ?? "")) continue;
      if ((cells[0] ?? "").toLowerCase() === "totals") continue;
      if (cells.length < LEGACY_PAYMENT_HEADERS.length) {
        throw invalidResponse(
          `Expected ${String(LEGACY_PAYMENT_HEADERS.length)} payment columns at response.rows[${String(rowIndex)}].`,
        );
      }
      const path = `response.rows[${String(rowIndex)}]`;
      payments.push({
        estimatedArrivalDate: legacyDate(
          cells[0] ?? "",
          `${path}.estimatedArrivalDate`,
        ),
        initiatedDate: legacyDate(cells[1] ?? "", `${path}.initiatedDate`),
        ordersCount: legacyOrders(cells[2] ?? "", `${path}.ordersCount`),
        totalSales: legacyMoney(cells[3] ?? "", `${path}.totalSales`),
        totalFees: legacyMoney(cells[4] ?? "", `${path}.totalFees`),
        refundedOrders: legacyMoney(cells[5] ?? "", `${path}.refundedOrders`),
        refundedFees: legacyMoney(cells[6] ?? "", `${path}.refundedFees`),
        adjustments: legacyMoney(cells[7] ?? "", `${path}.adjustments`),
        amount: legacyMoney(cells[8] ?? "", `${path}.amount`),
      });
    }
    return payments;
  }
  throw invalidResponse("Expected the legacy seller payment table.");
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

export function parseSellerPaymentExperience(
  value: unknown,
  expectedSellerKey: string,
): SellerPaymentExperience {
  const source = record(value, "response");
  const seller = record(source["seller"], "response.seller");
  const sellerKey = stringValue(seller, "sellerKey", "response.seller");
  if (sellerKey.toLowerCase() !== expectedSellerKey.toLowerCase()) {
    throw invalidResponse(
      "TCGplayer returned account capabilities for a different seller.",
    );
  }
  const features = array(source["features"], "response.features");
  if (!features.every((feature) => typeof feature === "string")) {
    throw invalidResponse(
      "Expected string feature names at response.features.",
    );
  }
  return features.includes(PAYMENTS_EPS_FEATURE) ? "money-movement" : "legacy";
}

export function parseLegacySellerPayments(
  html: string,
  page: number,
): ListLegacySellerPaymentsResult {
  if (!/Past\s+Payment\s+History/iu.test(htmlText(html))) {
    throw invalidResponse("Expected the legacy past-payment page.");
  }
  let totalPages = page;
  for (const match of html.matchAll(
    /\/admin\/payment\/sellerpayment\?[^"'<>]*?\bpage=(\d+)/giu,
  )) {
    const candidate = Number(match[1]);
    if (Number.isSafeInteger(candidate) && candidate > totalPages) {
      totalPages = candidate;
    }
  }
  return { page, totalPages, payments: legacyPaymentRows(html) };
}

export function parseLegacyUpcomingSellerPayments(
  html: string,
): ListLegacyUpcomingSellerPaymentsResult {
  return { payments: legacyPaymentRows(html) };
}
