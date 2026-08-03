import { invalidArgument, TcgplayerApiError } from "./errors.js";
import { SellerApiTransport } from "./transport.js";
import type {
  ConfirmedSellerOrder,
  ConfirmSellerOrderInput,
  ExportPackingSlipsInput,
  GetPackingSlipInput,
  PackingSlipDocument,
  RequestOptions,
  SearchSellerOrdersInput,
  SearchSellerOrdersResult,
  SellerOrderDetail,
  TcgplayerSellerClientOptions,
} from "./types.js";
import {
  parseSearchSellerOrdersResult,
  parseSellerOrderDetail,
} from "./validation.js";

const SEARCH_PATH = "/orders/search?api-version=2.0";
const PACKING_SLIPS_PATH = "/orders/packing-slips/export?api-version=2.0";

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
      if (normalized !== "ReadyToShip") {
        throw invalidArgument(`statuses[${index}] is unsupported.`);
      }
      return normalized;
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
}

export function createTcgplayerSellerClient(
  options: TcgplayerSellerClientOptions,
): TcgplayerSellerClient {
  return new TcgplayerSellerClient(options);
}
