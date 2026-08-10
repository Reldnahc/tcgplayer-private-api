import type {
  SellerOrderDetail,
  SellerOrderSearchSummary,
} from "../src/index.js";

export const syntheticOrderNumber = "00000000000000000";
export const syntheticSellerKey = "seller_test_123";

export const syntheticSummary: SellerOrderSearchSummary = {
  orderNumber: syntheticOrderNumber,
  orderDate: "2026-01-02T03:04:05.000Z",
  orderChannel: "Marketplace",
  orderStatus: "ReadyToShip",
  orderStatusCode: "ReadyToShip",
  buyerName: "Sample Buyer",
  shippingType: "Standard",
  productAmount: 12.5,
  shippingAmount: 1.25,
  totalAmount: 13.75,
  buyerPaid: true,
  orderFulfillment: "Seller",
};

export const syntheticOrder: SellerOrderDetail = {
  createdAt: "2026-01-02T03:04:05.000Z",
  status: "ReadyToShip",
  statusCode: "ReadyToShip",
  orderChannel: "Marketplace",
  orderFulfillment: "Seller",
  orderNumber: syntheticOrderNumber,
  sellerName: "Sample Seller",
  buyerName: "Sample Buyer",
  paymentType: "Marketplace",
  pickupStatus: "NotApplicable",
  shippingType: "Standard",
  estimatedDeliveryDate: "2026-01-09T00:00:00.000Z",
  transaction: {
    productAmount: 12.5,
    shippingAmount: 1.25,
    grossAmount: 13.75,
    feeAmount: 1.5,
    netAmount: 12.25,
    directFeeAmount: 0,
    taxes: [{ code: "SyntheticTax", amount: 0 }],
  },
  shippingAddress: {
    recipientName: "Sample Buyer",
    addressOne: "123 Example Street",
    addressTwo: "Unit 4",
    city: "Example City",
    territory: "IL",
    country: "US",
    postalCode: "00000",
  },
  products: [
    {
      name: "Example Card",
      unitPrice: 12.5,
      extendedPrice: 12.5,
      quantity: 1,
      url: "https://example.invalid/products/example-card",
      productId: "100000",
      skuId: "200000",
      listoId: 300000,
    },
  ],
  refunds: [],
  refundStatus: "None",
  trackingNumbers: [
    {
      createdAt: "2026-01-02T04:05:06.000Z",
      carrier: "Synthetic Carrier",
      trackingNumber: "SYNTHETIC000000000",
      status: "InTransit",
    },
  ],
  refundCapabilities: { full: true, partial: true },
  allowedActions: ["View", "FullRefund", "PartialRefund"],
};

export const syntheticPdf = new TextEncoder().encode(
  "%PDF-1.7\n% synthetic fixture\n%%EOF\n",
);

export const syntheticPullSheet =
  "Product Line,Product Name,Condition,Number,Set,Rarity,Quantity,Main Photo URL,Set Release Date,SkuId,Order Quantity\r\n" +
  `Example Game,"Example, Card",Near Mint,1,Example Set,Rare,1,https://example.invalid/card,2026-01-01,200000,${syntheticOrderNumber}:1\r\n` +
  `Orders Contained in Pull Sheet:,${syntheticOrderNumber}\r\n`;
