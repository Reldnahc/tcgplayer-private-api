import { describe, expect, it } from "vitest";
import {
  createTcgplayerSellerClient,
  TcgplayerApiError,
  type TcgplayerSellerClientOptions,
} from "../src/index.js";
import {
  syntheticOrder,
  syntheticOrderNumber,
  syntheticPdf,
  syntheticSellerKey,
  syntheticSummary,
} from "./fixtures.js";

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function jsonResponse(
  value: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function fetchQueue(responses: readonly Response[]) {
  const queue = [...responses];
  const requests: CapturedRequest[] = [];
  const fetchImplementation: typeof globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    const response = queue.shift();
    if (response === undefined) throw new Error("No synthetic response queued");
    return response;
  };
  return { fetchImplementation, requests };
}

function clientWith(
  fetchImplementation: typeof globalThis.fetch,
  overrides: Partial<TcgplayerSellerClientOptions> = {},
) {
  return createTcgplayerSellerClient({
    session: { authCookie: "synthetic-cookie-value" },
    fetch: fetchImplementation,
    requestDelayMs: 0,
    retry: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 },
    ...overrides,
  });
}

describe("TcgplayerSellerClient", () => {
  it("searches seller orders with the observed request contract", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ totalOrders: 1, orders: [syntheticSummary] }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.searchOrders({
      sellerKey: syntheticSellerKey,
      orderNumber: syntheticOrderNumber,
      statuses: ["ReadyToShip"],
      offset: 5,
      limit: 25,
      sort: [{ field: "orderDate", direction: "descending" }],
    });

    expect(result).toEqual({ totalOrders: 1, orders: [syntheticSummary] });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      "https://order-management-api.tcgplayer.com/orders/search?api-version=2.0",
    );
    const headers = new Headers(requests[0]?.init?.headers);
    expect(headers.get("cookie")).toBe(
      "TCGAuthTicket_Production=synthetic-cookie-value;",
    );
    expect(headers.get("accept")).toBe("application/json");
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      searchRange: "LastThreeMonths",
      query: { orderNumber: syntheticOrderNumber },
      filters: {
        sellerKey: syntheticSellerKey,
        orderStatuses: ["ReadyToShip"],
      },
      sortBy: [{ sortingType: "orderDate", direction: "descending" }],
      from: 5,
      size: 25,
    });
  });

  it("retrieves and validates an encoded order detail", async () => {
    const orderNumber = "synthetic/order";
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ ...syntheticOrder, orderNumber }),
    ]);
    const client = clientWith(fetchImplementation);

    const order = await client.getOrder(orderNumber);

    expect(order.orderNumber).toBe(orderNumber);
    expect(requests[0]?.url).toBe(
      "https://order-management-api.tcgplayer.com/orders/synthetic%2Forder?api-version=2.0",
    );
    expect(requests[0]?.init?.method).toBe("GET");
  });

  it("rejects details for a different order number", async () => {
    const { fetchImplementation } = fetchQueue([
      jsonResponse({ ...syntheticOrder, orderNumber: "different-order" }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(client.getOrder(syntheticOrderNumber)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("confirms an exact seller order before returning details", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ totalOrders: 1, orders: [syntheticSummary] }),
      jsonResponse(syntheticOrder),
    ]);
    const client = clientWith(fetchImplementation);

    const confirmed = await client.confirmOrder({
      sellerKey: syntheticSellerKey,
      orderNumber: syntheticOrderNumber,
    });

    expect(confirmed).toEqual({
      summary: syntheticSummary,
      order: syntheticOrder,
    });
    expect(requests).toHaveLength(2);
  });

  it("does not fetch details when seller-scoped confirmation misses", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ totalOrders: 0, orders: [] }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.confirmOrder({
        sellerKey: syntheticSellerKey,
        orderNumber: syntheticOrderNumber,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(requests).toHaveLength(1);
  });

  it("exports validated packing-slip PDF bytes", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      new Response(syntheticPdf, {
        headers: { "content-type": "application/pdf" },
      }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.getPackingSlip({
      orderNumber: syntheticOrderNumber,
      timezoneOffsetMinutes: 360,
    });

    expect(result.bytes).toEqual(syntheticPdf);
    expect(result.contentType).toBe("application/pdf");
    expect(result.fileName).toBe("packing-slip.pdf");
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      sortingType: "ByRelease",
      format: "Default",
      timezoneOffset: 360,
      orderNumbers: [syntheticOrderNumber],
    });
  });

  it("rejects non-PDF packing-slip responses", async () => {
    const { fetchImplementation } = fetchQueue([
      new Response("not a pdf", {
        headers: { "content-type": "application/pdf" },
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.getPackingSlip({
        orderNumber: syntheticOrderNumber,
        timezoneOffsetMinutes: 0,
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects malformed remote order data", async () => {
    const { fetchImplementation } = fetchQueue([
      jsonResponse({ ...syntheticOrder, products: [{ quantity: "one" }] }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(client.getOrder(syntheticOrderNumber)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("rejects a negative remote product quantity", async () => {
    const { fetchImplementation } = fetchQueue([
      jsonResponse({
        ...syntheticOrder,
        products: [{ ...syntheticOrder.products[0], quantity: -1 }],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(client.getOrder(syntheticOrderNumber)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("classifies an HTML success page as expired authentication", async () => {
    const { fetchImplementation } = fetchQueue([
      new Response("<html>login</html>", {
        headers: { "content-type": "text/html" },
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(client.getOrder(syntheticOrderNumber)).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });
  });

  it("rejects a full Cookie header before sending a request", async () => {
    const { fetchImplementation, requests } = fetchQueue([]);
    const client = clientWith(fetchImplementation, {
      session: { authCookie: "first=value; second=value" },
    });

    await expect(client.getOrder(syntheticOrderNumber)).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    expect(requests).toHaveLength(0);
  });

  it("retries a bounded transient response", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({}, 503),
      jsonResponse({ totalOrders: 0, orders: [] }),
    ]);
    const client = clientWith(fetchImplementation, {
      retry: { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });

    await expect(
      client.searchOrders({ sellerKey: syntheticSellerKey }),
    ).resolves.toEqual({ totalOrders: 0, orders: [] });
    expect(requests).toHaveLength(2);
  });

  it("reloads the session provider for a retry", async () => {
    let sessionLoads = 0;
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({}, 503),
      jsonResponse({ totalOrders: 0, orders: [] }),
    ]);
    const client = clientWith(fetchImplementation, {
      session: () => ({ authCookie: `synthetic-cookie-${++sessionLoads}` }),
      retry: { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });

    await client.searchOrders({ sellerKey: syntheticSellerKey });

    expect(sessionLoads).toBe(2);
    expect(new Headers(requests[0]?.init?.headers).get("cookie")).toBe(
      "TCGAuthTicket_Production=synthetic-cookie-1;",
    );
    expect(new Headers(requests[1]?.init?.headers).get("cookie")).toBe(
      "TCGAuthTicket_Production=synthetic-cookie-2;",
    );
  });

  it("retries a bounded transient network failure", async () => {
    let attempts = 0;
    const fetchImplementation: typeof globalThis.fetch = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("synthetic connection reset");
      return jsonResponse({ totalOrders: 0, orders: [] });
    };
    const client = clientWith(fetchImplementation, {
      retry: { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });

    await expect(
      client.searchOrders({ sellerKey: syntheticSellerKey }),
    ).resolves.toEqual({ totalOrders: 0, orders: [] });
    expect(attempts).toBe(2);
  });

  it("does not retry forbidden responses", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({}, 403),
    ]);
    const client = clientWith(fetchImplementation, {
      retry: { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0 },
    });

    await expect(client.getOrder(syntheticOrderNumber)).rejects.toMatchObject({
      code: "FORBIDDEN",
      retryable: false,
    });
    expect(requests).toHaveLength(1);
  });

  it("times out a stalled request with a typed error", async () => {
    const fetchImplementation: typeof globalThis.fetch = async (
      _input,
      init,
    ) => {
      const signal = init?.signal;
      if (signal === undefined || signal === null) {
        throw new Error("synthetic test expected an abort signal");
      }
      return new Promise<Response>((_resolve, reject) => {
        const onAbort = () =>
          reject(new DOMException("synthetic timeout", "AbortError"));
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      });
    };
    const client = clientWith(fetchImplementation, {
      timeoutMs: 1,
      retry: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 },
    });

    await expect(client.getOrder(syntheticOrderNumber)).rejects.toMatchObject({
      code: "TIMEOUT",
      retryable: true,
    });
  });

  it("enforces response size limits before reading the body", async () => {
    const { fetchImplementation } = fetchQueue([
      jsonResponse({ totalOrders: 0, orders: [] }, 200, {
        "content-length": "2048",
      }),
    ]);
    const client = clientWith(fetchImplementation, {
      maxJsonResponseBytes: 1024,
    });

    await expect(
      client.searchOrders({ sellerKey: syntheticSellerKey }),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });

  it("rejects unsupported runtime filter values with a typed error", async () => {
    const { fetchImplementation, requests } = fetchQueue([]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.searchOrders({
        sellerKey: syntheticSellerKey,
        statuses: ["UnknownStatus" as "ReadyToShip"],
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(requests).toHaveLength(0);
  });

  it("exports a stable typed error class", () => {
    const error = new TcgplayerApiError("NOT_FOUND", "Synthetic failure");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("NOT_FOUND");
  });
});
