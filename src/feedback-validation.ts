import { invalidResponse } from "./errors.js";
import type {
  ListSellerFeedbackResult,
  SellerFeedbackAggregation,
  SellerFeedbackAnswerCounts,
  SellerFeedbackEntry,
  SellerFeedbackRating,
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

function optionalBooleanValue(
  source: UnknownRecord,
  key: string,
  path: string,
): boolean | undefined {
  const value = source[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw invalidResponse(`Expected a boolean at ${path}.${key}.`);
  }
  return value;
}

function optionalText(
  source: UnknownRecord,
  key: string,
  path: string,
  maximumLength: number,
): string | undefined {
  const value = source[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > maximumLength) {
    throw invalidResponse(`Expected text at ${path}.${key}.`);
  }
  return value;
}

function timestamp(source: UnknownRecord, key: string, path: string): string {
  const value = source[key];
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 128 ||
    !Number.isFinite(Date.parse(value))
  ) {
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

function ratingValue(
  source: UnknownRecord,
  key: string,
  path: string,
): SellerFeedbackRating {
  const value = source[key];
  if (
    !Number.isInteger(value) ||
    typeof value !== "number" ||
    value < 1 ||
    value > 5
  ) {
    throw invalidResponse(
      `Expected a rating from 1 through 5 at ${path}.${key}.`,
    );
  }
  return value as SellerFeedbackRating;
}

function feedbackEntry(
  value: unknown,
  path: string,
  expectedSellerKey: string,
): SellerFeedbackEntry {
  const source = record(value, path);
  const sellerKey = source["sellerKey"];
  if (
    typeof sellerKey !== "string" ||
    sellerKey.toLowerCase() !== expectedSellerKey.toLowerCase()
  ) {
    throw invalidResponse(
      `Expected feedback for the requested seller at ${path}.sellerKey.`,
    );
  }
  const comment = optionalText(source, "comment", path, 20_000);
  const buyerNickname = optionalText(source, "userNickname", path, 512);
  const updatedAt = optionalTimestamp(source, "updatedDate", path);
  const goodCommunication = optionalBooleanValue(
    source,
    "goodCommunication",
    path,
  );
  return {
    rating: ratingValue(source, "feedbackRating", path),
    ...(comment === undefined ? {} : { comment }),
    ...(buyerNickname === undefined ? {} : { buyerNickname }),
    createdAt: timestamp(source, "createdDate", path),
    ...(updatedAt === undefined ? {} : { updatedAt }),
    active: booleanValue(source, "active", path),
    arrivedWhenExpected: booleanValue(source, "arrivedWhenExpected", path),
    asDescribed: booleanValue(source, "asDescribed", path),
    ...(goodCommunication === undefined ? {} : { goodCommunication }),
  };
}

function answerCounts(
  source: UnknownRecord,
  prefix: string,
  path: string,
): SellerFeedbackAnswerCounts {
  return {
    positive: nonNegativeInteger(source, `${prefix}Positive`, path),
    negative: nonNegativeInteger(source, `${prefix}Negative`, path),
    unanswered: nonNegativeInteger(source, `${prefix}Empty`, path),
  };
}

export function parseSellerFeedback(
  value: unknown,
  expectedSellerKey: string,
  offset: number,
  rows: number,
): ListSellerFeedbackResult {
  const response = record(value, "response");
  const feedback = array(response["result"], "response.result").map(
    (entry, index) =>
      feedbackEntry(
        entry,
        `response.result[${String(index)}]`,
        expectedSellerKey,
      ),
  );
  const totalFeedback = nonNegativeInteger(response, "total", "response");
  if (totalFeedback < feedback.length || feedback.length > rows) {
    throw invalidResponse(
      "TCGplayer returned inconsistent feedback pagination.",
    );
  }
  return { totalFeedback, offset, rows, feedback };
}

export function parseSellerFeedbackAggregation(
  value: unknown,
): SellerFeedbackAggregation {
  const response = record(value, "response");
  const result = record(response["result"], "response.result");
  return {
    totalRatings: nonNegativeInteger(
      result,
      "totalFeedbackRatings",
      "response.result",
    ),
    fiveStar: nonNegativeInteger(
      result,
      "feedbackRatingFive",
      "response.result",
    ),
    fourStar: nonNegativeInteger(
      result,
      "feedbackRatingFour",
      "response.result",
    ),
    threeStar: nonNegativeInteger(
      result,
      "feedbackRatingThree",
      "response.result",
    ),
    twoStar: nonNegativeInteger(result, "feedbackRatingTwo", "response.result"),
    oneStar: nonNegativeInteger(result, "feedbackRatingOne", "response.result"),
    arrivedWhenExpected: answerCounts(
      result,
      "arrivedWhenExpected",
      "response.result",
    ),
    asDescribed: answerCounts(result, "asDescribed", "response.result"),
    goodCommunication: answerCounts(
      result,
      "goodCommunication",
      "response.result",
    ),
    totalAdditionalRatings: nonNegativeInteger(
      result,
      "totalAdditionalRatings",
      "response.result",
    ),
  };
}
