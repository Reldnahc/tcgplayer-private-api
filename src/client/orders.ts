import { invalidArgument, TcgplayerApiError } from "../errors.js";
import { parsePullSheetRows } from "../pull-sheet-validation.js";
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
  OrderRefundMutationResult,
  PackingSlipDocument,
  PullSheetDocument,
  RefundOrderFullInput,
  RefundOrderPartialInput,
  RequestOptions,
  SearchSellerOrdersInput,
  SearchSellerOrdersResult,
  SellerOrderDetail,
  SellerOrderRefundOptions,
  SellerOrderStatusFilter,
  ShipOrderWithoutTrackingInput,
} from "../types.js";
import {
  parseDetectCarrierResult,
  parseMarkOrdersShippedResponse,
  parseSearchSellerOrdersResult,
  parseSellerOrderDetail,
  parseSellerOrderRefundOptions,
} from "../validation.js";
import { SellerClientCore } from "./core.js";
import {
  boundedInteger,
  currencyCents,
  isShippedStatus,
  normalizeOrderNumbers,
  refundBase,
  requestSignal,
  requiredText,
} from "./input.js";

const SEARCH_PATH = "/orders/search?api-version=2.0";
const PACKING_SLIPS_PATH = "/orders/packing-slips/export?api-version=2.0";
const PULL_SHEET_PATH = "/orders/pull-sheets/export?api-version=2.0";
const DETECT_CARRIER_PATH = "/orders/detect-carrier?api-version=2.0";
const STATUS_UPDATES_PATH = "/orders/status-updates?api-version=2.0";
const REFUND_OPTIONS_PATH = "/orders/refunds/options?api-version=2.0";
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

export class SellerOrderClient extends SellerClientCore {
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
    const rows = parsePullSheetRows(text);
    return {
      text,
      contentType: "text/csv",
      fileName: "pull-sheet.csv",
      orderNumbers,
      rows,
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

  async getOrderRefundOptions(
    options?: RequestOptions,
  ): Promise<SellerOrderRefundOptions> {
    const response = await this.transport.json(
      "GET",
      REFUND_OPTIONS_PATH,
      undefined,
      requestSignal(options),
    );
    return parseSellerOrderRefundOptions(response);
  }

  async refundOrderFull(
    input: RefundOrderFullInput,
    options?: RequestOptions,
  ): Promise<OrderRefundMutationResult> {
    const normalized = refundBase(input);
    const confirmed = await this.confirmOrder(
      {
        sellerKey: normalized.sellerKey,
        orderNumber: normalized.orderNumber,
      },
      options,
    );
    if (!confirmed.order.refundCapabilities.full) {
      throw new TcgplayerApiError(
        "FORBIDDEN",
        "TCGplayer does not currently allow a full refund for this order.",
      );
    }
    await this.transport.command(
      `/orders/${encodeURIComponent(normalized.orderNumber)}/refund/full?api-version=2.0`,
      {
        origin: normalized.origin,
        reason: normalized.reason,
        reasonText: normalized.reasonText,
      },
      requestSignal(options),
    );
    return {
      orderNumber: normalized.orderNumber,
      refundType: "full",
      outcome: "submitted",
    };
  }

  async refundOrderPartial(
    input: RefundOrderPartialInput,
    options?: RequestOptions,
  ): Promise<OrderRefundMutationResult> {
    const normalized = refundBase(input);
    if (!Array.isArray(input.products) || input.products.length > 500) {
      throw invalidArgument("products must contain 0-500 refund lines.");
    }
    const shippingRefundCents = currencyCents(
      "shippingRefundAmount",
      input.shippingRefundAmount,
    );
    const seen = new Set<string>();
    const requestedProducts = input.products.map((product, index) => {
      if (typeof product !== "object" || product === null) {
        throw invalidArgument(`products[${index}] must be an object.`);
      }
      const skuId = requiredText(
        `products[${index}].skuId`,
        product.skuId,
        128,
      );
      if (seen.has(skuId)) {
        throw invalidArgument("products must not contain duplicate SKU ids.");
      }
      seen.add(skuId);
      return {
        skuId,
        refundCents: currencyCents(
          `products[${index}].refundAmount`,
          product.refundAmount,
        ),
      };
    });
    if (
      shippingRefundCents === 0 &&
      requestedProducts.every((product) => product.refundCents === 0)
    ) {
      throw invalidArgument("A partial refund must total at least $0.01.");
    }

    const confirmed = await this.confirmOrder(
      {
        sellerKey: normalized.sellerKey,
        orderNumber: normalized.orderNumber,
      },
      options,
    );
    if (!confirmed.order.refundCapabilities.partial) {
      throw new TcgplayerApiError(
        "FORBIDDEN",
        "TCGplayer does not currently allow a partial refund for this order.",
      );
    }

    const previousShippingCents = confirmed.order.refunds.reduce(
      (total, refund) => total + Math.round(refund.shippingAmount * 100),
      0,
    );
    const remainingShippingCents =
      Math.round(confirmed.order.transaction.shippingAmount * 100) -
      previousShippingCents;
    if (shippingRefundCents > remainingShippingCents) {
      throw invalidArgument(
        "shippingRefundAmount exceeds the confirmed refundable shipping amount.",
      );
    }

    const products = requestedProducts
      .filter((requested) => requested.refundCents > 0)
      .map((requested) => {
        const orderLines = confirmed.order.products.filter(
          (product) => product.skuId === requested.skuId,
        );
        if (orderLines.length === 0) {
          throw invalidArgument(
            `SKU ${requested.skuId} is not present on the confirmed order.`,
          );
        }
        const purchasedCents = orderLines.reduce(
          (total, product) => total + Math.round(product.extendedPrice * 100),
          0,
        );
        const previouslyRefundedCents = confirmed.order.refunds.reduce(
          (total, refund) =>
            total +
            refund.products
              .filter((product) => product.skuId === requested.skuId)
              .reduce(
                (subtotal, product) =>
                  subtotal + Math.round(product.amount * 100),
                0,
              ),
          0,
        );
        if (requested.refundCents > purchasedCents - previouslyRefundedCents) {
          throw invalidArgument(
            `Refund for SKU ${requested.skuId} exceeds its confirmed refundable amount.`,
          );
        }
        const listoId = orderLines.find(
          (product) => product.listoId !== undefined,
        )?.listoId;
        return {
          skuId: requested.skuId,
          refundAmount: requested.refundCents / 100,
          ...(listoId === undefined ? {} : { listoId }),
        };
      });

    await this.transport.command(
      `/orders/${encodeURIComponent(normalized.orderNumber)}/refund/partial?api-version=2.0`,
      {
        origin: normalized.origin,
        reason: normalized.reason,
        reasonText: normalized.reasonText,
        shippingRefundAmount: shippingRefundCents / 100,
        products,
      },
      requestSignal(options),
    );
    return {
      orderNumber: normalized.orderNumber,
      refundType: "partial",
      outcome: "submitted",
    };
  }
}
