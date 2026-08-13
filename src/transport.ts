import { isTcgplayerApiError, TcgplayerApiError } from "./errors.js";
import {
  errorOptions,
  SellerHttpTransport,
  type BinaryResponse,
  type RawResponse,
  type RequestSpec,
  type TransportOptions,
} from "./transport/http.js";

export interface MoneyMovementJsonResponse {
  readonly value: unknown;
  readonly totalCount?: number;
}

export class SellerApiTransport {
  private readonly http: SellerHttpTransport;

  constructor(options: TransportOptions) {
    this.http = new SellerHttpTransport(options);
  }

  async json(
    method: "GET" | "POST",
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const result = await this.http.request({
      method,
      path,
      ...(body === undefined ? {} : { body }),
      accept: "application/json",
      retryMode: "safe",
      ...(signal === undefined ? {} : { signal }),
    });

    const { response, bytes } = result;
    const type = result.contentType;
    if (type === "text/html") {
      throw this.http.authenticationRequired(
        "TCGplayer returned an HTML page instead of seller API data. Refresh the authorized session.",
        errorOptions(response),
        result.sessionRevision,
      );
    }
    if (type !== "application/json" && !type.endsWith("+json")) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned an unexpected content type for JSON data.",
        errorOptions(response),
      );
    }

    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned malformed JSON.",
        { ...errorOptions(response), cause: error },
      );
    }
  }

  async marketplaceJson(
    method: "GET" | "POST",
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const result = await this.http.request({
      method,
      path,
      ...(body === undefined ? {} : { body }),
      origin: "marketplace",
      accept: "application/json",
      retryMode: "safe",
      ...(signal === undefined ? {} : { signal }),
    });

    const { response, bytes } = result;
    if (
      result.contentType !== "application/json" &&
      !result.contentType.endsWith("+json")
    ) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned an unexpected marketplace search response.",
        errorOptions(response),
      );
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      ) as unknown;
    } catch (error) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned malformed marketplace search JSON.",
        { ...errorOptions(response), cause: error },
      );
    }
  }

  async marketplaceGatewayJson(
    method: "GET" | "POST",
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const result = await this.http.request({
      method,
      path,
      ...(body === undefined ? {} : { body }),
      origin: "marketplace-gateway",
      accept: "application/json",
      retryMode: "safe",
      ...(signal === undefined ? {} : { signal }),
    });

    const { response, bytes } = result;
    if (
      result.contentType !== "application/json" &&
      !result.contentType.endsWith("+json")
    ) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned an unexpected marketplace price response.",
        errorOptions(response),
      );
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      ) as unknown;
    } catch (error) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned malformed marketplace price JSON.",
        { ...errorOptions(response), cause: error },
      );
    }
  }

  async moneyMovementJson(
    path: string,
    signal?: AbortSignal,
  ): Promise<MoneyMovementJsonResponse> {
    const result = await this.http.request({
      method: "GET",
      path,
      origin: "money-movement",
      accept: "application/json",
      retryMode: "safe",
      ...(signal === undefined ? {} : { signal }),
    });
    const { response, bytes } = result;
    if (result.contentType === "text/html") {
      throw this.http.authenticationRequired(
        "TCGplayer returned an HTML page instead of seller payout data. Refresh the authorized session.",
        errorOptions(response),
        result.sessionRevision,
      );
    }
    if (
      result.contentType !== "application/json" &&
      !result.contentType.endsWith("+json")
    ) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned an unexpected payout response.",
        errorOptions(response),
      );
    }
    let value: unknown;
    try {
      value = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      ) as unknown;
    } catch (error) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned malformed payout JSON.",
        { ...errorOptions(response), cause: error },
      );
    }
    const totalHeader = response.headers.get("x-total-count");
    if (totalHeader === null) return { value };
    if (!/^\d+$/u.test(totalHeader)) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned an invalid payout total.",
        errorOptions(response),
      );
    }
    const totalCount = Number(totalHeader);
    if (!Number.isSafeInteger(totalCount)) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned an invalid payout total.",
        errorOptions(response),
      );
    }
    return { value, totalCount };
  }

  async sellerPortalApiJson(
    path: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const result = await this.http.request({
      method: "GET",
      path,
      origin: "seller-portal-api",
      accept: "application/json",
      retryMode: "safe",
      ...(signal === undefined ? {} : { signal }),
    });
    const { response, bytes } = result;
    if (result.contentType === "text/html") {
      throw this.http.authenticationRequired(
        "TCGplayer returned an HTML page instead of account capability data. Refresh the authorized session.",
        errorOptions(response),
        result.sessionRevision,
      );
    }
    if (
      result.contentType !== "application/json" &&
      !result.contentType.endsWith("+json")
    ) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned an unexpected account capability response.",
        errorOptions(response),
      );
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      ) as unknown;
    } catch (error) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned malformed account capability JSON.",
        { ...errorOptions(response), cause: error },
      );
    }
  }

  async sellerPortalMessagesJson(
    path: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    return this.authenticatedJson(
      path,
      "seller-portal",
      "seller message",
      signal,
    );
  }

  async sellerPortalMessagesIdempotentCommand(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.sellerPortalMessagesCommand(path, body, "safe", signal);
  }

  async sellerPortalMessagesMutationCommand(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.sellerPortalMessagesCommand(path, body, "never", signal);
  }

  private async sellerPortalMessagesCommand(
    path: string,
    body: unknown,
    retryMode: RequestSpec["retryMode"],
    signal?: AbortSignal,
  ): Promise<void> {
    const result = await this.http.request({
      method: "POST",
      path,
      ...(body === undefined ? {} : { body }),
      origin: "seller-portal",
      accept: "application/json",
      retryMode,
      discardResponseBody: true,
      ...(signal === undefined ? {} : { signal }),
    });
    if (result.contentType === "text/html") {
      throw this.http.authenticationRequired(
        "TCGplayer returned an HTML page for a seller message change. Refresh the authorized session and reconcile the conversation.",
        errorOptions(result.response),
        result.sessionRevision,
      );
    }
  }

  async messagesApiJson(path: string, signal?: AbortSignal): Promise<unknown> {
    return this.authenticatedJson(
      path,
      "messages-api",
      "seller message count",
      signal,
    );
  }

  private async authenticatedJson(
    path: string,
    origin: "seller-portal" | "messages-api",
    description: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const result = await this.http.request({
      method: "GET",
      path,
      origin,
      accept: "application/json",
      retryMode: "safe",
      ...(signal === undefined ? {} : { signal }),
    });
    const { response, bytes } = result;
    if (result.contentType === "text/html") {
      throw this.http.authenticationRequired(
        `TCGplayer returned an HTML page instead of ${description} data. Refresh the authorized session.`,
        errorOptions(response),
        result.sessionRevision,
      );
    }
    if (
      result.contentType !== "application/json" &&
      !result.contentType.endsWith("+json")
    ) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        `TCGplayer returned an unexpected ${description} response.`,
        errorOptions(response),
      );
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      ) as unknown;
    } catch (error) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        `TCGplayer returned malformed ${description} JSON.`,
        { ...errorOptions(response), cause: error },
      );
    }
  }

  async sellerFeedbackJson(
    path: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const result = await this.http.request({
      method: "GET",
      path,
      origin: "seller-stores",
      accept: "application/json",
      retryMode: "safe",
      sendSessionCookie: false,
      ...(signal === undefined ? {} : { signal }),
    });
    const { response, bytes } = result;
    if (
      result.contentType !== "application/json" &&
      !result.contentType.endsWith("+json")
    ) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned an unexpected seller feedback response.",
        errorOptions(response),
      );
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      ) as unknown;
    } catch (error) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned malformed seller feedback JSON.",
        { ...errorOptions(response), cause: error },
      );
    }
  }

  async sellerPortalHtml(path: string, signal?: AbortSignal): Promise<string> {
    const result = await this.http.request({
      method: "GET",
      path,
      origin: "seller-portal",
      accept: "text/html",
      retryMode: "safe",
      ...(signal === undefined ? {} : { signal }),
    });
    const { response, bytes } = result;
    if (
      result.contentType !== "text/html" &&
      result.contentType !== "application/xhtml+xml"
    ) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned an unexpected legacy payment response.",
        errorOptions(response),
      );
    }
    let value: string;
    try {
      value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned legacy payment data that is not valid UTF-8.",
        { ...errorOptions(response), cause: error },
      );
    }
    if (
      /(?:login|signin)\.tcgplayer\.com/iu.test(value) ||
      /<input\b[^>]*\btype=["']password["']/iu.test(value)
    ) {
      throw this.http.authenticationRequired(
        "TCGplayer returned a login page instead of legacy payment data. Refresh the authorized session.",
        errorOptions(response),
        result.sessionRevision,
      );
    }
    return value;
  }

  async pdf(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<BinaryResponse> {
    const result = await this.http.request({
      method: "POST",
      path,
      body,
      accept: "application/pdf",
      retryMode: "safe",
      ...(signal === undefined ? {} : { signal }),
    });
    const { response, bytes } = result;
    const type = result.contentType;
    if (type === "text/html") {
      throw this.http.authenticationRequired(
        "TCGplayer returned an HTML page instead of a packing slip. Refresh the authorized session.",
        errorOptions(response),
        result.sessionRevision,
      );
    }

    const hasPdfSignature =
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d;
    const supportedPdfType =
      type === "application/pdf" || type === "application/octet-stream";
    if (!supportedPdfType || !hasPdfSignature) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned invalid packing-slip PDF data.",
        errorOptions(response),
      );
    }

    return { bytes, contentType: type };
  }

  async text(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<string> {
    const result = await this.http.request({
      method: "POST",
      path,
      body,
      accept: "text/csv",
      retryMode: "safe",
      ...(signal === undefined ? {} : { signal }),
    });
    const { response, bytes } = result;
    if (result.contentType === "text/html") {
      throw this.http.authenticationRequired(
        "TCGplayer returned an HTML page instead of seller export data. Refresh the authorized session.",
        errorOptions(response),
        result.sessionRevision,
      );
    }
    if (
      result.contentType !== "text/csv" &&
      result.contentType !== "text/plain" &&
      result.contentType !== "application/octet-stream"
    ) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned an unexpected content type for seller export data.",
        errorOptions(response),
      );
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned seller export data that is not valid UTF-8.",
        { ...errorOptions(response), cause: error },
      );
    }
  }

  async command(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<void> {
    const result = await this.http.request({
      method: "POST",
      path,
      ...(body === undefined ? {} : { body }),
      accept: "application/json",
      retryMode: "never",
      discardResponseBody: true,
      ...(signal === undefined ? {} : { signal }),
    });
    if (result.contentType === "text/html") {
      throw this.http.authenticationRequired(
        "TCGplayer returned an HTML page for a fulfillment mutation. Refresh the authorized session and reconcile the order.",
        errorOptions(result.response),
        result.sessionRevision,
      );
    }
  }

  async sellerPortalFormCommand(
    path: string,
    body: URLSearchParams,
    signal?: AbortSignal,
  ): Promise<void> {
    const result = await this.http.request({
      method: "POST",
      path,
      body,
      bodyFormat: "form",
      origin: "seller-portal",
      accept: "*/*",
      retryMode: "never",
      discardResponseBody: true,
      ...(signal === undefined ? {} : { signal }),
    });
    if (result.contentType === "text/html") {
      throw this.http.authenticationRequired(
        "TCGplayer returned an HTML page for a seller mutation. Refresh the authorized session and reconcile the affected resource.",
        errorOptions(result.response),
        result.sessionRevision,
      );
    }
  }

  async mutationJson(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    let result: RawResponse;
    try {
      result = await this.http.request({
        method: "POST",
        path,
        ...(body === undefined ? {} : { body }),
        accept: "application/json",
        retryMode: "never",
        ...(signal === undefined ? {} : { signal }),
      });
    } catch (error) {
      if (isTcgplayerApiError(error) && error.code === "RESPONSE_TOO_LARGE") {
        throw new TcgplayerApiError(
          "AMBIGUOUS_RESULT",
          "TCGplayer accepted a fulfillment mutation but returned an oversized result. Reconcile the affected orders.",
          {
            ...(error.status === undefined ? {} : { status: error.status }),
            ...(error.requestId === undefined
              ? {}
              : { requestId: error.requestId }),
            cause: error,
          },
        );
      }
      throw error;
    }
    const { response, bytes } = result;
    if (result.contentType === "text/html") {
      throw this.http.authenticationRequired(
        "TCGplayer returned an HTML page for a fulfillment mutation. Refresh the authorized session and reconcile the order.",
        errorOptions(response),
        result.sessionRevision,
      );
    }
    if (
      result.contentType !== "application/json" &&
      !result.contentType.endsWith("+json")
    ) {
      throw new TcgplayerApiError(
        "AMBIGUOUS_RESULT",
        "TCGplayer accepted a fulfillment mutation but returned an unexpected response. Reconcile the affected orders.",
        errorOptions(response),
      );
    }
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw new TcgplayerApiError(
        "AMBIGUOUS_RESULT",
        "TCGplayer accepted a fulfillment mutation but returned malformed JSON. Reconcile the affected orders.",
        { ...errorOptions(response), cause: error },
      );
    }
  }
}
