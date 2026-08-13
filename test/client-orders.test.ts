import { describe, expect, it, vi } from "vitest";
import {
  TcgplayerApiError,
  clientWith,
  fetchQueue,
  jsonResponse,
  syntheticOrder,
  syntheticOrderNumber,
  syntheticPdf,
  syntheticPullSheet,
  syntheticSellerKey,
  syntheticSummary,
} from "./client-fixtures.js";

describe("TcgplayerSellerClient orders and fulfillment", () => {
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

  it("normalizes observed order display labels without replacing the raw status", async () => {
    const { fetchImplementation } = fetchQueue([
      jsonResponse({
        totalOrders: 2,
        orders: [
          { ...syntheticSummary, orderStatus: "Ready to Ship" },
          { ...syntheticSummary, orderStatus: "Shipped - In Transit" },
        ],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.searchOrders({
      sellerKey: syntheticSellerKey,
    });

    expect(result.orders).toEqual([
      {
        ...syntheticSummary,
        orderStatus: "Ready to Ship",
        orderStatusCode: "ReadyToShip",
      },
      {
        ...syntheticSummary,
        orderStatus: "Shipped - In Transit",
        orderStatusCode: "Shipped",
      },
    ]);
  });

  it("returns Unknown for an unrecognized order display label", async () => {
    const { fetchImplementation } = fetchQueue([
      jsonResponse({
        totalOrders: 1,
        orders: [
          { ...syntheticSummary, orderStatus: "Synthetic Future State" },
        ],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.searchOrders({
      sellerKey: syntheticSellerKey,
    });

    expect(result.orders[0]).toMatchObject({
      orderStatus: "Synthetic Future State",
      orderStatusCode: "Unknown",
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
    expect(order.statusCode).toBe("ReadyToShip");
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

  it("accepts a signed PDF served as an octet stream", async () => {
    const { fetchImplementation } = fetchQueue([
      new Response(syntheticPdf, {
        headers: { "content-type": "application/octet-stream" },
      }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.getPackingSlip({
      orderNumber: syntheticOrderNumber,
      timezoneOffsetMinutes: 0,
    });

    expect(result.bytes).toEqual(syntheticPdf);
    expect(result.contentType).toBe("application/pdf");
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

  it("rejects the obsolete string-only tracking shape", async () => {
    const { fetchImplementation } = fetchQueue([
      jsonResponse({
        ...syntheticOrder,
        trackingNumbers: ["SYNTHETIC000000000"],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(client.getOrder(syntheticOrderNumber)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
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
    const onAuthenticationRequired = vi.fn();
    const client = clientWith(fetchImplementation, {
      onAuthenticationRequired,
    });

    await expect(client.getOrder(syntheticOrderNumber)).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });
    expect(onAuthenticationRequired).toHaveBeenCalledOnce();
  });

  it("notifies the caller when the current session requires authentication", async () => {
    const { fetchImplementation } = fetchQueue([jsonResponse({}, 401)]);
    const onAuthenticationRequired = vi.fn();
    const client = clientWith(fetchImplementation, {
      onAuthenticationRequired,
    });

    await expect(
      client.searchOrders({ sellerKey: syntheticSellerKey }),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
    expect(onAuthenticationRequired).toHaveBeenCalledOnce();
    expect(onAuthenticationRequired).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AUTHENTICATION_REQUIRED" }),
      {},
    );
  });

  it("identifies the session revision used by a late authentication failure", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetchImplementation = vi.fn(
      () =>
        new Promise<Response>((resolvePromise) => {
          resolveResponse = resolvePromise;
        }),
    );
    let sessionRevision = "old-session";
    const onAuthenticationRequired = vi.fn();
    const client = clientWith(fetchImplementation, {
      session: () => ({
        authCookie: `synthetic-cookie-${sessionRevision}`,
        revision: sessionRevision,
      }),
      onAuthenticationRequired,
    });

    const request = client.searchOrders({ sellerKey: syntheticSellerKey });
    await vi.waitFor(() => expect(fetchImplementation).toHaveBeenCalledOnce());
    sessionRevision = "replacement-session";
    resolveResponse?.(jsonResponse({}, 401));

    await expect(request).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });
    expect(onAuthenticationRequired).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AUTHENTICATION_REQUIRED" }),
      { sessionRevision: "old-session" },
    );
  });

  it("does not let an authentication observer replace the request error", async () => {
    const { fetchImplementation } = fetchQueue([jsonResponse({}, 401)]);
    const client = clientWith(fetchImplementation, {
      onAuthenticationRequired: () => {
        throw new Error("synthetic observer failure");
      },
    });

    await expect(
      client.searchOrders({ sellerKey: syntheticSellerKey }),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
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

  it("detects a carrier with the observed request contract", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ carrier: "USPS" }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.detectCarrier("9400000000000000000000"),
    ).resolves.toEqual({ carrier: "USPS" });
    expect(requests[0]?.url).toBe(
      "https://order-management-api.tcgplayer.com/orders/detect-carrier?api-version=2.0",
    );
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      trackingNumber: "9400000000000000000000",
    });
  });

  it("rejects an empty detected carrier", async () => {
    const { fetchImplementation } = fetchQueue([jsonResponse({ carrier: "" })]);
    const client = clientWith(fetchImplementation);

    await expect(client.detectCarrier("SYNTHETIC123")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("exports and validates a pull-sheet CSV served as an octet stream", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      new Response(syntheticPullSheet, {
        headers: { "content-type": "application/octet-stream" },
      }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.exportPullSheet({
      orderNumbers: [syntheticOrderNumber],
      timezoneOffsetMinutes: 360,
    });

    expect(result).toEqual({
      text: syntheticPullSheet,
      contentType: "text/csv",
      fileName: "pull-sheet.csv",
      orderNumbers: [syntheticOrderNumber],
      rows: [
        {
          productLine: "Example Game",
          productName: "Example, Card",
          condition: "Near Mint",
          number: "1",
          setName: "Example Set",
          rarity: "Rare",
          quantity: 1,
          mainPhotoUrl: "https://example.invalid/card",
          setReleaseDate: "2026-01-01",
          skuId: "200000",
          orderQuantity: 1,
          orderAllocations: [
            { orderNumber: syntheticOrderNumber, quantity: 1 },
          ],
        },
      ],
    });
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      orderNumbers: [syntheticOrderNumber],
      timezoneOffset: 360,
    });
  });

  it("sums per-order allocations in a pull-sheet row", async () => {
    const secondOrderNumber = "11111111111111111";
    const allocatedPullSheet = syntheticPullSheet
      .replace(
        `Rare,1,https://example.invalid/card,2026-01-01,200000,${syntheticOrderNumber}:1`,
        `Rare,3,https://example.invalid/card,2026-01-01,200000,${syntheticOrderNumber}:1 | ${secondOrderNumber}:2`,
      )
      .replace(
        `Orders Contained in Pull Sheet:,${syntheticOrderNumber}`,
        `Orders Contained in Pull Sheet:,${syntheticOrderNumber}|${secondOrderNumber}`,
      );
    const { fetchImplementation } = fetchQueue([
      new Response(allocatedPullSheet, {
        headers: { "content-type": "text/csv" },
      }),
    ]);

    const result = await clientWith(fetchImplementation).exportPullSheet({
      orderNumbers: [syntheticOrderNumber, secondOrderNumber],
      timezoneOffsetMinutes: 0,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.quantity).toBe(3);
    expect(result.rows[0]?.orderQuantity).toBe(3);
    expect(result.rows[0]?.orderAllocations).toEqual([
      { orderNumber: syntheticOrderNumber, quantity: 1 },
      { orderNumber: secondOrderNumber, quantity: 2 },
    ]);
  });

  it("associates a legacy numeric allocation only with a single requested order", async () => {
    const numericPullSheet = syntheticPullSheet.replace(
      `${syntheticOrderNumber}:1`,
      "1",
    );
    const { fetchImplementation } = fetchQueue([
      new Response(numericPullSheet, {
        headers: { "content-type": "text/csv" },
      }),
    ]);

    const result = await clientWith(fetchImplementation).exportPullSheet({
      orderNumbers: [syntheticOrderNumber],
      timezoneOffsetMinutes: 0,
    });

    expect(result.rows[0]?.orderAllocations).toEqual([
      { orderNumber: syntheticOrderNumber, quantity: 1 },
    ]);
  });

  it("does not guess a legacy numeric allocation across multiple requested orders", async () => {
    const secondOrderNumber = "11111111111111111";
    const numericPullSheet = syntheticPullSheet
      .replace(`${syntheticOrderNumber}:1`, "1")
      .replace(
        `Orders Contained in Pull Sheet:,${syntheticOrderNumber}`,
        `Orders Contained in Pull Sheet:,${syntheticOrderNumber}|${secondOrderNumber}`,
      );
    const { fetchImplementation } = fetchQueue([
      new Response(numericPullSheet, {
        headers: { "content-type": "text/csv" },
      }),
    ]);

    const result = await clientWith(fetchImplementation).exportPullSheet({
      orderNumbers: [syntheticOrderNumber, secondOrderNumber],
      timezoneOffsetMinutes: 0,
    });

    expect(result.rows[0]?.orderQuantity).toBe(1);
    expect(result.rows[0]?.orderAllocations).toEqual([]);
  });

  it("rejects a pull-sheet order summary that does not match the request", async () => {
    const mismatchedPullSheet = syntheticPullSheet.replace(
      `Orders Contained in Pull Sheet:,${syntheticOrderNumber}`,
      "Orders Contained in Pull Sheet:,11111111111111111",
    );
    const { fetchImplementation } = fetchQueue([
      new Response(mismatchedPullSheet, {
        headers: { "content-type": "text/csv" },
      }),
    ]);

    await expect(
      clientWith(fetchImplementation).exportPullSheet({
        orderNumbers: [syntheticOrderNumber],
        timezoneOffsetMinutes: 0,
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects pull-sheet allocations outside the requested orders", async () => {
    const unexpectedOrder = "11111111111111111";
    const mismatchedPullSheet = syntheticPullSheet.replace(
      `${syntheticOrderNumber}:1`,
      `${unexpectedOrder}:1`,
    );
    const { fetchImplementation } = fetchQueue([
      new Response(mismatchedPullSheet, {
        headers: { "content-type": "text/csv" },
      }),
    ]);

    await expect(
      clientWith(fetchImplementation).exportPullSheet({
        orderNumbers: [syntheticOrderNumber],
        timezoneOffsetMinutes: 0,
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects a pull sheet whose columns have drifted", async () => {
    const { fetchImplementation } = fetchQueue([
      new Response("Unknown,Columns\r\nvalue,value\r\n", {
        headers: { "content-type": "text/csv" },
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.exportPullSheet({
        orderNumbers: [syntheticOrderNumber],
        timezoneOffsetMinutes: 0,
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects malformed pull-sheet rows", async () => {
    const malformed = syntheticPullSheet.replace(
      `,200000,${syntheticOrderNumber}:1\r\n`,
      ',200000,"not an allocation"\r\n',
    );
    const { fetchImplementation } = fetchQueue([
      new Response(malformed, {
        headers: { "content-type": "text/csv" },
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.exportPullSheet({
        orderNumbers: [syntheticOrderNumber],
        timezoneOffsetMinutes: 0,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message: expect.stringContaining("Order Quantity"),
    });
  });

  it("adds tracking only after seller-scoped preflight confirmation", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ totalOrders: 1, orders: [syntheticSummary] }),
      jsonResponse(syntheticOrder),
      new Response(null, { status: 204 }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.addOrderTracking({
        sellerKey: syntheticSellerKey,
        orderNumber: syntheticOrderNumber,
        carrier: "USPS",
        trackingNumber: "9400000000000000000000",
      }),
    ).resolves.toEqual({
      orderNumber: syntheticOrderNumber,
      outcome: "applied",
    });
    expect(requests).toHaveLength(3);
    expect(requests[2]?.url).toBe(
      `https://order-management-api.tcgplayer.com/orders/${syntheticOrderNumber}/tracking?api-version=2.0`,
    );
    expect(JSON.parse(String(requests[2]?.init?.body))).toEqual({
      carrier: "USPS",
      trackingNumber: "9400000000000000000000",
    });
  });

  it("does not submit duplicate tracking", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ totalOrders: 1, orders: [syntheticSummary] }),
      jsonResponse(syntheticOrder),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.addOrderTracking({
        sellerKey: syntheticSellerKey,
        orderNumber: syntheticOrderNumber,
        carrier: "Synthetic Carrier",
        trackingNumber: "SYNTHETIC000000000",
      }),
    ).resolves.toEqual({
      orderNumber: syntheticOrderNumber,
      outcome: "already-applied",
    });
    expect(requests).toHaveLength(2);
  });

  it("ships an order without tracking after preflight confirmation", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ totalOrders: 1, orders: [syntheticSummary] }),
      jsonResponse({ ...syntheticOrder, trackingNumbers: [] }),
      new Response(null, { status: 204 }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.shipOrderWithoutTracking({
        sellerKey: syntheticSellerKey,
        orderNumber: syntheticOrderNumber,
      }),
    ).resolves.toMatchObject({ outcome: "applied" });
    expect(requests[2]?.url).toBe(
      `https://order-management-api.tcgplayer.com/orders/${syntheticOrderNumber}/ship-no-tracking?api-version=2.0`,
    );
    expect(requests[2]?.init?.body).toBeUndefined();
  });

  it("does not resubmit an already shipped order", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ totalOrders: 1, orders: [syntheticSummary] }),
      jsonResponse({ ...syntheticOrder, status: "Shipped" }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.shipOrderWithoutTracking({
        sellerKey: syntheticSellerKey,
        orderNumber: syntheticOrderNumber,
      }),
    ).resolves.toMatchObject({ outcome: "already-applied" });
    expect(requests).toHaveLength(2);
  });

  it("does not send a bulk mutation when every order is already shipped", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ totalOrders: 1, orders: [syntheticSummary] }),
      jsonResponse({ ...syntheticOrder, status: "Delivered" }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.markOrdersShipped({
        sellerKey: syntheticSellerKey,
        orderNumbers: [syntheticOrderNumber],
      }),
    ).resolves.toEqual({
      updatedOrderNumbers: [],
      alreadyShippedOrderNumbers: [syntheticOrderNumber],
      errors: [],
    });
    expect(requests).toHaveLength(2);
  });

  it("marks confirmed orders shipped and validates partial results", async () => {
    const secondOrderNumber = "00000000000000001";
    const secondSummary = {
      ...syntheticSummary,
      orderNumber: secondOrderNumber,
    };
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ totalOrders: 1, orders: [syntheticSummary] }),
      jsonResponse(syntheticOrder),
      jsonResponse({ totalOrders: 1, orders: [secondSummary] }),
      jsonResponse({ ...syntheticOrder, orderNumber: secondOrderNumber }),
      jsonResponse({
        updatedCount: 1,
        errorCount: 1,
        errors: [
          { orderNumber: secondOrderNumber, errorMessage: "Synthetic error" },
        ],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.markOrdersShipped({
        sellerKey: syntheticSellerKey,
        orderNumbers: [syntheticOrderNumber, secondOrderNumber],
      }),
    ).resolves.toEqual({
      updatedOrderNumbers: [syntheticOrderNumber],
      alreadyShippedOrderNumbers: [],
      errors: [{ orderNumber: secondOrderNumber, message: "Synthetic error" }],
    });
    expect(requests[4]?.url).toBe(
      "https://order-management-api.tcgplayer.com/orders/status-updates?api-version=2.0",
    );
    expect(JSON.parse(String(requests[4]?.init?.body))).toEqual({
      orderNumbers: [syntheticOrderNumber, secondOrderNumber],
      status: "Shipped",
    });
  });

  it("never automatically retries an ambiguous tracking mutation", async () => {
    let requests = 0;
    const fetchImplementation: typeof globalThis.fetch = async () => {
      requests += 1;
      if (requests === 1) {
        return jsonResponse({ totalOrders: 1, orders: [syntheticSummary] });
      }
      if (requests === 2) return jsonResponse(syntheticOrder);
      throw new Error("synthetic connection reset after submission");
    };
    const client = clientWith(fetchImplementation, {
      retry: { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 0 },
    });

    await expect(
      client.addOrderTracking({
        sellerKey: syntheticSellerKey,
        orderNumber: syntheticOrderNumber,
        carrier: "USPS",
        trackingNumber: "9400000000000000000000",
      }),
    ).rejects.toMatchObject({
      code: "AMBIGUOUS_RESULT",
      retryable: false,
    });
    expect(requests).toBe(3);
  });

  it("does not retry a mutation that receives a server error", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ totalOrders: 1, orders: [syntheticSummary] }),
      jsonResponse(syntheticOrder),
      jsonResponse({}, 503),
    ]);
    const client = clientWith(fetchImplementation, {
      retry: { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 0 },
    });

    await expect(
      client.addOrderTracking({
        sellerKey: syntheticSellerKey,
        orderNumber: syntheticOrderNumber,
        carrier: "USPS",
        trackingNumber: "9400000000000000000000",
      }),
    ).rejects.toMatchObject({
      code: "AMBIGUOUS_RESULT",
      retryable: false,
      status: 503,
    });
    expect(requests).toHaveLength(3);
  });

  it("classifies inconsistent bulk mutation results as ambiguous", async () => {
    const { fetchImplementation } = fetchQueue([
      jsonResponse({ totalOrders: 1, orders: [syntheticSummary] }),
      jsonResponse(syntheticOrder),
      jsonResponse({ updatedCount: 0, errorCount: 0, errors: [] }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.markOrdersShipped({
        sellerKey: syntheticSellerKey,
        orderNumbers: [syntheticOrderNumber],
      }),
    ).rejects.toMatchObject({ code: "AMBIGUOUS_RESULT" });
  });

  it("reads and validates the provider refund options", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({
        origins: [{ name: "Seller initiated", value: "SellerInitiated" }],
        reasons: [
          { name: "Inventory issue", value: "Product - Inventory Issue" },
        ],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(client.getOrderRefundOptions()).resolves.toEqual({
      origins: [{ name: "Seller initiated", value: "SellerInitiated" }],
      reasons: [
        { name: "Inventory issue", value: "Product - Inventory Issue" },
      ],
    });
    expect(requests[0]?.url).toBe(
      "https://order-management-api.tcgplayer.com/orders/refunds/options?api-version=2.0",
    );
  });

  it("derives exact refund capabilities and validates refund history", async () => {
    const order = {
      ...syntheticOrder,
      refunds: [
        {
          shippingAmount: 0.25,
          products: [{ skuId: "200000", amount: 2.5 }],
        },
      ],
      allowedActions: ["FullRefund"],
    };
    const { fetchImplementation } = fetchQueue([jsonResponse(order)]);
    const client = clientWith(fetchImplementation);

    await expect(client.getOrder(syntheticOrderNumber)).resolves.toMatchObject({
      refunds: order.refunds,
      refundCapabilities: { full: true, partial: false },
    });
  });

  it("submits a full refund only after seller-scoped confirmation", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ totalOrders: 1, orders: [syntheticSummary] }),
      jsonResponse(syntheticOrder),
      new Response(null, { status: 204 }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.refundOrderFull({
        sellerKey: syntheticSellerKey,
        orderNumber: syntheticOrderNumber,
        origin: "SellerInitiated",
        reason: "Product - Inventory Issue",
        reasonText: "Synthetic refund explanation",
      }),
    ).resolves.toEqual({
      orderNumber: syntheticOrderNumber,
      refundType: "full",
      outcome: "submitted",
    });
    expect(requests).toHaveLength(3);
    expect(requests[2]?.url).toBe(
      `https://order-management-api.tcgplayer.com/orders/${syntheticOrderNumber}/refund/full?api-version=2.0`,
    );
    expect(JSON.parse(String(requests[2]?.init?.body))).toEqual({
      origin: "SellerInitiated",
      reason: "Product - Inventory Issue",
      reasonText: "Synthetic refund explanation",
    });
  });

  it("submits bounded partial product and shipping refunds", async () => {
    const refundableOrder = {
      ...syntheticOrder,
      refunds: [
        {
          shippingAmount: 0.25,
          products: [{ skuId: "200000", amount: 2.5 }],
        },
      ],
    };
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ totalOrders: 1, orders: [syntheticSummary] }),
      jsonResponse(refundableOrder),
      new Response(null, { status: 204 }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.refundOrderPartial({
        sellerKey: syntheticSellerKey,
        orderNumber: syntheticOrderNumber,
        origin: "SellerInitiated",
        reason: "Product - Condition Issue",
        reasonText: "Synthetic partial refund",
        shippingRefundAmount: 1,
        products: [{ skuId: "200000", refundAmount: 10 }],
      }),
    ).resolves.toMatchObject({ refundType: "partial", outcome: "submitted" });
    expect(JSON.parse(String(requests[2]?.init?.body))).toEqual({
      origin: "SellerInitiated",
      reason: "Product - Condition Issue",
      reasonText: "Synthetic partial refund",
      shippingRefundAmount: 1,
      products: [
        {
          skuId: "200000",
          listoId: 300000,
          refundAmount: 10,
        },
      ],
    });
  });

  it("rejects a partial refund above the confirmed remaining amount", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({ totalOrders: 1, orders: [syntheticSummary] }),
      jsonResponse({
        ...syntheticOrder,
        refunds: [
          {
            shippingAmount: 0,
            products: [{ skuId: "200000", amount: 12 }],
          },
        ],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.refundOrderPartial({
        sellerKey: syntheticSellerKey,
        orderNumber: syntheticOrderNumber,
        origin: "SellerInitiated",
        reason: "Product - Condition Issue",
        reasonText: "Synthetic partial refund",
        shippingRefundAmount: 0,
        products: [{ skuId: "200000", refundAmount: 1 }],
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(requests).toHaveLength(2);
  });

  it("never automatically retries an ambiguous refund", async () => {
    let requests = 0;
    const fetchImplementation: typeof globalThis.fetch = async () => {
      requests += 1;
      if (requests === 1) {
        return jsonResponse({ totalOrders: 1, orders: [syntheticSummary] });
      }
      if (requests === 2) return jsonResponse(syntheticOrder);
      throw new Error("synthetic response lost after refund submission");
    };
    const client = clientWith(fetchImplementation, {
      retry: { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 0 },
    });

    await expect(
      client.refundOrderFull({
        sellerKey: syntheticSellerKey,
        orderNumber: syntheticOrderNumber,
        origin: "SellerInitiated",
        reason: "General - Cancellation",
        reasonText: "Synthetic ambiguous refund",
      }),
    ).rejects.toMatchObject({ code: "AMBIGUOUS_RESULT", retryable: false });
    expect(requests).toBe(3);
  });
});
