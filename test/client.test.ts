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
  syntheticPullSheet,
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
  it("reads and validates live seller inventory from marketplace search", async () => {
    const marketplaceProduct = {
      productId: 123,
      productName: "Synthetic Card",
      productLineName: "Synthetic Game",
      setName: "Synthetic Set",
      rarityName: null,
      marketPrice: 3.5,
      lowestPrice: 3.25,
      lowestPriceWithShipping: 4.24,
      totalListings: 8,
      listings: [
        {
          listingId: 77,
          productId: 123,
          productConditionId: 456,
          conditionId: 2,
          condition: "Lightly Played",
          channelId: 0,
          printing: "Normal",
          language: "English",
          languageId: 1,
          sellerKey: syntheticSellerKey,
          sellerName: "Synthetic Seller",
          quantity: 4,
          price: 3.25,
          shippingPrice: 0.99,
          customData: { images: [] },
        },
      ],
    };
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({
        errors: [],
        results: [{ totalResults: 1, results: [marketplaceProduct] }],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    const products = await client.listSellerInventory({
      sellerKey: syntheticSellerKey,
    });

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      productId: 123,
      productName: "Synthetic Card",
      rarityName: "",
      listings: [
        {
          productConditionId: 456,
          condition: "Lightly Played",
          price: 3.25,
        },
      ],
    });
    expect(requests[0]?.url).toBe(
      "https://mp-search-api.tcgplayer.com/v1/search/request",
    );
    expect(JSON.parse(String(requests[0]?.init?.body))).toMatchObject({
      from: 0,
      size: 24,
      listingSearch: {
        filters: {
          term: {
            sellerStatus: "Live",
            channelId: 0,
            sellerKey: [syntheticSellerKey],
          },
        },
      },
    });
  });

  it("builds condition-aware marketplace comparison searches", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({
        errors: [],
        results: [{ totalResults: 0, results: [] }],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await client.searchMarketplaceProducts({
      productIds: [123],
      conditions: ["Near Mint", "Lightly Played"],
      printings: ["Normal"],
      languages: ["English"],
    });

    expect(JSON.parse(String(requests[0]?.init?.body))).toMatchObject({
      filters: { term: { productId: [123] } },
      listingSearch: {
        filters: {
          term: {
            condition: ["Near Mint", "Lightly Played"],
            printing: ["Normal"],
            language: ["English"],
          },
        },
      },
    });
  });

  it("searches the catalog by product name and optional product line", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({
        errors: [],
        results: [
          {
            totalResults: 3,
            aggregations: {
              productLineName: [{ value: "Synthetic Game", count: 3 }],
              setName: [
                { value: "Synthetic Set", count: 1 },
                { value: "Synthetic Set B", count: 1 },
                { value: "Synthetic Set C", count: 1 },
              ],
            },
            results: [
              {
                productId: 124,
                productName: "Synthetic Cardboard",
                productLineName: "Synthetic Game",
                setName: "Synthetic Set B",
                rarityName: "Common",
                customAttributes: { number: "43" },
                marketPrice: 1.5,
                sellerListable: false,
              },
              {
                productId: 125,
                productName: "Unrelated Synthetic Item",
                productLineName: "Synthetic Game",
                setName: "Synthetic Set C",
                rarityName: "Common",
                customAttributes: { number: "44" },
                marketPrice: 1,
                sellerListable: false,
              },
              {
                productId: 123,
                productName: "Synthetic Card",
                productLineName: "Synthetic Game",
                setName: "Synthetic Set",
                rarityName: "Rare",
                customAttributes: { number: "42" },
                marketPrice: 3.5,
                sellerListable: true,
              },
            ],
          },
        ],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.searchCatalogProducts({
      query: "Synthetic Card",
      productLineName: "Synthetic Game",
      productTypeName: "Cards",
      setName: "Synthetic Set",
      limit: 12,
    });

    expect(result).toEqual({
      totalProducts: 3,
      productLines: [{ name: "Synthetic Game", count: 3 }],
      sets: [
        { name: "Synthetic Set", count: 1 },
        { name: "Synthetic Set B", count: 1 },
        { name: "Synthetic Set C", count: 1 },
      ],
      products: [
        {
          productId: 123,
          imageUrl:
            "https://product-images.tcgplayer.com/fit-in/200x279/123.jpg",
          productName: "Synthetic Card",
          productLineName: "Synthetic Game",
          setName: "Synthetic Set",
          rarityName: "Rare",
          cardNumber: "42",
          marketPrice: 3.5,
          sellerListable: true,
        },
        {
          productId: 124,
          imageUrl:
            "https://product-images.tcgplayer.com/fit-in/200x279/124.jpg",
          productName: "Synthetic Cardboard",
          productLineName: "Synthetic Game",
          setName: "Synthetic Set B",
          rarityName: "Common",
          cardNumber: "43",
          marketPrice: 1.5,
          sellerListable: false,
        },
        {
          productId: 125,
          imageUrl:
            "https://product-images.tcgplayer.com/fit-in/200x279/125.jpg",
          productName: "Unrelated Synthetic Item",
          productLineName: "Synthetic Game",
          setName: "Synthetic Set C",
          rarityName: "Common",
          cardNumber: "44",
          marketPrice: 1,
          sellerListable: false,
        },
      ],
    });
    expect(JSON.parse(String(requests[0]?.init?.body))).toMatchObject({
      algorithm: "sales_synonym_v2",
      from: 0,
      size: 12,
    });
    expect(JSON.parse(String(requests[0]?.init?.body)).filters).toStrictEqual({
      term: {
        productLineName: ["Synthetic Game"],
        productTypeName: ["Cards"],
        setName: ["Synthetic Set"],
      },
      range: {},
      match: {},
    });
    expect(requests[0]?.url).toBe(
      "https://mp-search-api.tcgplayer.com/v1/search/request?q=Synthetic+Card&isList=false",
    );
    expect(JSON.parse(String(requests[0]?.init?.body)).aggregations).toEqual([
      "productLineName",
      "setName",
    ]);
  });

  it("enriches catalog results with batched foil market prices", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({
        errors: [],
        results: [
          {
            totalResults: 2,
            aggregations: {
              productLineName: [{ value: "Synthetic Game", count: 2 }],
              setName: [
                { value: "Synthetic Set", count: 1 },
                { value: "Synthetic Set B", count: 1 },
              ],
            },
            results: [
              {
                productId: 123,
                productName: "Synthetic Card",
                productLineName: "Synthetic Game",
                setName: "Synthetic Set",
                rarityName: "Rare",
                customAttributes: { number: "42" },
                marketPrice: 3.5,
                sellerListable: true,
                listings: [
                  {
                    productConditionId: 789,
                    condition: "Near Mint",
                    printing: "Foil",
                    language: "English",
                  },
                ],
              },
              {
                productId: 124,
                productName: "Synthetic Cardboard",
                productLineName: "Synthetic Game",
                setName: "Synthetic Set B",
                rarityName: "Common",
                customAttributes: { number: "43" },
                marketPrice: 1.5,
                sellerListable: true,
                listings: [],
              },
            ],
          },
        ],
      }),
      jsonResponse([
        {
          skuId: 789,
          marketPrice: 8.25,
          lowestPrice: 7,
          highestPrice: 10,
          priceCount: 4,
          calculatedAt: "2026-08-04T00:00:00.000Z",
        },
      ]),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.searchCatalogProducts({
      query: "Synthetic Card",
      includeFoilMarketPrices: true,
    });

    expect(result.products).toEqual([
      expect.objectContaining({
        productId: 123,
        marketPrice: 3.5,
        foilMarketPrice: 8.25,
      }),
      expect.objectContaining({
        productId: 124,
        marketPrice: 1.5,
      }),
    ]);
    expect(result.products[1]).not.toHaveProperty("foilMarketPrice");
    expect(
      JSON.parse(String(requests[0]?.init?.body)).listingSearch.filters.term,
    ).toMatchObject({
      condition: ["Near Mint"],
      printing: ["Foil"],
      language: ["English"],
    });
    expect(requests[1]?.url).toBe(
      "https://mpgateway.tcgplayer.com/v1/pricepoints/marketprice/skus/search",
    );
    expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({
      skuIds: [789],
    });
  });

  it("reads a catalog product and maps its SKU conditions", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({
        productId: 123,
        productName: "Synthetic Card",
        productLineName: "Synthetic Game",
        setName: "Synthetic Set",
        rarityName: null,
        customAttributes: { number: "42" },
        marketPrice: 3.5,
        sellerListable: true,
        skus: [
          {
            sku: 456,
            condition: "Lightly Played",
            variant: "Holofoil",
            language: "English",
          },
        ],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.getCatalogProduct({ productId: 123 });

    expect(result.skus).toEqual([
      {
        productConditionId: 456,
        conditionId: 2,
        condition: "Lightly Played",
        printing: "Holofoil",
        language: "English",
      },
    ]);
    expect(result.imageUrl).toBe(
      "https://product-images.tcgplayer.com/fit-in/200x279/123.jpg",
    );
    expect(requests[0]?.url).toBe(
      "https://mp-search-api.tcgplayer.com/v2/product/123/details",
    );
    expect(requests[0]?.init?.method).toBe("GET");
    expect(requests[0]?.init?.body).toBeUndefined();
  });

  it("submits a price-only update using the observed Seller Portal form contract", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      new Response(null, { status: 204 }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.updateSellerPrices({
      updates: [
        {
          productId: 123,
          productName: "Synthetic Card",
          productConditionId: 456,
          conditionId: 1,
          channelId: 0,
          categoryName: "Synthetic Game",
          quantity: 7,
          price: 12.34,
          storePriceCustomId: null,
          reserveQuantity: 2,
        },
      ],
    });

    expect(result).toEqual({ submittedProductConditionIds: [456] });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      "https://store.tcgplayer.com/admin/pricing/updateinventory",
    );
    expect(requests[0]?.init?.method).toBe("POST");
    const headers = new Headers(requests[0]?.init?.headers);
    expect(headers.get("content-type")).toBe(
      "application/x-www-form-urlencoded; charset=UTF-8",
    );
    expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
    expect(headers.get("origin")).toBe("https://store.tcgplayer.com");
    const form = new URLSearchParams(String(requests[0]?.init?.body));
    expect(Object.fromEntries(form)).toEqual({
      "productQuantityPrices[0][ProductId]": "123",
      "productQuantityPrices[0][ProductName]": "Synthetic Card",
      "productQuantityPrices[0][AddToQuantity]": "0",
      "productQuantityPrices[0][ConditionQuantityPrices][0][ProductConditionId]":
        "456",
      "productQuantityPrices[0][ConditionQuantityPrices][0][ConditionId]": "1",
      "productQuantityPrices[0][ConditionQuantityPrices][0][ChannelId]": "0",
      "productQuantityPrices[0][ConditionQuantityPrices][0][CategoryName]":
        "Synthetic Game",
      "productQuantityPrices[0][ConditionQuantityPrices][0][Quantity]": "7",
      "productQuantityPrices[0][ConditionQuantityPrices][0][Price]": "12.34",
      "productQuantityPrices[0][ConditionQuantityPrices][0][ExistingQuantity]":
        "0",
      "productQuantityPrices[0][ConditionQuantityPrices][0][StorePriceCustomId]":
        "",
      "productQuantityPrices[0][ConditionQuantityPrices][0][ReserveQuantity]":
        "2",
      type: "Pricing",
      isStaged: "false",
    });
  });

  it("accepts TCGplayer condition ids outside the base condition scale", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      new Response(null, { status: 204 }),
    ]);
    const client = clientWith(fetchImplementation);

    await client.updateSellerPrices({
      updates: [
        {
          productId: 668200,
          productName: "Synthetic Variant Card",
          productConditionId: 9044848,
          conditionId: 607,
          channelId: 0,
          categoryName: "Synthetic Game",
          quantity: 3,
          price: 15.99,
          storePriceCustomId: null,
          reserveQuantity: 0,
        },
      ],
    });

    const form = new URLSearchParams(String(requests[0]?.init?.body));
    expect(
      form.get(
        "productQuantityPrices[0][ConditionQuantityPrices][0][ConditionId]",
      ),
    ).toBe("607");
  });

  it("adds live inventory with a relative quantity and initial price", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      new Response(null, { status: 204 }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.addSellerInventory({
      additions: [
        {
          productId: 123,
          productName: "Synthetic Card",
          productConditionId: 456,
          conditionId: 2,
          channelId: 0,
          categoryName: "Synthetic Game",
          currentQuantity: 3,
          addQuantity: 2,
          price: 4.25,
          storePriceCustomId: null,
          reserveQuantity: 0,
        },
      ],
    });

    expect(result).toEqual({ submittedProductConditionIds: [456] });
    const form = new URLSearchParams(String(requests[0]?.init?.body));
    expect(form.get("productQuantityPrices[0][AddToQuantity]")).toBe("2");
    expect(
      form.get(
        "productQuantityPrices[0][ConditionQuantityPrices][0][Quantity]",
      ),
    ).toBe("5");
    expect(
      form.get("productQuantityPrices[0][ConditionQuantityPrices][0][Price]"),
    ).toBe("4.25");
  });

  it("rejects an inventory addition without a positive quantity", async () => {
    const { fetchImplementation, requests } = fetchQueue([]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.addSellerInventory({
        additions: [
          {
            productId: 123,
            productName: "Synthetic Card",
            productConditionId: 456,
            conditionId: 2,
            channelId: 0,
            categoryName: "Synthetic Game",
            currentQuantity: 3,
            addQuantity: 0,
            price: 4.25,
            storePriceCustomId: null,
            reserveQuantity: 0,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(requests).toHaveLength(0);
  });

  it("clears an exact live inventory SKU while preserving its price identity", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      new Response(null, { status: 204 }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.removeSellerInventory({
      removals: [
        {
          productId: 123,
          productName: "Synthetic Card",
          productConditionId: 456,
          conditionId: 2,
          channelId: 0,
          categoryName: "Synthetic Game",
          currentQuantity: 3,
          price: 4.25,
          storePriceCustomId: null,
          reserveQuantity: 0,
        },
      ],
    });

    expect(result).toEqual({ submittedProductConditionIds: [456] });
    const form = new URLSearchParams(String(requests[0]?.init?.body));
    expect(form.get("productQuantityPrices[0][AddToQuantity]")).toBe("0");
    expect(
      form.get(
        "productQuantityPrices[0][ConditionQuantityPrices][0][Quantity]",
      ),
    ).toBe("0");
    expect(
      form.get("productQuantityPrices[0][ConditionQuantityPrices][0][Price]"),
    ).toBe("4.25");
  });

  it("rejects an inventory removal without live unreserved quantity", async () => {
    const { fetchImplementation, requests } = fetchQueue([]);
    const client = clientWith(fetchImplementation);
    const removal = {
      productId: 123,
      productName: "Synthetic Card",
      productConditionId: 456,
      conditionId: 2,
      channelId: 0,
      categoryName: "Synthetic Game",
      currentQuantity: 0,
      price: 4.25,
      storePriceCustomId: null,
      reserveQuantity: 0,
    };

    await expect(
      client.removeSellerInventory({ removals: [removal] }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(
      client.removeSellerInventory({
        removals: [
          {
            ...removal,
            currentQuantity: 3,
            reserveQuantity: 1,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(requests).toHaveLength(0);
  });

  it("rejects unsafe price updates before sending a request", async () => {
    const { fetchImplementation, requests } = fetchQueue([]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.updateSellerPrices({
        updates: [
          {
            productId: 123,
            productName: "Synthetic Card",
            productConditionId: 456,
            conditionId: 1,
            channelId: 0,
            categoryName: "Synthetic Game",
            quantity: 7,
            price: 12.345,
            storePriceCustomId: null,
            reserveQuantity: 2,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(requests).toHaveLength(0);
  });

  it("accepts ordinary two-decimal prices despite floating-point representation", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      new Response(null, { status: 204 }),
    ]);
    const client = clientWith(fetchImplementation);

    await client.updateSellerPrices({
      updates: [
        {
          productId: 123,
          productName: "Synthetic Card",
          productConditionId: 456,
          conditionId: 1,
          channelId: 0,
          categoryName: "Synthetic Game",
          quantity: 7,
          price: 1.15,
          storePriceCustomId: null,
          reserveQuantity: 2,
        },
      ],
    });

    const form = new URLSearchParams(String(requests[0]?.init?.body));
    expect(
      form.get("productQuantityPrices[0][ConditionQuantityPrices][0][Price]"),
    ).toBe("1.15");
  });

  it("does not retry an ambiguous Seller Portal price mutation", async () => {
    const requests: CapturedRequest[] = [];
    const fetchImplementation: typeof globalThis.fetch = async (
      input,
      init,
    ) => {
      requests.push({ url: String(input), init });
      throw new Error("synthetic disconnect");
    };
    const client = clientWith(fetchImplementation, {
      retry: { maxRetries: 5, baseDelayMs: 0, maxDelayMs: 0 },
    });

    await expect(
      client.updateSellerPrices({
        updates: [
          {
            productId: 123,
            productName: "Synthetic Card",
            productConditionId: 456,
            conditionId: 1,
            channelId: 0,
            categoryName: "Synthetic Game",
            quantity: 7,
            price: 12.34,
            storePriceCustomId: null,
            reserveQuantity: 2,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "AMBIGUOUS_RESULT" });
    expect(requests).toHaveLength(1);
  });

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
    });
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      orderNumbers: [syntheticOrderNumber],
      timezoneOffset: 360,
    });
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
});
