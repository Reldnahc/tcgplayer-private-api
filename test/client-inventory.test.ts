import { describe, expect, it, vi } from "vitest";
import {
  type CapturedRequest,
  clientWith,
  fetchQueue,
  jsonResponse,
  syntheticSellerKey,
} from "./client-fixtures.js";

describe("TcgplayerSellerClient catalog and inventory", () => {
  it("reads and validates live seller inventory from marketplace search", async () => {
    const marketplaceProduct = {
      productId: 123,
      productName: "Synthetic Card",
      productLineName: "Synthetic Game",
      setName: "Synthetic Set",
      rarityName: null,
      customAttributes: {
        color: ["Blue"],
        cardType: ["Creature"],
        fullType: "Creature - Synthetic",
        convertedCost: "2",
        power: "2",
        toughness: "3",
        numericField: 4,
        booleanField: true,
        ignoredObject: { unsafe: "shape" },
      },
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
          directListing: false,
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
    const onProgress = vi.fn();

    const products = await client.listSellerInventory(
      { sellerKey: syntheticSellerKey },
      { onProgress },
    );

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      productId: 123,
      productName: "Synthetic Card",
      rarityName: "",
      colors: ["Blue"],
      cardTypes: ["Creature"],
      attributes: {
        color: ["Blue"],
        cardType: ["Creature"],
        fullType: ["Creature - Synthetic"],
        convertedCost: ["2"],
        power: ["2"],
        toughness: ["3"],
        numericField: ["4"],
        booleanField: ["true"],
      },
      listings: [
        {
          productConditionId: 456,
          condition: "Lightly Played",
          price: 3.25,
          directListing: false,
        },
      ],
    });
    expect(requests[0]?.url).toBe(
      "https://mp-search-api.tcgplayer.com/v1/search/request",
    );
    expect(onProgress).toHaveBeenCalledWith({
      channelId: 0,
      pagesLoaded: 1,
      productsLoaded: 1,
      totalProducts: 1,
    });
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
      context: {
        cart: {},
        shippingCountry: "US",
        userProfile: { productLineAffinity: "", priceAffinity: 0 },
      },
    });
  });

  it("reads an explicitly sorted page of exact product listings", async () => {
    const marketplaceListing = {
      listingId: 88,
      productId: 123,
      productConditionId: 456,
      conditionId: 2,
      condition: "Lightly Played",
      channelId: 0,
      printing: "Normal",
      language: "English",
      languageId: 1,
      sellerKey: "comparison_seller_test",
      sellerName: "Synthetic Comparison Seller",
      quantity: 2,
      price: 0.87,
      shippingPrice: 1.49,
      directListing: false,
      directInventory: 0,
      directProduct: true,
      directSeller: false,
      listingType: "standard",
      sellerPrograms: ["Pro"],
      customData: { images: [] },
    };
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({
        errors: [],
        results: [{ totalResults: 113, results: [marketplaceListing] }],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.searchMarketplaceProductListings({
      productId: 123,
      conditions: ["Near Mint", "Lightly Played"],
      printings: ["Normal"],
      languages: ["English"],
      channelIds: [0, 1],
      listingTypes: ["standard"],
      offset: 24,
      limit: 24,
      sort: "price",
    });

    expect(result).toMatchObject({
      productId: 123,
      totalListings: 113,
      listings: [
        {
          price: 0.87,
          shippingPrice: 1.49,
          listingType: "standard",
        },
      ],
    });
    expect(requests[0]?.url).toBe(
      "https://mp-search-api.tcgplayer.com/v1/product/123/listings",
    );
    expect(JSON.parse(String(requests[0]?.init?.body))).toMatchObject({
      from: 24,
      size: 24,
      filters: {
        term: {
          sellerStatus: "Live",
          channelId: [0, 1],
          condition: ["Near Mint", "Lightly Played"],
          printing: ["Normal"],
          language: ["English"],
          listingType: ["standard"],
        },
      },
      context: { shippingCountry: "US" },
      sort: { field: "price", order: "asc" },
    });
  });

  it("rejects product-listing pages containing another product", async () => {
    const { fetchImplementation } = fetchQueue([
      jsonResponse({
        errors: [],
        results: [
          {
            totalResults: 1,
            results: [
              {
                listingId: 88,
                productId: 999,
                productConditionId: 456,
                conditionId: 2,
                condition: "Lightly Played",
                channelId: 0,
                printing: "Normal",
                language: "English",
                languageId: 1,
                sellerKey: "comparison_seller_test",
                sellerName: "Synthetic Comparison Seller",
                quantity: 2,
                price: 0.87,
                shippingPrice: 1.49,
                customData: {},
              },
            ],
          },
        ],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.searchMarketplaceProductListings({ productId: 123 }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("preserves validated buyer-facing Direct availability evidence", async () => {
    const directListing = {
      listingId: 88,
      productId: 123,
      productConditionId: 456,
      conditionId: 2,
      condition: "Lightly Played",
      channelId: 1,
      printing: "Normal",
      language: "English",
      languageId: 1,
      sellerKey: "direct_seller_test",
      sellerName: "Synthetic Direct Seller",
      quantity: 2,
      price: 1.67,
      shippingPrice: 3.99,
      directListing: true,
      directInventory: 12,
      directProduct: true,
      directSeller: true,
      listingType: "standard",
      sellerPrograms: ["Direct", "DirectViewable"],
      customData: { images: [] },
    };
    const { fetchImplementation } = fetchQueue([
      jsonResponse({
        errors: [],
        results: [
          {
            totalResults: 1,
            results: [
              {
                productId: 123,
                productName: "Synthetic Card",
                productLineName: "Synthetic Game",
                setName: "Synthetic Set",
                rarityName: "Rare",
                marketPrice: 3.5,
                totalListings: 1,
                listings: [directListing],
              },
            ],
          },
        ],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.searchMarketplaceProducts({
      productIds: [123],
      channelId: 1,
    });

    expect(result.products[0]?.listings[0]).toMatchObject({
      directListing: true,
      directInventory: 12,
      directProduct: true,
      directSeller: true,
      listingType: "standard",
      sellerPrograms: ["Direct", "DirectViewable"],
    });
  });

  it("rejects malformed Direct availability evidence", async () => {
    const { fetchImplementation } = fetchQueue([
      jsonResponse({
        errors: [],
        results: [
          {
            totalResults: 1,
            results: [
              {
                productId: 123,
                productName: "Synthetic Card",
                productLineName: "Synthetic Game",
                setName: "Synthetic Set",
                rarityName: "Rare",
                marketPrice: 3.5,
                totalListings: 1,
                listings: [
                  {
                    listingId: 88,
                    productId: 123,
                    productConditionId: 456,
                    conditionId: 2,
                    condition: "Lightly Played",
                    channelId: 1,
                    printing: "Normal",
                    language: "English",
                    languageId: 1,
                    sellerKey: "direct_seller_test",
                    sellerName: "Synthetic Direct Seller",
                    quantity: 2,
                    price: 1.67,
                    shippingPrice: 3.99,
                    directListing: true,
                    directInventory: 1.5,
                    directProduct: true,
                    directSeller: true,
                    listingType: "standard",
                    sellerPrograms: ["Direct", "DirectViewable"],
                    customData: { images: [] },
                  },
                ],
              },
            ],
          },
        ],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.searchMarketplaceProducts({ productIds: [123], channelId: 1 }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
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

  it("reads exact-SKU market prices in one validated batch", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse([
        { skuId: 457, marketPrice: 18.25 },
        { skuId: 456, marketPrice: 0.82 },
      ]),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.getSkuMarketPrices({
      productConditionIds: [456, 457, 458],
    });

    expect(result).toEqual({
      prices: [
        { productConditionId: 456, marketPrice: 0.82 },
        { productConditionId: 457, marketPrice: 18.25 },
      ],
    });
    expect(requests[0]?.url).toBe(
      "https://mpgateway.tcgplayer.com/v1/pricepoints/marketprice/skus/search",
    );
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      skuIds: [456, 457, 458],
    });
  });

  it("rejects an unexpected SKU in a market-price response", async () => {
    const { fetchImplementation } = fetchQueue([
      jsonResponse([{ skuId: 999, marketPrice: 4.5 }]),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.getSkuMarketPrices({ productConditionIds: [456] }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects duplicate exact-SKU market-price inputs", async () => {
    const { fetchImplementation, requests } = fetchQueue([]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.getSkuMarketPrices({ productConditionIds: [456, 456] }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(requests).toHaveLength(0);
  });

  it("reads a catalog product and maps its SKU conditions", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({
        productId: 123,
        productName: "Synthetic Card",
        productLineName: "Synthetic Game",
        setName: "Synthetic Set",
        rarityName: null,
        customAttributes: { number: "42", color: ["Blue", "Red"] },
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
    expect(result.colors).toEqual(["Blue", "Red"]);
    expect(requests[0]?.url).toBe(
      "https://mp-search-api.tcgplayer.com/v2/product/123/details",
    );
    expect(requests[0]?.init?.method).toBe("GET");
    expect(requests[0]?.init?.body).toBeUndefined();
  });

  it("omits empty provider color and card-type metadata", async () => {
    const { fetchImplementation } = fetchQueue([
      jsonResponse({
        errors: [],
        results: [
          {
            totalResults: 1,
            results: [
              {
                productId: 123,
                productName: "Synthetic Card",
                productLineName: "Synthetic Game",
                setName: "Synthetic Set",
                rarityName: "Rare",
                customAttributes: { color: [], cardType: [] },
                marketPrice: 3.5,
                lowestPrice: 3,
                lowestPriceWithShipping: 4.49,
                totalListings: 1,
                listings: [],
              },
            ],
          },
        ],
      }),
    ]);

    const result = await clientWith(
      fetchImplementation,
    ).searchMarketplaceProducts({
      productIds: [123],
    });

    expect(result.products[0]).not.toHaveProperty("colors");
    expect(result.products[0]).not.toHaveProperty("cardTypes");
  });

  it("rejects malformed provider card-type metadata", async () => {
    const { fetchImplementation } = fetchQueue([
      jsonResponse({
        errors: [],
        results: [
          {
            totalResults: 1,
            results: [
              {
                productId: 123,
                productName: "Synthetic Land",
                productLineName: "Synthetic Game",
                setName: "Synthetic Set",
                rarityName: "Land",
                customAttributes: { color: ["Colorless"], cardType: "Land" },
                marketPrice: 0.25,
                totalListings: 1,
                listings: [],
              },
            ],
          },
        ],
      }),
    ]);

    await expect(
      clientWith(fetchImplementation).searchMarketplaceProducts({
        productIds: [123],
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
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
});
