import { invalidArgument, TcgplayerApiError } from "./errors.js";
import { SellerApiTransport } from "./transport.js";
import type {
  AddOrderTrackingInput,
  ConfirmedSellerOrder,
  ConfirmSellerOrderInput,
  DetectCarrierResult,
  ExportPackingSlipsInput,
  ExportPullSheetInput,
  GetPackingSlipInput,
  MarkOrdersShippedInput,
  MarkOrdersShippedResult,
  OrderFulfillmentMutationResult,
  PackingSlipDocument,
  PullSheetDocument,
  RequestOptions,
  SearchSellerOrdersInput,
  SearchSellerOrdersResult,
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
const UPDATE_INVENTORY_PATH = "/admin/product/updateinventory";
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

export class TcgplayerSellerClient {
  private readonly transport: SellerApiTransport;

  constructor(options: TcgplayerSellerClientOptions) {
    if (typeof options !== "object" || options === null) {
      throw invalidArgument("Client options are required.");
    }
    this.transport = new SellerApiTransport(options);
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

    const form = new URLSearchParams();
    const listingKeys = new Set<string>();
    const submittedProductConditionIds: number[] = [];
    input.updates.forEach((update, index) => {
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
      const price = finiteNumber(
        `updates[${index}].price`,
        update.price,
        0.01,
        1_000_000,
      );
      const priceInCents = price * 100;
      if (Math.abs(priceInCents - Math.round(priceInCents)) > 1e-9) {
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
      submittedProductConditionIds.push(productConditionId);

      appendFormValue(form, `${path}[ProductId]`, productId);
      appendFormValue(
        form,
        `${path}[ProductName]`,
        requiredText(`updates[${index}].productName`, update.productName, 1024),
      );
      appendFormValue(form, `${path}[AddToQuantity]`, 0);
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
        requiredText(
          `updates[${index}].categoryName`,
          update.categoryName,
          256,
        ),
      );
      appendFormValue(form, `${conditionPath}[Quantity]`, quantity);
      appendFormValue(form, `${conditionPath}[Price]`, price.toFixed(2));
      appendFormValue(form, `${conditionPath}[ExistingQuantity]`, 0);
      appendFormValue(
        form,
        `${conditionPath}[StorePriceCustomId]`,
        storePriceCustomId,
      );
      appendFormValue(
        form,
        `${conditionPath}[ReserveQuantity]`,
        reserveQuantity,
      );
    });

    await this.transport.sellerPortalFormCommand(
      UPDATE_INVENTORY_PATH,
      form,
      requestSignal(options),
    );
    return { submittedProductConditionIds };
  }
}

export function createTcgplayerSellerClient(
  options: TcgplayerSellerClientOptions,
): TcgplayerSellerClient {
  return new TcgplayerSellerClient(options);
}
