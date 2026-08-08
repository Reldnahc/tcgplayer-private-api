import { invalidResponse } from "./errors.js";
import type {
  ListSellerMessageThreadsResult,
  SellerMessage,
  SellerMessageThread,
  SellerMessageThreadSummary,
} from "./types.js";

type UnknownRecord = Record<string, unknown>;

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

function positiveInteger(
  source: UnknownRecord,
  key: string,
  path: string,
): number {
  const value = nonNegativeInteger(source, key, path);
  if (value === 0) {
    throw invalidResponse(`Expected a positive integer at ${path}.${key}.`);
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

function text(
  source: UnknownRecord,
  key: string,
  path: string,
  maximumLength: number,
  allowEmpty = false,
): string {
  const value = source[key];
  if (
    typeof value !== "string" ||
    (!allowEmpty && value.length === 0) ||
    value.length > maximumLength
  ) {
    throw invalidResponse(`Expected text at ${path}.${key}.`);
  }
  return value;
}

function optionalText(
  source: UnknownRecord,
  key: string,
  path: string,
  maximumLength: number,
): string {
  const value = source[key];
  if (value === undefined || value === null) return "";
  return text(source, key, path, maximumLength, true);
}

function timestamp(source: UnknownRecord, key: string, path: string): string {
  const value = text(source, key, path, 128);
  if (!Number.isFinite(Date.parse(value))) {
    throw invalidResponse(`Expected a timestamp at ${path}.${key}.`);
  }
  return value;
}

function optionalTimestamp(
  source: UnknownRecord,
  key: string,
  path: string,
): string | undefined {
  const value = source[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (
    typeof value !== "string" ||
    value.length > 128 ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw invalidResponse(`Expected a timestamp at ${path}.${key}.`);
  }
  return value;
}

function envelopeResult(value: unknown, path: string): UnknownRecord {
  const envelope = record(value, path);
  if (envelope["status"] !== 200) {
    throw invalidResponse(
      `Expected a successful Seller Portal response at ${path}.`,
    );
  }
  return record(envelope["result"], `${path}.result`);
}

function threadSummary(
  value: unknown,
  path: string,
): SellerMessageThreadSummary {
  const source = record(value, path);
  const respondedAt = optionalTimestamp(source, "respondedAt", path);
  const activeEscalationAsOf = optionalTimestamp(
    source,
    "activeEscalationAsOf",
    path,
  );
  return {
    threadId: positiveInteger(source, "threadId", path),
    unreadMessageCount: nonNegativeInteger(source, "unreadMessageCount", path),
    totalMessageCount: nonNegativeInteger(source, "totalMessageCount", path),
    sender: text(source, "sender", path, 512),
    receiver: text(source, "receiver", path, 512),
    subject: text(source, "subject", path, 2_000),
    orderType: optionalText(source, "orderType", path, 128),
    orderNumber: optionalText(source, "orderNumber", path, 256),
    orderStatus: optionalText(source, "orderStatus", path, 128),
    createdAt: timestamp(source, "createdAt", path),
    ...(respondedAt === undefined ? {} : { respondedAt }),
    ...(activeEscalationAsOf === undefined ? {} : { activeEscalationAsOf }),
    deleted: booleanValue(source, "isTrashed", path),
  };
}

function message(value: unknown, path: string): SellerMessage {
  const source = record(value, path);
  return {
    messageId: positiveInteger(source, "messageId", path),
    body: text(source, "body", path, 100_000, true),
    createdAt: timestamp(source, "createdAt", path),
    sender: text(source, "sender", path, 512),
    responseRequired: booleanValue(source, "messageResponseRequired", path),
    isRead: booleanValue(source, "isRead", path),
  };
}

function validateMessagePage(
  total: number,
  returned: number,
  pageSize: number,
): void {
  if (returned > pageSize || total < returned) {
    throw invalidResponse(
      "TCGplayer returned inconsistent message pagination.",
    );
  }
}

export function parseSellerMessageThreads(
  value: unknown,
  page: number,
  pageSize: number,
): ListSellerMessageThreadsResult {
  const result = envelopeResult(value, "response");
  const threads = array(result["results"], "response.result.results").map(
    (entry, index) =>
      threadSummary(entry, `response.result.results[${String(index)}]`),
  );
  const totalThreads = nonNegativeInteger(
    result,
    "totalResults",
    "response.result",
  );
  validateMessagePage(totalThreads, threads.length, pageSize);
  return { totalThreads, page, pageSize, threads };
}

export function parseSellerMessageThread(
  value: unknown,
  expectedThreadId: number,
  page: number,
  pageSize: number,
): SellerMessageThread {
  const result = envelopeResult(value, "response");
  const threadId = positiveInteger(result, "threadId", "response.result");
  if (threadId !== expectedThreadId) {
    throw invalidResponse("TCGplayer returned a different message thread.");
  }
  const messages = array(result["messages"], "response.result.messages").map(
    (entry, index) =>
      message(entry, `response.result.messages[${String(index)}]`),
  );
  const totalMessageCount = nonNegativeInteger(
    result,
    "totalMessageCount",
    "response.result",
  );
  validateMessagePage(totalMessageCount, messages.length, pageSize);
  const activeEscalationAsOf = optionalTimestamp(
    result,
    "activeEscalationAsOf",
    "response.result",
  );
  return {
    threadId,
    subject: text(result, "subject", "response.result", 2_000),
    ...(activeEscalationAsOf === undefined ? {} : { activeEscalationAsOf }),
    totalMessageCount,
    messages,
    orderType: optionalText(result, "orderType", "response.result", 128),
    orderNumber: optionalText(result, "orderNumber", "response.result", 256),
    deleted: booleanValue(result, "isTrashed", "response.result"),
    page,
    pageSize,
  };
}

export function parseSellerUnreadMessageCount(value: unknown): number {
  const response = record(value, "response");
  return nonNegativeInteger(response, "count", "response");
}
