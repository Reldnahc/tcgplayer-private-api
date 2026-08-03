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
    },
  ],
  refundStatus: "None",
  trackingNumbers: [],
  allowedActions: ["View"],
};

export const syntheticPdf = new TextEncoder().encode(
  "%PDF-1.7\n% synthetic fixture\n%%EOF\n",
);
