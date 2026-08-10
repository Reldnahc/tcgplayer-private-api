import {
  createTcgplayerSellerClient,
  type TcgplayerSellerClientOptions,
} from "../src/index.js";
export { TcgplayerApiError } from "../src/index.js";
export {
  syntheticOrder,
  syntheticOrderNumber,
  syntheticPdf,
  syntheticPullSheet,
  syntheticSellerKey,
  syntheticSummary,
} from "./fixtures.js";

export interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

export function jsonResponse(
  value: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function htmlResponse(value: string, status = 200): Response {
  return new Response(value, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export function legacyPaymentTable(row: string): string {
  return `<table>
    <thead><tr>
      <th>Estimated Transfer Arrival</th><th>Payment Initiated On</th>
      <th>Orders</th><th>Total Sales (+)</th><th>Total Fees (-)</th>
      <th>Refunded Orders (-)</th><th>Refunded Fees (+)</th>
      <th>Adjustments</th><th>Payment</th><th></th>
    </tr></thead>
    <tbody>${row}</tbody>
  </table>`;
}

export function fetchQueue(responses: readonly Response[]) {
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

export function clientWith(
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
