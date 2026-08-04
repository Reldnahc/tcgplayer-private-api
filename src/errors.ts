export type TcgplayerApiErrorCode =
  | "INVALID_ARGUMENT"
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "REMOTE_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "ABORTED"
  | "AMBIGUOUS_RESULT"
  | "INVALID_RESPONSE"
  | "RESPONSE_TOO_LARGE";

export interface TcgplayerApiErrorOptions {
  readonly status?: number;
  readonly retryable?: boolean;
  readonly requestId?: string;
  readonly cause?: unknown;
}

export class TcgplayerApiError extends Error {
  readonly code: TcgplayerApiErrorCode;
  readonly status: number | undefined;
  readonly retryable: boolean;
  readonly requestId: string | undefined;

  constructor(
    code: TcgplayerApiErrorCode,
    message: string,
    options: TcgplayerApiErrorOptions = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "TcgplayerApiError";
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.requestId = options.requestId;
  }
}

export function isTcgplayerApiError(
  value: unknown,
): value is TcgplayerApiError {
  return value instanceof TcgplayerApiError;
}

export function invalidArgument(message: string): TcgplayerApiError {
  return new TcgplayerApiError("INVALID_ARGUMENT", message);
}

export function invalidResponse(message: string): TcgplayerApiError {
  return new TcgplayerApiError("INVALID_RESPONSE", message);
}
