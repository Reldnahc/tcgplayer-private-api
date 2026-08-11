import { invalidArgument } from "./errors.js";
import { SellerAccountClient } from "./client/account.js";
import { SellerInventoryClient } from "./client/inventory.js";
import { SellerMarketplaceClient } from "./client/marketplace.js";
import { SellerOrderClient } from "./client/orders.js";
import { SellerApiTransport } from "./transport.js";
import type {
  AddOrderTrackingInput,
  AddSellerInventoryInput,
  AddSellerInventoryResult,
  AuthenticatedSeller,
  CatalogProductDetails,
  ConfirmedSellerOrder,
  ConfirmSellerOrderInput,
  DetectCarrierResult,
  ExportPackingSlipsInput,
  ExportPullSheetInput,
  GetCatalogProductInput,
  GetPackingSlipInput,
  GetSellerFeedbackAggregationInput,
  GetSellerMessageThreadInput,
  GetSellerPaymentExperienceInput,
  GetSellerPayoutInput,
  GetSellerUnpaidBalanceInput,
  GetSkuMarketPricesInput,
  GetSkuMarketPricesResult,
  ListLegacySellerPaymentsInput,
  ListLegacySellerPaymentsResult,
  ListLegacyUpcomingSellerPaymentsResult,
  ListSellerFeedbackInput,
  ListSellerFeedbackResult,
  ListSellerInventoryInput,
  ListSellerInventoryOptions,
  ListSellerMessageThreadsInput,
  ListSellerMessageThreadsResult,
  ListSellerPayoutsInput,
  ListSellerPayoutsResult,
  MarketplaceProduct,
  MarkOrdersShippedInput,
  MarkOrdersShippedResult,
  MarkSellerMessageThreadReadInput,
  OrderFulfillmentMutationResult,
  OrderRefundMutationResult,
  PackingSlipDocument,
  PullSheetDocument,
  RefundOrderFullInput,
  RefundOrderPartialInput,
  RemoveSellerInventoryInput,
  RemoveSellerInventoryResult,
  ReplyToSellerMessageThreadInput,
  RequestOptions,
  SearchCatalogProductsInput,
  SearchCatalogProductsResult,
  SearchMarketplaceProductListingsInput,
  SearchMarketplaceProductListingsResult,
  SearchMarketplaceProductsInput,
  SearchMarketplaceProductsResult,
  SearchSellerOrdersInput,
  SearchSellerOrdersResult,
  SellerFeedbackAggregation,
  SellerMessageThread,
  SellerOrderDetail,
  SellerOrderRefundOptions,
  SellerPaymentExperience,
  SellerPayoutDetail,
  SellerUnpaidBalance,
  ShipOrderWithoutTrackingInput,
  TcgplayerSellerClientOptions,
  UpdateSellerPricesInput,
  UpdateSellerPricesResult,
} from "./types.js";

export class TcgplayerSellerClient {
  private readonly account: SellerAccountClient;
  private readonly orders: SellerOrderClient;
  private readonly marketplace: SellerMarketplaceClient;
  private readonly inventory: SellerInventoryClient;

  constructor(options: TcgplayerSellerClientOptions) {
    if (typeof options !== "object" || options === null) {
      throw invalidArgument("Client options are required.");
    }
    const transport = new SellerApiTransport(options);
    this.account = new SellerAccountClient(transport);
    this.orders = new SellerOrderClient(transport);
    this.marketplace = new SellerMarketplaceClient(transport);
    this.inventory = new SellerInventoryClient(transport);
  }

  getAuthenticatedSeller(
    options?: RequestOptions,
  ): Promise<AuthenticatedSeller> {
    return this.account.getAuthenticatedSeller(options);
  }

  getSellerPaymentExperience(
    input: GetSellerPaymentExperienceInput,
    options?: RequestOptions,
  ): Promise<SellerPaymentExperience> {
    return this.account.getSellerPaymentExperience(input, options);
  }

  listLegacySellerPayments(
    input: ListLegacySellerPaymentsInput = {},
    options?: RequestOptions,
  ): Promise<ListLegacySellerPaymentsResult> {
    return this.account.listLegacySellerPayments(input, options);
  }

  listLegacyUpcomingSellerPayments(
    options?: RequestOptions,
  ): Promise<ListLegacyUpcomingSellerPaymentsResult> {
    return this.account.listLegacyUpcomingSellerPayments(options);
  }

  listSellerFeedback(
    input: ListSellerFeedbackInput,
    options?: RequestOptions,
  ): Promise<ListSellerFeedbackResult> {
    return this.account.listSellerFeedback(input, options);
  }

  getSellerFeedbackAggregation(
    input: GetSellerFeedbackAggregationInput,
    options?: RequestOptions,
  ): Promise<SellerFeedbackAggregation> {
    return this.account.getSellerFeedbackAggregation(input, options);
  }

  listSellerMessageThreads(
    input: ListSellerMessageThreadsInput,
    options?: RequestOptions,
  ): Promise<ListSellerMessageThreadsResult> {
    return this.account.listSellerMessageThreads(input, options);
  }

  getSellerMessageThread(
    input: GetSellerMessageThreadInput,
    options?: RequestOptions,
  ): Promise<SellerMessageThread> {
    return this.account.getSellerMessageThread(input, options);
  }

  getSellerUnreadMessageCount(options?: RequestOptions): Promise<number> {
    return this.account.getSellerUnreadMessageCount(options);
  }

  markSellerMessageThreadRead(
    input: MarkSellerMessageThreadReadInput,
    options?: RequestOptions,
  ): Promise<void> {
    return this.account.markSellerMessageThreadRead(input, options);
  }

  replyToSellerMessageThread(
    input: ReplyToSellerMessageThreadInput,
    options?: RequestOptions,
  ): Promise<void> {
    return this.account.replyToSellerMessageThread(input, options);
  }

  listSellerPayouts(
    input: ListSellerPayoutsInput,
    options?: RequestOptions,
  ): Promise<ListSellerPayoutsResult> {
    return this.account.listSellerPayouts(input, options);
  }

  getSellerPayout(
    input: GetSellerPayoutInput,
    options?: RequestOptions,
  ): Promise<SellerPayoutDetail> {
    return this.account.getSellerPayout(input, options);
  }

  getSellerUnpaidBalance(
    input: GetSellerUnpaidBalanceInput,
    options?: RequestOptions,
  ): Promise<SellerUnpaidBalance> {
    return this.account.getSellerUnpaidBalance(input, options);
  }

  searchOrders(
    input: SearchSellerOrdersInput,
    options?: RequestOptions,
  ): Promise<SearchSellerOrdersResult> {
    return this.orders.searchOrders(input, options);
  }

  getOrder(
    orderNumber: string,
    options?: RequestOptions,
  ): Promise<SellerOrderDetail> {
    return this.orders.getOrder(orderNumber, options);
  }

  confirmOrder(
    input: ConfirmSellerOrderInput,
    options?: RequestOptions,
  ): Promise<ConfirmedSellerOrder> {
    return this.orders.confirmOrder(input, options);
  }

  exportPackingSlips(
    input: ExportPackingSlipsInput,
    options?: RequestOptions,
  ): Promise<PackingSlipDocument> {
    return this.orders.exportPackingSlips(input, options);
  }

  getPackingSlip(
    input: GetPackingSlipInput,
    options?: RequestOptions,
  ): Promise<PackingSlipDocument> {
    return this.orders.getPackingSlip(input, options);
  }

  detectCarrier(
    trackingNumber: string,
    options?: RequestOptions,
  ): Promise<DetectCarrierResult> {
    return this.orders.detectCarrier(trackingNumber, options);
  }

  exportPullSheet(
    input: ExportPullSheetInput,
    options?: RequestOptions,
  ): Promise<PullSheetDocument> {
    return this.orders.exportPullSheet(input, options);
  }

  addOrderTracking(
    input: AddOrderTrackingInput,
    options?: RequestOptions,
  ): Promise<OrderFulfillmentMutationResult> {
    return this.orders.addOrderTracking(input, options);
  }

  shipOrderWithoutTracking(
    input: ShipOrderWithoutTrackingInput,
    options?: RequestOptions,
  ): Promise<OrderFulfillmentMutationResult> {
    return this.orders.shipOrderWithoutTracking(input, options);
  }

  markOrdersShipped(
    input: MarkOrdersShippedInput,
    options?: RequestOptions,
  ): Promise<MarkOrdersShippedResult> {
    return this.orders.markOrdersShipped(input, options);
  }

  getOrderRefundOptions(
    options?: RequestOptions,
  ): Promise<SellerOrderRefundOptions> {
    return this.orders.getOrderRefundOptions(options);
  }

  refundOrderFull(
    input: RefundOrderFullInput,
    options?: RequestOptions,
  ): Promise<OrderRefundMutationResult> {
    return this.orders.refundOrderFull(input, options);
  }

  refundOrderPartial(
    input: RefundOrderPartialInput,
    options?: RequestOptions,
  ): Promise<OrderRefundMutationResult> {
    return this.orders.refundOrderPartial(input, options);
  }

  searchMarketplaceProducts(
    input: SearchMarketplaceProductsInput,
    options?: RequestOptions,
  ): Promise<SearchMarketplaceProductsResult> {
    return this.marketplace.searchMarketplaceProducts(input, options);
  }

  searchMarketplaceProductListings(
    input: SearchMarketplaceProductListingsInput,
    options?: RequestOptions,
  ): Promise<SearchMarketplaceProductListingsResult> {
    return this.marketplace.searchMarketplaceProductListings(input, options);
  }

  searchCatalogProducts(
    input: SearchCatalogProductsInput,
    options?: RequestOptions,
  ): Promise<SearchCatalogProductsResult> {
    return this.marketplace.searchCatalogProducts(input, options);
  }

  getCatalogProduct(
    input: GetCatalogProductInput,
    options?: RequestOptions,
  ): Promise<CatalogProductDetails> {
    return this.marketplace.getCatalogProduct(input, options);
  }

  getSkuMarketPrices(
    input: GetSkuMarketPricesInput,
    options?: RequestOptions,
  ): Promise<GetSkuMarketPricesResult> {
    return this.marketplace.getSkuMarketPrices(input, options);
  }

  listSellerInventory(
    input: ListSellerInventoryInput,
    options?: ListSellerInventoryOptions,
  ): Promise<readonly MarketplaceProduct[]> {
    return this.marketplace.listSellerInventory(input, options);
  }

  updateSellerPrices(
    input: UpdateSellerPricesInput,
    options?: RequestOptions,
  ): Promise<UpdateSellerPricesResult> {
    return this.inventory.updateSellerPrices(input, options);
  }

  addSellerInventory(
    input: AddSellerInventoryInput,
    options?: RequestOptions,
  ): Promise<AddSellerInventoryResult> {
    return this.inventory.addSellerInventory(input, options);
  }

  removeSellerInventory(
    input: RemoveSellerInventoryInput,
    options?: RequestOptions,
  ): Promise<RemoveSellerInventoryResult> {
    return this.inventory.removeSellerInventory(input, options);
  }
}

export function createTcgplayerSellerClient(
  options: TcgplayerSellerClientOptions,
): TcgplayerSellerClient {
  return new TcgplayerSellerClient(options);
}
