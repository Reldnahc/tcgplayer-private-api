import { describe, expect, it } from "vitest";
import {
  createTcgplayerSellerClient,
  type TcgplayerSellerClientOptions,
} from "../src/index.js";
import { syntheticSellerKey } from "./fixtures.js";

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
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

const threadSummary = {
  threadId: 123,
  unreadMessageCount: 1,
  totalMessageCount: 2,
  sender: "Synthetic Buyer",
  receiver: "me",
  subject: "Synthetic order question",
  orderType: "SellerOrder",
  orderNumber: "SYNTHETIC-ORDER-1",
  orderStatus: "Shipped",
  createdAt: "2026-08-01T12:00:00.000Z",
  respondedAt: null,
  activeEscalationAsOf: null,
  isTrashed: false,
};

describe("seller messages", () => {
  it("reads the inbox, unread count, and thread detail without mutations", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({
        result: { totalResults: 1, results: [threadSummary] },
        message: null,
        status: 200,
      }),
      jsonResponse({ count: 1 }),
      jsonResponse({
        result: {
          threadId: 123,
          subject: "Synthetic order question",
          activeEscalationAsOf: null,
          totalMessageCount: 2,
          messages: [
            {
              messageId: 456,
              body: "Synthetic message body.",
              isVisibleToSender: true,
              isVisibleToReceiver: true,
              createdAt: "2026-08-01T12:00:00.000Z",
              sender: "Synthetic Buyer",
              messageResponseRequired: true,
              isRead: false,
            },
          ],
          orderType: "SellerOrder",
          orderNumber: "SYNTHETIC-ORDER-1",
          isTrashed: false,
        },
        message: null,
        status: 200,
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.listSellerMessageThreads({
        sellerKey: syntheticSellerKey,
        page: 2,
        pageSize: 10,
        orderNumber: "SYNTHETIC-ORDER-1",
        includeDeleted: true,
      }),
    ).resolves.toEqual({
      totalThreads: 1,
      page: 2,
      pageSize: 10,
      threads: [
        {
          threadId: 123,
          unreadMessageCount: 1,
          totalMessageCount: 2,
          sender: "Synthetic Buyer",
          receiver: "me",
          subject: "Synthetic order question",
          orderType: "SellerOrder",
          orderNumber: "SYNTHETIC-ORDER-1",
          orderStatus: "Shipped",
          createdAt: "2026-08-01T12:00:00.000Z",
          deleted: false,
        },
      ],
    });
    await expect(client.getSellerUnreadMessageCount()).resolves.toBe(1);
    await expect(
      client.getSellerMessageThread({
        sellerKey: syntheticSellerKey,
        threadId: 123,
      }),
    ).resolves.toEqual({
      threadId: 123,
      subject: "Synthetic order question",
      totalMessageCount: 2,
      messages: [
        {
          messageId: 456,
          body: "Synthetic message body.",
          createdAt: "2026-08-01T12:00:00.000Z",
          sender: "Synthetic Buyer",
          responseRequired: true,
          isRead: false,
        },
      ],
      orderType: "SellerOrder",
      orderNumber: "SYNTHETIC-ORDER-1",
      deleted: false,
      page: 1,
      pageSize: 25,
    });

    expect(requests.map((request) => request.url)).toEqual([
      `https://store.tcgplayer.com/admin/sp-msg-api/${syntheticSellerKey}/threads?page=2&pageSize=10&orderNumber=SYNTHETIC-ORDER-1&includeAllThreads=true`,
      "https://messages-api.tcgplayer.com/messages/unread-count",
      `https://store.tcgplayer.com/admin/sp-msg-api/${syntheticSellerKey}/threads/123?messagesPage=1&messagesPageSize=25`,
    ]);
    for (const request of requests) {
      expect(request.init?.method).toBe("GET");
      expect(new Headers(request.init?.headers).get("cookie")).toBe(
        "TCGAuthTicket_Production=synthetic-cookie-value;",
      );
    }
  });

  it("rejects malformed message responses and unsafe inputs", async () => {
    const malformedCount = clientWith(
      fetchQueue([jsonResponse({ count: -1 })]).fetchImplementation,
    );
    await expect(
      malformedCount.getSellerUnreadMessageCount(),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

    const mismatchedThread = clientWith(
      fetchQueue([
        jsonResponse({
          result: {
            threadId: 999,
            subject: "Wrong thread",
            activeEscalationAsOf: null,
            totalMessageCount: 0,
            messages: [],
            orderType: "SellerOrder",
            orderNumber: "SYNTHETIC-ORDER-2",
            isTrashed: false,
          },
          message: null,
          status: 200,
        }),
      ]).fetchImplementation,
    );
    await expect(
      mismatchedThread.getSellerMessageThread({
        sellerKey: syntheticSellerKey,
        threadId: 123,
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

    await expect(
      mismatchedThread.listSellerMessageThreads({
        sellerKey: syntheticSellerKey,
        includeDeleted: "yes" as unknown as boolean,
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });
});
