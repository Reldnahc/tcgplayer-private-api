import {
  invalidArgument,
  isTcgplayerApiError,
  TcgplayerApiError,
} from "./errors.js";
import type {
  RetryOptions,
  TcgplayerSession,
  TcgplayerSessionProvider,
} from "./types.js";

const ORDER_MANAGEMENT_ORIGIN = "https://order-management-api.tcgplayer.com";
const DEFAULT_USER_AGENT = "tcgplayer-private-api";
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

interface TransportOptions {
  readonly session: TcgplayerSession | TcgplayerSessionProvider;
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
  readonly requestDelayMs?: number;
  readonly maxJsonResponseBytes?: number;
  readonly maxPdfResponseBytes?: number;
  readonly retry?: RetryOptions;
}

interface NormalizedRetryOptions {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

interface RequestSpec {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly body?: unknown;
  readonly accept: "application/json" | "application/pdf";
  readonly signal?: AbortSignal;
}

interface BinaryResponse {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

interface RawResponse extends BinaryResponse {
  readonly response: Response;
}

class RequestStartGate {
  private queue: Promise<void> = Promise.resolve();
  private nextStartAt = 0;

  constructor(private readonly delayMs: number) {}

  async wait(signal?: AbortSignal): Promise<void> {
    const scheduled = this.queue.then(async () => {
      const remaining = Math.max(0, this.nextStartAt - Date.now());
      await sleep(remaining, signal);
      this.nextStartAt = Date.now() + this.delayMs;
    });

    this.queue = scheduled.catch(() => undefined);
    await scheduled;
  }
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

function normalizeRetryOptions(
  value: RetryOptions | undefined,
): NormalizedRetryOptions {
  if (value !== undefined && (typeof value !== "object" || value === null)) {
    throw invalidArgument("retry must be an object.");
  }
  return {
    maxRetries: boundedInteger("retry.maxRetries", value?.maxRetries, 2, 0, 5),
    baseDelayMs: boundedInteger(
      "retry.baseDelayMs",
      value?.baseDelayMs,
      500,
      0,
      60_000,
    ),
    maxDelayMs: boundedInteger(
      "retry.maxDelayMs",
      value?.maxDelayMs,
      10_000,
      0,
      300_000,
    ),
  };
}

function safeHeaderValue(
  name: string,
  value: unknown,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw invalidArgument(`${name} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw invalidArgument(`${name} must contain 1-${maxLength} characters.`);
  }
  if (containsControlCharacter(normalized)) {
    throw invalidArgument(`${name} must not contain control characters.`);
  }
  return normalized;
}

function validateSession(value: TcgplayerSession): TcgplayerSession {
  if (typeof value !== "object" || value === null) {
    throw invalidArgument("The session provider returned an invalid session.");
  }

  const authCookie = safeHeaderValue(
    "session.authCookie",
    value.authCookie,
    8192,
  );
  if (authCookie.startsWith("TCGAuthTicket_Production=")) {
    throw invalidArgument(
      "session.authCookie must contain the cookie value only, without its name.",
    );
  }
  if (authCookie.includes(";")) {
    throw invalidArgument(
      "session.authCookie must contain one cookie value, not a Cookie header.",
    );
  }

  const userAgent =
    value.userAgent === undefined
      ? undefined
      : safeHeaderValue("session.userAgent", value.userAgent, 512);

  return {
    authCookie,
    ...(userAgent === undefined ? {} : { userAgent }),
  };
}

function requestIdFrom(response: Response): string | undefined {
  const candidate =
    response.headers.get("x-request-id") ??
    response.headers.get("request-id") ??
    undefined;
  if (
    candidate === undefined ||
    candidate.length > 256 ||
    containsControlCharacter(candidate)
  ) {
    return undefined;
  }
  return candidate;
}

function errorOptions(response: Response, retryable = false) {
  const requestId = requestIdFrom(response);
  return {
    status: response.status,
    retryable,
    ...(requestId === undefined ? {} : { requestId }),
  };
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Cancellation is best-effort after the response has already failed.
  }
}

function errorForStatus(response: Response): TcgplayerApiError {
  if (response.status === 401) {
    return new TcgplayerApiError(
      "AUTHENTICATION_REQUIRED",
      "TCGplayer rejected the seller session. Refresh the authorized session and try again.",
      errorOptions(response),
    );
  }
  if (response.status === 403) {
    return new TcgplayerApiError(
      "FORBIDDEN",
      "The authenticated seller is not authorized for this request.",
      errorOptions(response),
    );
  }
  if (response.status === 404) {
    return new TcgplayerApiError(
      "NOT_FOUND",
      "The requested seller resource was not found.",
      errorOptions(response),
    );
  }
  if (response.status === 429) {
    return new TcgplayerApiError(
      "RATE_LIMITED",
      "TCGplayer rate-limited the request.",
      errorOptions(response, true),
    );
  }
  return new TcgplayerApiError(
    "REMOTE_ERROR",
    `TCGplayer returned HTTP ${response.status}.`,
    errorOptions(response, response.status >= 500),
  );
}

function retryDelayMs(
  response: Response,
  attempt: number,
  options: NormalizedRetryOptions,
): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(options.maxDelayMs, Math.round(seconds * 1000));
    }

    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) {
      return Math.min(options.maxDelayMs, Math.max(0, date - Date.now()));
    }
  }

  return backoffDelayMs(attempt, options);
}

function backoffDelayMs(
  attempt: number,
  options: NormalizedRetryOptions,
): number {
  const exponential = options.baseDelayMs * 2 ** attempt;
  const jitter = options.baseDelayMs === 0 ? 0 : Math.random() * 250;
  return Math.min(options.maxDelayMs, Math.round(exponential + jitter));
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new TcgplayerApiError("ABORTED", "The request was aborted.");
  }
  if (ms <= 0) return;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new TcgplayerApiError("ABORTED", "The request was aborted."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function readBytes(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed > maximumBytes) {
      await cancelBody(response);
      throw new TcgplayerApiError(
        "RESPONSE_TOO_LARGE",
        `TCGplayer response exceeded the ${maximumBytes}-byte safety limit.`,
        errorOptions(response),
      );
    }
  }

  if (response.body === null) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new TcgplayerApiError(
        "RESPONSE_TOO_LARGE",
        `TCGplayer response exceeded the ${maximumBytes}-byte safety limit.`,
        errorOptions(response),
      );
    }
    chunks.push(value);
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function contentType(response: Response): string {
  return (
    (response.headers.get("content-type") ?? "")
      .split(";", 1)[0]
      ?.trim()
      .toLowerCase() ?? ""
  );
}

export class SellerApiTransport {
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly maxJsonResponseBytes: number;
  private readonly maxPdfResponseBytes: number;
  private readonly retry: NormalizedRetryOptions;
  private readonly gate: RequestStartGate;

  constructor(private readonly options: TransportOptions) {
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    if (typeof this.fetchImplementation !== "function") {
      throw invalidArgument("A Fetch API implementation is required.");
    }
    this.timeoutMs = boundedInteger(
      "timeoutMs",
      options.timeoutMs,
      30_000,
      1,
      300_000,
    );
    const requestDelayMs = boundedInteger(
      "requestDelayMs",
      options.requestDelayMs,
      250,
      0,
      60_000,
    );
    this.maxJsonResponseBytes = boundedInteger(
      "maxJsonResponseBytes",
      options.maxJsonResponseBytes,
      2 * 1024 * 1024,
      1024,
      50 * 1024 * 1024,
    );
    this.maxPdfResponseBytes = boundedInteger(
      "maxPdfResponseBytes",
      options.maxPdfResponseBytes,
      25 * 1024 * 1024,
      1024,
      100 * 1024 * 1024,
    );
    this.retry = normalizeRetryOptions(options.retry);
    this.gate = new RequestStartGate(requestDelayMs);
  }

  async json(
    method: "GET" | "POST",
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const result = await this.request({
      method,
      path,
      ...(body === undefined ? {} : { body }),
      accept: "application/json",
      ...(signal === undefined ? {} : { signal }),
    });

    const { response, bytes } = result;
    const type = result.contentType;
    if (type === "text/html") {
      throw new TcgplayerApiError(
        "AUTHENTICATION_REQUIRED",
        "TCGplayer returned an HTML page instead of seller API data. Refresh the authorized session.",
        errorOptions(response),
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

  async pdf(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<BinaryResponse> {
    const result = await this.request({
      method: "POST",
      path,
      body,
      accept: "application/pdf",
      ...(signal === undefined ? {} : { signal }),
    });
    const { response, bytes } = result;
    const type = result.contentType;
    if (type === "text/html") {
      throw new TcgplayerApiError(
        "AUTHENTICATION_REQUIRED",
        "TCGplayer returned an HTML page instead of a packing slip. Refresh the authorized session.",
        errorOptions(response),
      );
    }

    const hasPdfSignature =
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d;
    if (type !== "application/pdf" || !hasPdfSignature) {
      throw new TcgplayerApiError(
        "INVALID_RESPONSE",
        "TCGplayer returned invalid packing-slip PDF data.",
        errorOptions(response),
      );
    }

    return { bytes, contentType: type };
  }

  private async loadSession(): Promise<TcgplayerSession> {
    try {
      const value =
        typeof this.options.session === "function"
          ? await this.options.session()
          : this.options.session;
      return validateSession(value);
    } catch (error) {
      if (isTcgplayerApiError(error)) throw error;
      throw new TcgplayerApiError(
        "AUTHENTICATION_REQUIRED",
        "The seller session provider failed.",
        { cause: error },
      );
    }
  }

  private async request(spec: RequestSpec): Promise<RawResponse> {
    for (let attempt = 0; attempt <= this.retry.maxRetries; attempt += 1) {
      await this.gate.wait(spec.signal);
      const session = await this.loadSession();
      const controller = new AbortController();
      let timedOut = false;
      const onCallerAbort = () => controller.abort(spec.signal?.reason);
      spec.signal?.addEventListener("abort", onCallerAbort, { once: true });
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.timeoutMs);

      try {
        const headers = new Headers({
          Accept: spec.accept,
          "Cache-Control": "no-cache",
          Cookie: `TCGAuthTicket_Production=${session.authCookie};`,
          "User-Agent": session.userAgent ?? DEFAULT_USER_AGENT,
        });
        let body: string | undefined;
        if (spec.body !== undefined) {
          headers.set("Content-Type", "application/json");
          body = JSON.stringify(spec.body);
        }

        const response = await this.fetchImplementation(
          new URL(spec.path, ORDER_MANAGEMENT_ORIGIN),
          {
            method: spec.method,
            headers,
            redirect: "manual",
            signal: controller.signal,
            ...(body === undefined ? {} : { body }),
          },
        );

        if (response.status >= 300 && response.status < 400) {
          await cancelBody(response);
          throw new TcgplayerApiError(
            "AUTHENTICATION_REQUIRED",
            "TCGplayer redirected the seller request. Refresh the authorized session.",
            errorOptions(response),
          );
        }

        if (!response.ok) {
          if (
            RETRYABLE_STATUSES.has(response.status) &&
            attempt < this.retry.maxRetries
          ) {
            const delay = retryDelayMs(response, attempt, this.retry);
            await cancelBody(response);
            clearTimeout(timer);
            await sleep(delay, spec.signal);
            continue;
          }

          await cancelBody(response);
          throw errorForStatus(response);
        }

        const maximumBytes =
          spec.accept === "application/pdf"
            ? this.maxPdfResponseBytes
            : this.maxJsonResponseBytes;
        const bytes = await readBytes(response, maximumBytes);
        return {
          response,
          bytes,
          contentType: contentType(response),
        };
      } catch (error) {
        if (isTcgplayerApiError(error)) throw error;
        if (spec.signal?.aborted) {
          throw new TcgplayerApiError("ABORTED", "The request was aborted.", {
            cause: error,
          });
        }
        if (timedOut) {
          if (attempt < this.retry.maxRetries) {
            clearTimeout(timer);
            await sleep(backoffDelayMs(attempt, this.retry), spec.signal);
            continue;
          }
          throw new TcgplayerApiError(
            "TIMEOUT",
            `TCGplayer did not respond within ${this.timeoutMs}ms.`,
            { retryable: true, cause: error },
          );
        }
        if (attempt < this.retry.maxRetries) {
          clearTimeout(timer);
          await sleep(backoffDelayMs(attempt, this.retry), spec.signal);
          continue;
        }
        throw new TcgplayerApiError(
          "NETWORK_ERROR",
          "The request to TCGplayer failed before a response was received.",
          { retryable: true, cause: error },
        );
      } finally {
        clearTimeout(timer);
        spec.signal?.removeEventListener("abort", onCallerAbort);
      }
    }

    throw new TcgplayerApiError(
      "REMOTE_ERROR",
      "TCGplayer request exhausted its retry budget.",
      { retryable: true },
    );
  }
}
