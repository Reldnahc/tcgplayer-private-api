import { invalidArgument, TcgplayerApiError } from "./errors.js";
import {
  parseCatalogFoilSkuIds,
  parseCatalogProduct,
  parseCatalogSearch,
  parseCatalogSkuMarketPrices,
  rankCatalogProducts,
  withCatalogFoilMarketPrices,
} from "./catalog-validation.js";
import {
  parseSellerFeedback,
  parseSellerFeedbackAggregation,
} from "./feedback-validation.js";
import {
  parseMarketplaceProductListings,
  parseMarketplaceProducts,
} from "./marketplace-validation.js";
import {
  parseSellerMessageThread,
  parseSellerMessageThreads,
  parseSellerUnreadMessageCount,
} from "./messages-validation.js";
import {
  parseAuthenticatedSeller,
  parseLegacySellerPayments,
  parseLegacyUpcomingSellerPayments,
  parseSellerPaymentExperience,
  parseSellerPayoutDetail,
  parseSellerPayouts,
  parseSellerUnpaidBalance,
} from "./payments-validation.js";
import { SellerApiTransport } from "./transport.js";
import type {
  AddSellerInventoryInput,
  AddSellerInventoryResult,
  AddOrderTrackingInput,
  AuthenticatedSeller,
  CatalogProductDetails,
  ConfirmedSellerOrder,
  ConfirmSellerOrderInput,
  DetectCarrierResult,
  ExportPackingSlipsInput,
  ExportPullSheetInput,
  GetSellerPaymentExperienceInput,
  GetSellerFeedbackAggregationInput,
  GetSellerMessageThreadInput,
  GetSellerPayoutInput,
  GetSellerUnpaidBalanceInput,
  GetPackingSlipInput,
  GetCatalogProductInput,
  MarkOrdersShippedInput,
  MarkOrdersShippedResult,
  ListSellerInventoryInput,
  ListSellerInventoryOptions,
  ListSellerFeedbackInput,
  ListSellerFeedbackResult,
  ListSellerMessageThreadsInput,
  ListSellerMessageThreadsResult,
  ListLegacySellerPaymentsInput,
  ListLegacySellerPaymentsResult,
  ListLegacyUpcomingSellerPaymentsResult,
  ListSellerPayoutsInput,
  ListSellerPayoutsResult,
  MarketplaceProduct,
  MarkSellerMessageThreadReadInput,
  OrderFulfillmentMutationResult,
  PackingSlipDocument,
  PullSheetDocument,
  RequestOptions,
  ReplyToSellerMessageThreadInput,
  RemoveSellerInventoryInput,
  RemoveSellerInventoryResult,
  SearchSellerOrdersInput,
  SearchSellerOrdersResult,
  SearchMarketplaceProductsInput,
  SearchMarketplaceProductListingsInput,
  SearchMarketplaceProductListingsResult,
  SearchMarketplaceProductsResult,
  SearchCatalogProductsInput,
  SearchCatalogProductsResult,
  SellerInventoryAddition,
  SellerInventoryRemoval,
  SellerPaymentExperience,
  SellerFeedbackAggregation,
  SellerMessageThread,
  SellerPayoutDetail,
  SellerPayoutStatus,
  SellerUnpaidBalance,
  SellerOrderDetail,
  SellerOrderStatusFilter,
  ShipOrderWithoutTrackingInput,
  TcgplayerSellerClientOptions,
  UpdateSellerPricesInput,
  UpdateSellerPricesResult,
} from "./types.js";
import {
  parseDetectCarrierResult,
  parseMarkOrdersShippedResponse,
  parseSearchSellerOrdersResult,
  parseSellerOrderDetail,
} from "./validation.js";

const SEARCH_PATH = "/orders/search?api-version=2.0";
const PACKING_SLIPS_PATH = "/orders/packing-slips/export?api-version=2.0";
const PULL_SHEET_PATH = "/orders/pull-sheets/export?api-version=2.0";
const DETECT_CARRIER_PATH = "/orders/detect-carrier?api-version=2.0";
const STATUS_UPDATES_PATH = "/orders/status-updates?api-version=2.0";
const UPDATE_INVENTORY_PATH = "/admin/pricing/updateinventory";
const LEGACY_SELLER_PAYMENTS_PATH = "/admin/payment/sellerpayment";
const LEGACY_UPCOMING_PAYMENTS_PATH = "/admin/payment/loadpendingpayments?r=0";
const SELLER_FEEDBACK_PATH = "/sf/sellerorderfeedback/";
const SELLER_FEEDBACK_AGGREGATION_PATH = "/sf/sellerorderfeedback/aggregation/";
const SELLER_MESSAGES_PATH = "/admin/sp-msg-api";
const SELLER_UNREAD_MESSAGE_COUNT_PATH = "/messages/unread-count";
const MARKETPLACE_SEARCH_PATH = "/v1/search/request";
const MARKETPLACE_PRODUCT_LISTINGS_PATH = "/v1/product";
const MARKETPLACE_PRODUCT_PATH = "/v2/product";
const MARKETPLACE_SKU_PRICE_PATH = "/v1/pricepoints/marketprice/skus/search";
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
const SELLER_ORDER_STATUSES: ReadonlySet<SellerOrderStatusFilter> = new Set([
  "Canceled",
  "Delivered",
  "PickedUp",
  "PickupOrderCanceled",
  "Processing",
  "Pulling",
  "ReadyForPickup",
  "ReadyToShip",
  "Received",
  "Shipped",
  "ShippedOrderCanceled",
]);
const PULL_SHEET_COLUMNS = [
  "Product Line",
  "Product Name",
  "Condition",
  "Number",
  "Set",
  "Rarity",
  "Quantity",
  "Main Photo URL",
  "Set Release Date",
  "SkuId",
  "Order Quantity",
] as const;

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function requiredText(name: string, value: string, maximum: number): string {
  if (typeof value !== "string") {
    throw invalidArgument(`${name} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw invalidArgument(`${name} must contain 1-${maximum} characters.`);
  }
  if (containsControlCharacter(normalized)) {
    throw invalidArgument(`${name} must not contain control characters.`);
  }
  return normalized;
}

function sellerMessageBody(value: string): string {
  if (typeof value !== "string") {
    throw invalidArgument("body must be a string.");
  }
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (normalized.length < 1 || normalized.length > 10_000) {
    throw invalidArgument("body must contain 1-10000 characters.");
  }
  for (const character of normalized) {
    const code = character.charCodeAt(0);
    if (
      (code <= 0x1f && character !== "\n" && character !== "\t") ||
      code === 0x7f
    ) {
      throw invalidArgument(
        "body must not contain unsupported control characters.",
      );
    }
  }
  return normalized;
}

function sellerMessageThreadTarget(
  input: MarkSellerMessageThreadReadInput | ReplyToSellerMessageThreadInput,
): { readonly sellerKey: string; readonly threadId: number } {
  if (typeof input !== "object" || input === null) {
    throw invalidArgument("Seller message thread input is required.");
  }
  return {
    sellerKey: requiredText("sellerKey", input.sellerKey, 256),
    threadId: boundedInteger(
      "threadId",
      input.threadId,
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
  };
}

function boundedInteger(
  name: string,
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw invalidArgument(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return resolved;
}

function finiteNumber(
  name: string,
  value: number,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw invalidArgument(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

function appendFormValue(
  form: URLSearchParams,
  path: string,
  value: string | number | boolean | null,
): void {
  form.append(path, value === null ? "" : String(value));
}

function normalizeOrderNumbers(values: readonly string[]): string[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 500) {
    throw invalidArgument("orderNumbers must contain 1-500 order numbers.");
  }

  const normalized = values.map((value, index) =>
    requiredText(`orderNumbers[${index}]`, value, 128),
  );
  if (new Set(normalized).size !== normalized.length) {
    throw invalidArgument("orderNumbers must not contain duplicates.");
  }
  return normalized;
}

function requestSignal(options: RequestOptions | undefined) {
  return options?.signal;
}

function uniqueTextValues(
  name: string,
  values: readonly string[] | undefined,
): string[] | undefined {
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.length === 0 || values.length > 100) {
    throw invalidArgument(`${name} must contain 1-100 values.`);
  }
  const normalized = values.map((value, index) =>
    requiredText(`${name}[${String(index)}]`, value, 256),
  );
  if (new Set(normalized).size !== normalized.length) {
    throw invalidArgument(`${name} must not contain duplicates.`);
  }
  return normalized;
}

function uniqueProductIds(
  values: readonly number[] | undefined,
): number[] | undefined {
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.length === 0 || values.length > 24) {
    throw invalidArgument("productIds must contain 1-24 values.");
  }
  const normalized = values.map((value, index) =>
    boundedInteger(
      `productIds[${String(index)}]`,
      value,
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
  );
  if (new Set(normalized).size !== normalized.length) {
    throw invalidArgument("productIds must not contain duplicates.");
  }
  return normalized;
}

function isShippedStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized.startsWith("shipped") || normalized === "delivered";
}

function validatePullSheet(text: string): void {
  const firstLine = text.replace(/^\uFEFF/u, "").split(/\r?\n/u, 1)[0] ?? "";
  if (firstLine !== PULL_SHEET_COLUMNS.join(",")) {
    throw new TcgplayerApiError(
      "INVALID_RESPONSE",
      "TCGplayer returned a pull sheet with an unsupported column schema.",
    );
  }
}

interface InventoryFormUpdate {
  readonly productId: number;
  readonly productName: string;
  readonly productConditionId: number;
  readonly conditionId: number;
  readonly channelId: number;
  readonly categoryName: string;
  /** Absolute post-add quantity, matching Seller Portal's computed newQty. */
  readonly quantity: number;
  readonly addQuantity: number;
  readonly price: number;
  readonly storePriceCustomId: number | null;
  readonly reserveQuantity: number;
}

function buildInventoryUpdateForm(updates: readonly InventoryFormUpdate[]): {
  readonly form: URLSearchParams;
  readonly productConditionIds: number[];
} {
  const form = new URLSearchParams();
  const listingKeys = new Set<string>();
  const productConditionIds: number[] = [];
  updates.forEach((update, index) => {
    if (typeof update !== "object" || update === null) {
      throw invalidArgument(`updates[${index}] must be an object.`);
    }
    const path = `productQuantityPrices[${index}]`;
    const productId = boundedInteger(
      `updates[${index}].productId`,
      update.productId,
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const productConditionId = boundedInteger(
      `updates[${index}].productConditionId`,
      update.productConditionId,
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const conditionId = boundedInteger(
      `updates[${index}].conditionId`,
      update.conditionId,
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const channelId = boundedInteger(
      `updates[${index}].channelId`,
      update.channelId,
      0,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    const quantity = boundedInteger(
      `updates[${index}].quantity`,
      update.quantity,
      0,
      0,
      10_000_000,
    );
    const addQuantity = boundedInteger(
      `updates[${index}].addQuantity`,
      update.addQuantity,
      0,
      0,
      10_000_000,
    );
    const price = finiteNumber(
      `updates[${index}].price`,
      update.price,
      0.01,
      1_000_000,
    );
    if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-9) {
      throw invalidArgument(
        `updates[${index}].price must have at most two decimal places.`,
      );
    }
    const reserveQuantity = finiteNumber(
      `updates[${index}].reserveQuantity`,
      update.reserveQuantity,
      0,
      10_000_000,
    );
    const storePriceCustomId =
      update.storePriceCustomId === null
        ? null
        : boundedInteger(
            `updates[${index}].storePriceCustomId`,
            update.storePriceCustomId,
            0,
            0,
            Number.MAX_SAFE_INTEGER,
          );
    const key = `${productConditionId}:${channelId}`;
    if (listingKeys.has(key)) {
      throw invalidArgument(
        "updates must not contain duplicate productConditionId/channelId pairs.",
      );
    }
    listingKeys.add(key);
    productConditionIds.push(productConditionId);

    appendFormValue(form, `${path}[ProductId]`, productId);
    appendFormValue(
      form,
      `${path}[ProductName]`,
      requiredText(`updates[${index}].productName`, update.productName, 1024),
    );
    appendFormValue(form, `${path}[AddToQuantity]`, addQuantity);
    const conditionPath = `${path}[ConditionQuantityPrices][0]`;
    appendFormValue(
      form,
      `${conditionPath}[ProductConditionId]`,
      productConditionId,
    );
    appendFormValue(form, `${conditionPath}[ConditionId]`, conditionId);
    appendFormValue(form, `${conditionPath}[ChannelId]`, channelId);
    appendFormValue(
      form,
      `${conditionPath}[CategoryName]`,
      requiredText(`updates[${index}].categoryName`, update.categoryName, 256),
    );
    appendFormValue(form, `${conditionPath}[Quantity]`, quantity);
    appendFormValue(form, `${conditionPath}[Price]`, price.toFixed(2));
    appendFormValue(form, `${conditionPath}[ExistingQuantity]`, 0);
    appendFormValue(
      form,
      `${conditionPath}[StorePriceCustomId]`,
      storePriceCustomId,
    );
    appendFormValue(form, `${conditionPath}[ReserveQuantity]`, reserveQuantity);
  });
  appendFormValue(form, "type", "Pricing");
  appendFormValue(form, "isStaged", false);
  return { form, productConditionIds };
}

export class TcgplayerSellerClient {
  private readonly transport: SellerApiTransport;

  constructor(options: TcgplayerSellerClientOptions) {
    if (typeof options !== "object" || options === null) {
      throw invalidArgument("Client options are required.");
    }
    this.transport = new SellerApiTransport(options);
  }

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

  async searchOrders(
    input: SearchSellerOrdersInput,
    options?: RequestOptions,
  ): Promise<SearchSellerOrdersResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Search input is required.");
    }

    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    if (
      input.searchRange !== undefined &&
      input.searchRange !== "LastThreeMonths"
    ) {
      throw invalidArgument("searchRange is unsupported.");
    }
    const orderNumber =
      input.orderNumber === undefined
        ? undefined
        : requiredText("orderNumber", input.orderNumber, 128);
    const offset = boundedInteger("offset", input.offset, 0, 0, 1_000_000);
    const limit = boundedInteger("limit", input.limit, 100, 1, 500);
    if (input.statuses !== undefined && !Array.isArray(input.statuses)) {
      throw invalidArgument("statuses must be an array.");
    }
    const statuses = input.statuses?.map((status, index) => {
      const normalized = requiredText(`statuses[${index}]`, status, 64);
      if (!SELLER_ORDER_STATUSES.has(normalized as SellerOrderStatusFilter)) {
        throw invalidArgument(`statuses[${index}] is unsupported.`);
      }
      return normalized as SellerOrderStatusFilter;
    });
    if (input.sort !== undefined && !Array.isArray(input.sort)) {
      throw invalidArgument("sort must be an array.");
    }
    const sortBy = (input.sort ?? []).map((sort, index) => {
      if (typeof sort !== "object" || sort === null) {
        throw invalidArgument(`sort[${index}] must be an object.`);
      }
      if (sort.field !== "orderStatus" && sort.field !== "orderDate") {
        throw invalidArgument(`sort[${index}].field is unsupported.`);
      }
      if (sort.direction !== "ascending" && sort.direction !== "descending") {
        throw invalidArgument(`sort[${index}].direction is unsupported.`);
      }
      return { sortingType: sort.field, direction: sort.direction };
    });

    const payload = {
      searchRange: input.searchRange ?? "LastThreeMonths",
      ...(orderNumber === undefined ? {} : { query: { orderNumber } }),
      filters: {
        sellerKey,
        ...(statuses === undefined || statuses.length === 0
          ? {}
          : { orderStatuses: statuses }),
      },
      sortBy,
      from: offset,
      size: limit,
    };

    const response = await this.transport.json(
      "POST",
      SEARCH_PATH,
      payload,
      requestSignal(options),
    );
    return parseSearchSellerOrdersResult(response);
  }

  async getOrder(
    orderNumber: string,
    options?: RequestOptions,
  ): Promise<SellerOrderDetail> {
    const normalized = requiredText("orderNumber", orderNumber, 128);
    const response = await this.transport.json(
      "GET",
      `/orders/${encodeURIComponent(normalized)}?api-version=2.0`,
      undefined,
      requestSignal(options),
    );
    const order = parseSellerOrderDetail(response);
    if (order.orderNumber !== normalized) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned details for a different order number.",
      );
    }
    return order;
  }

  async confirmOrder(
    input: ConfirmSellerOrderInput,
    options?: RequestOptions,
  ): Promise<ConfirmedSellerOrder> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Confirmation input is required.");
    }
    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    const orderNumber = requiredText("orderNumber", input.orderNumber, 128);
    const search = await this.searchOrders(
      {
        sellerKey,
        orderNumber,
        sort: [
          { field: "orderStatus", direction: "ascending" },
          { field: "orderDate", direction: "ascending" },
        ],
        limit: 25,
      },
      options,
    );
    const summary = search.orders.find(
      (candidate) => candidate.orderNumber === orderNumber,
    );
    if (summary === undefined) {
      throw new TcgplayerApiError(
        "NOT_FOUND",
        "The order was not found for the authenticated seller.",
      );
    }

    const order = await this.getOrder(orderNumber, options);
    return { summary, order };
  }

  async exportPackingSlips(
    input: ExportPackingSlipsInput,
    options?: RequestOptions,
  ): Promise<PackingSlipDocument> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Packing-slip input is required.");
    }
    const orderNumbers = normalizeOrderNumbers(input.orderNumbers);
    if (typeof input.timezoneOffsetMinutes !== "number") {
      throw invalidArgument("timezoneOffsetMinutes must be a number.");
    }
    const timezoneOffsetMinutes = boundedInteger(
      "timezoneOffsetMinutes",
      input.timezoneOffsetMinutes,
      0,
      -840,
      840,
    );
    const response = await this.transport.pdf(
      PACKING_SLIPS_PATH,
      {
        sortingType: "ByRelease",
        format: "Default",
        timezoneOffset: timezoneOffsetMinutes,
        orderNumbers,
      },
      requestSignal(options),
    );

    return {
      bytes: response.bytes,
      contentType: "application/pdf",
      fileName:
        orderNumbers.length === 1 ? "packing-slip.pdf" : "packing-slips.pdf",
      orderNumbers,
    };
  }

  async getPackingSlip(
    input: GetPackingSlipInput,
    options?: RequestOptions,
  ): Promise<PackingSlipDocument> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Packing-slip input is required.");
    }
    return this.exportPackingSlips(
      {
        orderNumbers: [input.orderNumber],
        timezoneOffsetMinutes: input.timezoneOffsetMinutes,
      },
      options,
    );
  }

  async detectCarrier(
    trackingNumber: string,
    options?: RequestOptions,
  ): Promise<DetectCarrierResult> {
    const normalized = requiredText("trackingNumber", trackingNumber, 256);
    const response = await this.transport.json(
      "POST",
      DETECT_CARRIER_PATH,
      { trackingNumber: normalized },
      requestSignal(options),
    );
    return parseDetectCarrierResult(response);
  }

  async exportPullSheet(
    input: ExportPullSheetInput,
    options?: RequestOptions,
  ): Promise<PullSheetDocument> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Pull-sheet input is required.");
    }
    const orderNumbers = normalizeOrderNumbers(input.orderNumbers);
    if (typeof input.timezoneOffsetMinutes !== "number") {
      throw invalidArgument("timezoneOffsetMinutes must be a number.");
    }
    const timezoneOffsetMinutes = boundedInteger(
      "timezoneOffsetMinutes",
      input.timezoneOffsetMinutes,
      0,
      -840,
      840,
    );
    const text = await this.transport.text(
      PULL_SHEET_PATH,
      { orderNumbers, timezoneOffset: timezoneOffsetMinutes },
      requestSignal(options),
    );
    validatePullSheet(text);
    return {
      text,
      contentType: "text/csv",
      fileName: "pull-sheet.csv",
      orderNumbers,
    };
  }

  async addOrderTracking(
    input: AddOrderTrackingInput,
    options?: RequestOptions,
  ): Promise<OrderFulfillmentMutationResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Tracking input is required.");
    }
    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    const orderNumber = requiredText("orderNumber", input.orderNumber, 128);
    const carrier = requiredText("carrier", input.carrier, 128);
    const trackingNumber = requiredText(
      "trackingNumber",
      input.trackingNumber,
      256,
    );
    const confirmed = await this.confirmOrder(
      { sellerKey, orderNumber },
      options,
    );
    if (
      confirmed.order.trackingNumbers.some(
        (tracking) =>
          tracking.trackingNumber.trim().toLowerCase() ===
          trackingNumber.toLowerCase(),
      )
    ) {
      return { orderNumber, outcome: "already-applied" };
    }

    await this.transport.command(
      `/orders/${encodeURIComponent(orderNumber)}/tracking?api-version=2.0`,
      { carrier, trackingNumber },
      requestSignal(options),
    );
    return { orderNumber, outcome: "applied" };
  }

  async shipOrderWithoutTracking(
    input: ShipOrderWithoutTrackingInput,
    options?: RequestOptions,
  ): Promise<OrderFulfillmentMutationResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Shipment input is required.");
    }
    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    const orderNumber = requiredText("orderNumber", input.orderNumber, 128);
    const confirmed = await this.confirmOrder(
      { sellerKey, orderNumber },
      options,
    );
    if (isShippedStatus(confirmed.order.status)) {
      return { orderNumber, outcome: "already-applied" };
    }

    await this.transport.command(
      `/orders/${encodeURIComponent(orderNumber)}/ship-no-tracking?api-version=2.0`,
      undefined,
      requestSignal(options),
    );
    return { orderNumber, outcome: "applied" };
  }

  async markOrdersShipped(
    input: MarkOrdersShippedInput,
    options?: RequestOptions,
  ): Promise<MarkOrdersShippedResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Shipment input is required.");
    }
    const sellerKey = requiredText("sellerKey", input.sellerKey, 256);
    const orderNumbers = normalizeOrderNumbers(input.orderNumbers);
    const alreadyShippedOrderNumbers: string[] = [];
    const pendingOrderNumbers: string[] = [];
    for (const orderNumber of orderNumbers) {
      const confirmed = await this.confirmOrder(
        { sellerKey, orderNumber },
        options,
      );
      if (isShippedStatus(confirmed.order.status)) {
        alreadyShippedOrderNumbers.push(orderNumber);
      } else {
        pendingOrderNumbers.push(orderNumber);
      }
    }
    if (pendingOrderNumbers.length === 0) {
      return {
        updatedOrderNumbers: [],
        alreadyShippedOrderNumbers,
        errors: [],
      };
    }

    const response = await this.transport.mutationJson(
      STATUS_UPDATES_PATH,
      { orderNumbers: pendingOrderNumbers, status: "Shipped" },
      requestSignal(options),
    );
    let parsed: ReturnType<typeof parseMarkOrdersShippedResponse>;
    try {
      parsed = parseMarkOrdersShippedResponse(response);
    } catch (error) {
      throw new TcgplayerApiError(
        "AMBIGUOUS_RESULT",
        "TCGplayer accepted a shipment mutation but returned an unsupported result. Reconcile the affected orders.",
        { cause: error },
      );
    }
    const submitted = new Set(pendingOrderNumbers);
    const failed = new Set<string>();
    for (const error of parsed.errors) {
      if (!submitted.has(error.orderNumber) || failed.has(error.orderNumber)) {
        throw new TcgplayerApiError(
          "AMBIGUOUS_RESULT",
          "TCGplayer returned inconsistent results for a shipment mutation. Reconcile the affected orders.",
        );
      }
      failed.add(error.orderNumber);
    }
    const updatedOrderNumbers = pendingOrderNumbers.filter(
      (orderNumber) => !failed.has(orderNumber),
    );
    if (
      parsed.updatedCount !== updatedOrderNumbers.length ||
      parsed.updatedCount + parsed.errorCount !== pendingOrderNumbers.length
    ) {
      throw new TcgplayerApiError(
        "AMBIGUOUS_RESULT",
        "TCGplayer returned inconsistent counts for a shipment mutation. Reconcile the affected orders.",
      );
    }
    return {
      updatedOrderNumbers,
      alreadyShippedOrderNumbers,
      errors: parsed.errors,
    };
  }

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

  async updateSellerPrices(
    input: UpdateSellerPricesInput,
    options?: RequestOptions,
  ): Promise<UpdateSellerPricesResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Price-update input is required.");
    }
    if (
      !Array.isArray(input.updates) ||
      input.updates.length === 0 ||
      input.updates.length > 100
    ) {
      throw invalidArgument("updates must contain 1-100 price updates.");
    }

    const formUpdates = input.updates.map((update, index) => {
      if (typeof update !== "object" || update === null) {
        throw invalidArgument(`updates[${index}] must be an object.`);
      }
      return {
        ...update,
        addQuantity: 0,
      };
    });
    const { form, productConditionIds } = buildInventoryUpdateForm(formUpdates);

    await this.transport.sellerPortalFormCommand(
      UPDATE_INVENTORY_PATH,
      form,
      requestSignal(options),
    );
    return { submittedProductConditionIds: productConditionIds };
  }

  async addSellerInventory(
    input: AddSellerInventoryInput,
    options?: RequestOptions,
  ): Promise<AddSellerInventoryResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Inventory-add input is required.");
    }
    if (
      !Array.isArray(input.additions) ||
      input.additions.length === 0 ||
      input.additions.length > 100
    ) {
      throw invalidArgument(
        "additions must contain 1-100 inventory additions.",
      );
    }
    input.additions.forEach((addition: SellerInventoryAddition, index) => {
      if (typeof addition !== "object" || addition === null) {
        throw invalidArgument(`additions[${index}] must be an object.`);
      }
      const addQuantity = boundedInteger(
        `additions[${index}].addQuantity`,
        addition.addQuantity,
        0,
        1,
        10_000_000,
      );
      const currentQuantity = boundedInteger(
        `additions[${index}].currentQuantity`,
        addition.currentQuantity,
        0,
        0,
        10_000_000,
      );
      if (currentQuantity + addQuantity > 10_000_000) {
        throw invalidArgument(
          `additions[${index}] would exceed the supported quantity limit.`,
        );
      }
    });
    const formAdditions = input.additions.map((addition) => ({
      ...addition,
      quantity: addition.currentQuantity + addition.addQuantity,
    }));
    const { form, productConditionIds } =
      buildInventoryUpdateForm(formAdditions);
    await this.transport.sellerPortalFormCommand(
      UPDATE_INVENTORY_PATH,
      form,
      requestSignal(options),
    );
    return { submittedProductConditionIds: productConditionIds };
  }

  async removeSellerInventory(
    input: RemoveSellerInventoryInput,
    options?: RequestOptions,
  ): Promise<RemoveSellerInventoryResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Inventory-removal input is required.");
    }
    if (
      !Array.isArray(input.removals) ||
      input.removals.length === 0 ||
      input.removals.length > 100
    ) {
      throw invalidArgument("removals must contain 1-100 inventory removals.");
    }
    input.removals.forEach((removal: SellerInventoryRemoval, index) => {
      if (typeof removal !== "object" || removal === null) {
        throw invalidArgument(`removals[${index}] must be an object.`);
      }
      boundedInteger(
        `removals[${index}].currentQuantity`,
        removal.currentQuantity,
        0,
        1,
        10_000_000,
      );
      if (removal.reserveQuantity !== 0) {
        throw invalidArgument(
          `removals[${index}].reserveQuantity must be zero.`,
        );
      }
    });
    const formRemovals = input.removals.map((removal) => ({
      ...removal,
      addQuantity: 0,
      quantity: 0,
    }));
    const { form, productConditionIds } =
      buildInventoryUpdateForm(formRemovals);
    await this.transport.sellerPortalFormCommand(
      UPDATE_INVENTORY_PATH,
      form,
      requestSignal(options),
    );
    return { submittedProductConditionIds: productConditionIds };
  }
}

export function createTcgplayerSellerClient(
  options: TcgplayerSellerClientOptions,
): TcgplayerSellerClient {
  return new TcgplayerSellerClient(options);
}
