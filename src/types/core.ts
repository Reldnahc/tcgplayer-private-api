import type { TcgplayerApiError } from "../errors.js";

export type Awaitable<T> = T | PromiseLike<T>;

export interface TcgplayerSession {
  /** The value only, without the `TCGAuthTicket_Production=` prefix. */
  readonly authCookie: string;
  /** Optional caller-selected user agent. It must not contain control characters. */
  readonly userAgent?: string;
}

export type TcgplayerSessionProvider = () => Awaitable<TcgplayerSession>;

export type TcgplayerAuthenticationRequiredHandler = (
  error: TcgplayerApiError,
) => Awaitable<void>;

export interface RetryOptions {
  /** Number of retries after the initial request. */
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
}

export interface TcgplayerSellerClientOptions {
  readonly session: TcgplayerSession | TcgplayerSessionProvider;
  /** Called when the client determines that the current seller session cannot authenticate. */
  readonly onAuthenticationRequired?: TcgplayerAuthenticationRequiredHandler;
  /** Injectable for deterministic tests. Production requests always target TCGplayer. */
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
  readonly requestDelayMs?: number;
  readonly maxJsonResponseBytes?: number;
  readonly maxPdfResponseBytes?: number;
  readonly maxTextResponseBytes?: number;
  readonly retry?: RetryOptions;
}

export interface RequestOptions {
  readonly signal?: AbortSignal;
}

export interface AuthenticatedSeller {
  readonly sellerKey: string;
}
