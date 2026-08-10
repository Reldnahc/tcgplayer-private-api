import { invalidArgument, TcgplayerApiError } from "../errors.js";
import {
  parseSellerFeedback,
  parseSellerFeedbackAggregation,
} from "../feedback-validation.js";
import {
  parseSellerMessageThread,
  parseSellerMessageThreads,
  parseSellerUnreadMessageCount,
} from "../messages-validation.js";
import {
  parseAuthenticatedSeller,
  parseLegacySellerPayments,
  parseLegacyUpcomingSellerPayments,
  parseSellerPaymentExperience,
  parseSellerPayoutDetail,
  parseSellerPayouts,
  parseSellerUnpaidBalance,
} from "../payments-validation.js";
import type {
  AuthenticatedSeller,
  GetSellerFeedbackAggregationInput,
  GetSellerMessageThreadInput,
  GetSellerPaymentExperienceInput,
  GetSellerPayoutInput,
  GetSellerUnpaidBalanceInput,
  ListLegacySellerPaymentsInput,
  ListLegacySellerPaymentsResult,
  ListLegacyUpcomingSellerPaymentsResult,
  ListSellerFeedbackInput,
  ListSellerFeedbackResult,
  ListSellerMessageThreadsInput,
  ListSellerMessageThreadsResult,
  ListSellerPayoutsInput,
  ListSellerPayoutsResult,
  MarkSellerMessageThreadReadInput,
  ReplyToSellerMessageThreadInput,
  RequestOptions,
  SellerFeedbackAggregation,
  SellerMessageThread,
  SellerPaymentExperience,
  SellerPayoutDetail,
  SellerPayoutStatus,
  SellerUnpaidBalance,
} from "../types.js";
import { SellerClientCore } from "./core.js";
import {
  boundedInteger,
  requestSignal,
  requiredText,
  sellerMessageBody,
  sellerMessageThreadTarget,
} from "./input.js";

const LEGACY_SELLER_PAYMENTS_PATH = "/admin/payment/sellerpayment";
const LEGACY_UPCOMING_PAYMENTS_PATH = "/admin/payment/loadpendingpayments?r=0";
const SELLER_FEEDBACK_PATH = "/sf/sellerorderfeedback/";
const SELLER_FEEDBACK_AGGREGATION_PATH = "/sf/sellerorderfeedback/aggregation/";
const SELLER_MESSAGES_PATH = "/admin/sp-msg-api";
const SELLER_UNREAD_MESSAGE_COUNT_PATH = "/messages/unread-count";
const SELLER_PAYOUT_STATUSES: ReadonlySet<SellerPayoutStatus> = new Set([
  "Staged",
  "InReview",
  "Committed",
  "InTransit",
  "Succeeded",
  "Rejected",
  "Failed",
  "Retrying",
]);

export class SellerAccountClient extends SellerClientCore {
  async getAuthenticatedSeller(
    options?: RequestOptions,
  ): Promise<AuthenticatedSeller> {
    const response = await this.transport.sellerPortalApiJson(
      "/Account/auth-detail?api-version=1.0",
      requestSignal(options),
    );
    return parseAuthenticatedSeller(response);
  }

  async getSellerPaymentExperience(
    input: GetSellerPaymentExperienceInput,
    options?: RequestOptions,
  ): Promise<SellerPaymentExperience> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Payment-experience input is required.");
    }
    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    const response = await this.transport.sellerPortalApiJson(
      "/Account/auth-detail?api-version=1.0",
      requestSignal(options),
    );
    return parseSellerPaymentExperience(response, sellerKey);
  }

  async listLegacySellerPayments(
    input: ListLegacySellerPaymentsInput = {},
    options?: RequestOptions,
  ): Promise<ListLegacySellerPaymentsResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Legacy payment search input must be an object.");
    }
    const page = boundedInteger("page", input.page, 1, 1, 1_000_000);
    const query = new URLSearchParams({ page: String(page) });
    return this.readLegacyPaymentTable(
      `${LEGACY_SELLER_PAYMENTS_PATH}?${query.toString()}`,
      (response) => parseLegacySellerPayments(response, page),
      options,
    );
  }

  async listLegacyUpcomingSellerPayments(
    options?: RequestOptions,
  ): Promise<ListLegacyUpcomingSellerPaymentsResult> {
    return this.readLegacyPaymentTable(
      LEGACY_UPCOMING_PAYMENTS_PATH,
      parseLegacyUpcomingSellerPayments,
      options,
    );
  }

  private async readLegacyPaymentTable<Result>(
    path: string,
    parse: (response: string) => Result,
    options?: RequestOptions,
  ): Promise<Result> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await this.transport.sellerPortalHtml(
        path,
        requestSignal(options),
      );
      try {
        return parse(response);
      } catch (error) {
        if (
          !(error instanceof TcgplayerApiError) ||
          error.code !== "INVALID_RESPONSE" ||
          attempt > 0
        ) {
          throw error;
        }
      }
    }
    throw new TcgplayerApiError(
      "INVALID_RESPONSE",
      "TCGplayer returned an invalid legacy payment response.",
    );
  }

  async listSellerFeedback(
    input: ListSellerFeedbackInput,
    options?: RequestOptions,
  ): Promise<ListSellerFeedbackResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Seller feedback search input is required.");
    }
    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    const offset = boundedInteger("offset", input.offset, 0, 0, 10_000_000);
    const rows = boundedInteger("rows", input.rows, 25, 1, 100);
    if (
      input.rating !== undefined &&
      (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
    ) {
      throw invalidArgument("rating must be an integer from 1 through 5.");
    }
    if (
      input.requireComment !== undefined &&
      typeof input.requireComment !== "boolean"
    ) {
      throw invalidArgument("requireComment must be a boolean.");
    }
    const days =
      input.days === undefined
        ? undefined
        : boundedInteger("days", input.days, 0, 1, 36_500);
    const query = new URLSearchParams({
      sellerKey,
      sortBy: "createdDate",
      offset: String(offset),
      rows: String(rows),
    });
    if (input.rating !== undefined) query.set("rating", String(input.rating));
    if (input.requireComment === true) query.set("requireComment", "true");
    if (days !== undefined) query.set("days", String(days));
    const response = await this.transport.sellerFeedbackJson(
      `${SELLER_FEEDBACK_PATH}?${query.toString()}`,
      requestSignal(options),
    );
    return parseSellerFeedback(response, sellerKey, offset, rows);
  }

  async getSellerFeedbackAggregation(
    input: GetSellerFeedbackAggregationInput,
    options?: RequestOptions,
  ): Promise<SellerFeedbackAggregation> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Seller feedback aggregation input is required.");
    }
    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    const days =
      input.days === undefined
        ? undefined
        : boundedInteger("days", input.days, 0, 1, 36_500);
    const query = new URLSearchParams({ sellerKey });
    if (days !== undefined) query.set("days", String(days));
    const response = await this.transport.sellerFeedbackJson(
      `${SELLER_FEEDBACK_AGGREGATION_PATH}?${query.toString()}`,
      requestSignal(options),
    );
    return parseSellerFeedbackAggregation(response);
  }

  async listSellerMessageThreads(
    input: ListSellerMessageThreadsInput,
    options?: RequestOptions,
  ): Promise<ListSellerMessageThreadsResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Seller message search input is required.");
    }
    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    const page = boundedInteger("page", input.page, 1, 1, 1_000_000);
    const pageSize = boundedInteger("pageSize", input.pageSize, 25, 1, 100);
    const orderNumber =
      input.orderNumber === undefined
        ? undefined
        : requiredText("orderNumber", input.orderNumber, 256);
    if (
      input.includeDeleted !== undefined &&
      typeof input.includeDeleted !== "boolean"
    ) {
      throw invalidArgument("includeDeleted must be a boolean.");
    }
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (orderNumber !== undefined) query.set("orderNumber", orderNumber);
    if (input.includeDeleted === true) query.set("includeAllThreads", "true");
    const response = await this.transport.sellerPortalMessagesJson(
      `${SELLER_MESSAGES_PATH}/${encodeURIComponent(sellerKey)}/threads?${query.toString()}`,
      requestSignal(options),
    );
    return parseSellerMessageThreads(response, page, pageSize);
  }

  async getSellerMessageThread(
    input: GetSellerMessageThreadInput,
    options?: RequestOptions,
  ): Promise<SellerMessageThread> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Seller message thread input is required.");
    }
    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    const threadId = boundedInteger(
      "threadId",
      input.threadId,
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const page = boundedInteger("page", input.page, 1, 1, 1_000_000);
    const pageSize = boundedInteger("pageSize", input.pageSize, 25, 1, 100);
    const query = new URLSearchParams({
      messagesPage: String(page),
      messagesPageSize: String(pageSize),
    });
    const response = await this.transport.sellerPortalMessagesJson(
      `${SELLER_MESSAGES_PATH}/${encodeURIComponent(sellerKey)}/threads/${String(threadId)}?${query.toString()}`,
      requestSignal(options),
    );
    return parseSellerMessageThread(response, threadId, page, pageSize);
  }

  async getSellerUnreadMessageCount(options?: RequestOptions): Promise<number> {
    const response = await this.transport.messagesApiJson(
      SELLER_UNREAD_MESSAGE_COUNT_PATH,
      requestSignal(options),
    );
    return parseSellerUnreadMessageCount(response);
  }

  async markSellerMessageThreadRead(
    input: MarkSellerMessageThreadReadInput,
    options?: RequestOptions,
  ): Promise<void> {
    const { sellerKey, threadId } = sellerMessageThreadTarget(input);
    await this.transport.sellerPortalMessagesIdempotentCommand(
      `${SELLER_MESSAGES_PATH}/${encodeURIComponent(sellerKey)}/threads/${String(threadId)}/mark-as-read`,
      undefined,
      requestSignal(options),
    );
  }

  async replyToSellerMessageThread(
    input: ReplyToSellerMessageThreadInput,
    options?: RequestOptions,
  ): Promise<void> {
    const { sellerKey, threadId } = sellerMessageThreadTarget(input);
    const body = sellerMessageBody(input.body);
    await this.transport.sellerPortalMessagesMutationCommand(
      `${SELLER_MESSAGES_PATH}/${encodeURIComponent(sellerKey)}/threads/${String(threadId)}/reply`,
      { replyMessageDto: { Body: body } },
      requestSignal(options),
    );
  }

  async listSellerPayouts(
    input: ListSellerPayoutsInput,
    options?: RequestOptions,
  ): Promise<ListSellerPayoutsResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Payout search input is required.");
    }
    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    const page = boundedInteger("page", input.page, 1, 1, 1_000_000);
    const pageSize = boundedInteger("pageSize", input.pageSize, 25, 1, 100);
    if (
      input.status !== undefined &&
      !SELLER_PAYOUT_STATUSES.has(input.status)
    ) {
      throw invalidArgument("status is unsupported.");
    }
    const query = new URLSearchParams({
      SellerKey: sellerKey,
      Page: String(page),
      PageSize: String(pageSize),
    });
    if (input.status !== undefined) query.set("Status", input.status);
    const response = await this.transport.moneyMovementJson(
      `/v1/Payouts?${query.toString()}`,
      requestSignal(options),
    );
    return parseSellerPayouts(
      response.value,
      response.totalCount,
      page,
      pageSize,
    );
  }

  async getSellerPayout(
    input: GetSellerPayoutInput,
    options?: RequestOptions,
  ): Promise<SellerPayoutDetail> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Payout detail input is required.");
    }
    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    const referenceId = requiredText("referenceId", input.referenceId, 256);
    const response = await this.transport.moneyMovementJson(
      `/v1/payouts/by-seller/${encodeURIComponent(sellerKey)}/${encodeURIComponent(referenceId)}`,
      requestSignal(options),
    );
    const payout = parseSellerPayoutDetail(response.value);
    if (payout.referenceId !== referenceId) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned details for a different payout reference.",
      );
    }
    return payout;
  }

  async getSellerUnpaidBalance(
    input: GetSellerUnpaidBalanceInput,
    options?: RequestOptions,
  ): Promise<SellerUnpaidBalance> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Unpaid-balance input is required.");
    }
    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    const query = new URLSearchParams({ SellerKey: sellerKey });
    const response = await this.transport.moneyMovementJson(
      `/v1/balances/payable?${query.toString()}`,
      requestSignal(options),
    );
    return parseSellerUnpaidBalance(response.value);
  }
}
