import { describe, expect, it } from "vitest";
import {
  clientWith,
  fetchQueue,
  htmlResponse,
  jsonResponse,
  legacyPaymentTable,
  syntheticSellerKey,
} from "./client-fixtures.js";

describe("TcgplayerSellerClient account data", () => {
  it("reads a validated, paginated seller payout history", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse(
        [
          {
            payoutId: "synthetic-payout-id",
            referenceId: "SYNTHETIC-PAYOUT-1",
            sellerKey: syntheticSellerKey,
            sellerName: "Synthetic Seller",
            createdAt: "2026-08-01T12:00:00.000Z",
            holdUntil: "2026-08-03T12:00:00.000Z",
            lastSentAt: null,
            amount: 12_345,
            ordersCount: 4,
            status: "Committed",
            metadata: {
              TargetAmount: "123.45",
              TargetCurrency: "CAD",
            },
            paymentInstrument: { displayValue: "9999" },
          },
        ],
        200,
        { "x-total-count": "31" },
      ),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.listSellerPayouts({
      sellerKey: syntheticSellerKey,
      page: 2,
      pageSize: 10,
      status: "Committed",
    });

    expect(result).toEqual({
      totalPayouts: 31,
      page: 2,
      pageSize: 10,
      payouts: [
        {
          payoutId: "synthetic-payout-id",
          referenceId: "SYNTHETIC-PAYOUT-1",
          createdAt: "2026-08-01T12:00:00.000Z",
          holdUntil: "2026-08-03T12:00:00.000Z",
          amount: 12_345,
          ordersCount: 4,
          status: "Committed",
          metadata: { targetAmount: 123.45, targetCurrency: "CAD" },
        },
      ],
    });
    expect(requests[0]?.url).toBe(
      `https://money-movement.tcgplayer.com/v1/Payouts?SellerKey=${syntheticSellerKey}&Page=2&PageSize=10&Status=Committed`,
    );
    expect(requests[0]?.init?.method).toBe("GET");
    expect(new Headers(requests[0]?.init?.headers).get("cookie")).toBe(
      "TCGAuthTicket_Production=synthetic-cookie-value;",
    );
  });

  it("reads payout details while omitting payment-instrument data", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({
        payoutId: "synthetic-payout-id",
        referenceId: "SYNTHETIC PAYOUT/1",
        createdAt: "2026-08-01T12:00:00.000Z",
        lastSentAt: "2026-08-03T12:00:00.000Z",
        amount: 10_900,
        status: "Succeeded",
        totalSales: 12_000,
        totalRefunds: -500,
        totalFees: -700,
        totalAdjustments: 100,
        metadata: { TargetAmount: 109, TargetCurrency: "USD" },
        paymentInstrument: { displayValue: "9999", name: "Synthetic bank" },
        transactions: [
          {
            createdAt: "2026-08-01T10:00:00.000Z",
            type: "SettleOrder",
            orderNumber: "SYNTHETIC-ORDER-1",
            entries: { amount: 12_000, feeAmount: -700, netAmount: 11_300 },
          },
          {
            createdAt: "2026-08-01T11:00:00.000Z",
            type: "CommitPayout",
          },
        ],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    const result = await client.getSellerPayout({
      sellerKey: "seller/key",
      referenceId: "SYNTHETIC PAYOUT/1",
    });

    expect(result).toEqual({
      payoutId: "synthetic-payout-id",
      referenceId: "SYNTHETIC PAYOUT/1",
      createdAt: "2026-08-01T12:00:00.000Z",
      lastSentAt: "2026-08-03T12:00:00.000Z",
      amount: 10_900,
      status: "Succeeded",
      totalSales: 12_000,
      totalRefunds: -500,
      totalFees: -700,
      totalAdjustments: 100,
      metadata: { targetAmount: 109, targetCurrency: "USD" },
      transactions: [
        {
          createdAt: "2026-08-01T10:00:00.000Z",
          type: "SettleOrder",
          orderNumber: "SYNTHETIC-ORDER-1",
          amount: 12_000,
          feeAmount: -700,
          netAmount: 11_300,
        },
      ],
    });
    expect(requests[0]?.url).toBe(
      "https://money-movement.tcgplayer.com/v1/payouts/by-seller/seller%2Fkey/SYNTHETIC%20PAYOUT%2F1",
    );
    expect(result).not.toHaveProperty("paymentInstrument");
  });

  it("reads the seller unpaid balance and its supported transactions", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({
        totalBalance: 2_475,
        transactions: [
          {
            createdAt: "2026-08-04T10:00:00.000Z",
            type: "ApplyAdjustment",
            orderNumber: null,
            amount: 2_500,
            feeAmount: -25,
            netAmount: 2_475,
          },
        ],
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.getSellerUnpaidBalance({ sellerKey: syntheticSellerKey }),
    ).resolves.toEqual({
      totalBalance: 2_475,
      transactions: [
        {
          createdAt: "2026-08-04T10:00:00.000Z",
          type: "ApplyAdjustment",
          amount: 2_500,
          feeAmount: -25,
          netAmount: 2_475,
        },
      ],
    });
    expect(requests[0]?.url).toBe(
      `https://money-movement.tcgplayer.com/v1/balances/payable?SellerKey=${syntheticSellerKey}`,
    );
  });

  it("rejects invalid payout totals and mismatched payout references", async () => {
    const invalidTotal = clientWith(
      fetchQueue([jsonResponse([], 200, { "x-total-count": "many" })])
        .fetchImplementation,
    );
    await expect(
      invalidTotal.listSellerPayouts({ sellerKey: syntheticSellerKey }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

    const mismatch = clientWith(
      fetchQueue([
        jsonResponse({
          payoutId: "synthetic-payout-id",
          referenceId: "DIFFERENT",
          createdAt: "2026-08-01T12:00:00.000Z",
          amount: 0,
          status: "Succeeded",
          totalSales: 0,
          totalRefunds: 0,
          totalFees: 0,
          totalAdjustments: 0,
          transactions: [],
        }),
      ]).fetchImplementation,
    );
    await expect(
      mismatch.getSellerPayout({
        sellerKey: syntheticSellerKey,
        referenceId: "EXPECTED",
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("detects the seller payment experience from validated account capabilities", async () => {
    const identity = fetchQueue([
      jsonResponse({
        features: ["Synthetic Feature"],
        seller: { sellerKey: syntheticSellerKey },
      }),
    ]);
    const legacy = fetchQueue([
      jsonResponse({
        features: ["Synthetic Feature"],
        seller: { sellerKey: syntheticSellerKey },
      }),
    ]);
    const eps = fetchQueue([
      jsonResponse({
        features: ["Seller Portal Payments EPS Integration"],
        seller: { sellerKey: syntheticSellerKey.toUpperCase() },
      }),
    ]);

    await expect(
      clientWith(identity.fetchImplementation).getAuthenticatedSeller(),
    ).resolves.toEqual({ sellerKey: syntheticSellerKey });
    await expect(
      clientWith(legacy.fetchImplementation).getSellerPaymentExperience({
        sellerKey: syntheticSellerKey,
      }),
    ).resolves.toBe("legacy");
    await expect(
      clientWith(eps.fetchImplementation).getSellerPaymentExperience({
        sellerKey: syntheticSellerKey,
      }),
    ).resolves.toBe("money-movement");
    expect(legacy.requests[0]?.url).toBe(
      "https://sp-api.tcgplayer.com/Account/auth-detail?api-version=1.0",
    );
    expect(identity.requests[0]?.url).toBe(
      "https://sp-api.tcgplayer.com/Account/auth-detail?api-version=1.0",
    );
  });

  it("rejects payment capabilities for a different seller", async () => {
    const client = clientWith(
      fetchQueue([
        jsonResponse({
          features: [],
          seller: { sellerKey: "different-seller" },
        }),
      ]).fetchImplementation,
    );

    await expect(
      client.getSellerPaymentExperience({ sellerKey: syntheticSellerKey }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("reads validated legacy upcoming and past seller payment tables", async () => {
    const row = `<tr>
      <td>8/12/2026</td><td>8/10/2026</td><td>1,234</td>
      <td>$1,250.50</td><td>$125.25</td><td>($20.00)</td>
      <td>$2.00</td><td>-</td><td>$1,107.25</td>
      <td><a href="/admin/payment/PendingPaymentOrders?estimatedPaymentDate=synthetic">View Orders</a></td>
    </tr>`;
    const history = `<h2>Past Payment History</h2>${legacyPaymentTable(row)}
      <a href="/admin/payment/sellerpayment?page=2">2</a>
      <a href="/admin/payment/sellerpayment?page=3">3</a>`;
    const unscheduledRow = `<tr>
      <td>Not Scheduled *</td><td>Not Scheduled</td><td>2</td>
      <td>$4.00</td><td>$0.40</td><td>$0.00</td>
      <td>$0.00</td><td>$0.00</td><td>$3.60</td>
    </tr>`;
    const { fetchImplementation, requests } = fetchQueue([
      htmlResponse(history),
      htmlResponse(
        legacyPaymentTable(
          `${unscheduledRow}${row}<tr id="totals-row"><td>Totals</td><td>1,236</td><td>$1,254.50</td><td>$125.65</td><td>$20.00</td><td>$2.00</td><td>-</td><td>$1,110.85</td><td></td></tr>`,
        ),
      ),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(client.listLegacySellerPayments({ page: 1 })).resolves.toEqual(
      {
        page: 1,
        totalPages: 3,
        payments: [
          {
            estimatedArrivalDate: "2026-08-12",
            initiatedDate: "2026-08-10",
            ordersCount: 1234,
            totalSales: 125_050,
            totalFees: 12_525,
            refundedOrders: -2_000,
            refundedFees: 200,
            adjustments: 0,
            amount: 110_725,
          },
        ],
      },
    );
    await expect(client.listLegacyUpcomingSellerPayments()).resolves.toEqual({
      payments: [
        {
          estimatedArrivalDate: null,
          initiatedDate: null,
          ordersCount: 2,
          totalSales: 400,
          totalFees: 40,
          refundedOrders: 0,
          refundedFees: 0,
          adjustments: 0,
          amount: 360,
        },
        expect.objectContaining({
          estimatedArrivalDate: "2026-08-12",
          amount: 110_725,
        }),
      ],
    });
    expect(requests.map((request) => request.url)).toEqual([
      "https://store.tcgplayer.com/admin/payment/sellerpayment?page=1",
      "https://store.tcgplayer.com/admin/payment/loadpendingpayments?r=0",
    ]);
  });

  it("rejects malformed legacy payment tables and login pages", async () => {
    const invalidHistory = () =>
      htmlResponse(
        `<h2>Past Payment History</h2>${legacyPaymentTable(
          "<tr><td>not-a-date</td><td>8/10/2026</td><td>1</td><td>$1.00</td><td>$0.10</td><td>$0.00</td><td>$0.00</td><td>$0.00</td><td>$0.90</td></tr>",
        )}`,
      );
    const malformed = clientWith(
      fetchQueue([invalidHistory(), invalidHistory()]).fetchImplementation,
    );
    await expect(malformed.listLegacySellerPayments()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });

    const loggedOut = clientWith(
      fetchQueue([
        htmlResponse(
          '<html><form><input type="password" name="password"></form></html>',
        ),
      ]).fetchImplementation,
    );
    await expect(
      loggedOut.listLegacyUpcomingSellerPayments(),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
  });

  it("retries a transiently invalid legacy payment table once", async () => {
    const row = `<tr>
      <td>8/12/2026</td><td>8/10/2026</td><td>1</td>
      <td>$1.00</td><td>$0.10</td><td>$0.00</td>
      <td>$0.00</td><td>$0.00</td><td>$0.90</td>
    </tr>`;
    const { fetchImplementation, requests } = fetchQueue([
      htmlResponse(
        legacyPaymentTable(
          "<tr><td>not-a-date</td><td>8/10/2026</td><td>1</td><td>$1.00</td><td>$0.10</td><td>$0.00</td><td>$0.00</td><td>$0.00</td><td>$0.90</td></tr>",
        ),
      ),
      htmlResponse(legacyPaymentTable(row)),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(client.listLegacyUpcomingSellerPayments()).resolves.toEqual({
      payments: [expect.objectContaining({ amount: 90 })],
    });
    expect(requests).toHaveLength(2);
  });

  it("reads paginated seller feedback and aggregate ratings without sending the seller cookie", async () => {
    const { fetchImplementation, requests } = fetchQueue([
      jsonResponse({
        result: [
          {
            active: true,
            arrivedWhenExpected: true,
            asDescribed: true,
            comment: "Synthetic feedback comment.",
            createdByUserKey: "synthetic-created-by-key",
            createdDate: "2026-08-01T12:00:00.000Z",
            updatedDate: "2026-08-02T12:00:00.000Z",
            feedbackRating: 5,
            goodCommunication: false,
            sellerOrderID: 123,
            sellerKey: syntheticSellerKey.toUpperCase(),
            userKey: "synthetic-user-key",
            userNickname: "Synthetic Buyer",
          },
        ],
        total: 12,
      }),
      jsonResponse({
        result: {
          totalFeedbackRatings: 12,
          feedbackRatingFive: 8,
          feedbackRatingFour: 2,
          feedbackRatingThree: 1,
          feedbackRatingTwo: 0,
          feedbackRatingOne: 1,
          arrivedWhenExpectedPositive: 9,
          arrivedWhenExpectedNegative: 1,
          arrivedWhenExpectedEmpty: 2,
          asDescribedPositive: 10,
          asDescribedNegative: 1,
          asDescribedEmpty: 1,
          goodCommunicationPositive: 8,
          goodCommunicationNegative: 1,
          goodCommunicationEmpty: 3,
          totalAdditionalRatings: 33,
        },
      }),
    ]);
    const client = clientWith(fetchImplementation);

    await expect(
      client.listSellerFeedback({
        sellerKey: syntheticSellerKey,
        offset: 25,
        rows: 25,
        rating: 5,
        requireComment: true,
        days: 90,
      }),
    ).resolves.toEqual({
      totalFeedback: 12,
      offset: 25,
      rows: 25,
      feedback: [
        {
          rating: 5,
          comment: "Synthetic feedback comment.",
          buyerNickname: "Synthetic Buyer",
          createdAt: "2026-08-01T12:00:00.000Z",
          updatedAt: "2026-08-02T12:00:00.000Z",
          active: true,
          arrivedWhenExpected: true,
          asDescribed: true,
          goodCommunication: false,
        },
      ],
    });
    await expect(
      client.getSellerFeedbackAggregation({
        sellerKey: syntheticSellerKey,
        days: 90,
      }),
    ).resolves.toEqual({
      totalRatings: 12,
      fiveStar: 8,
      fourStar: 2,
      threeStar: 1,
      twoStar: 0,
      oneStar: 1,
      arrivedWhenExpected: { positive: 9, negative: 1, unanswered: 2 },
      asDescribed: { positive: 10, negative: 1, unanswered: 1 },
      goodCommunication: { positive: 8, negative: 1, unanswered: 3 },
      totalAdditionalRatings: 33,
    });

    expect(requests.map((request) => request.url)).toEqual([
      `https://seller-stores-backend.tcgplayer.com/sf/sellerorderfeedback/?sellerKey=${syntheticSellerKey}&sortBy=createdDate&offset=25&rows=25&rating=5&requireComment=true&days=90`,
      `https://seller-stores-backend.tcgplayer.com/sf/sellerorderfeedback/aggregation/?sellerKey=${syntheticSellerKey}&days=90`,
    ]);
    for (const request of requests) {
      expect(request.init?.method).toBe("GET");
      expect(new Headers(request.init?.headers).get("cookie")).toBeNull();
    }
  });

  it("rejects cross-seller and malformed seller feedback", async () => {
    const crossSeller = clientWith(
      fetchQueue([
        jsonResponse({
          result: [
            {
              active: true,
              arrivedWhenExpected: true,
              asDescribed: true,
              createdDate: "2026-08-01T12:00:00.000Z",
              feedbackRating: 5,
              sellerKey: "different-seller",
            },
          ],
          total: 1,
        }),
      ]).fetchImplementation,
    );
    await expect(
      crossSeller.listSellerFeedback({ sellerKey: syntheticSellerKey }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

    const malformedAggregate = clientWith(
      fetchQueue([jsonResponse({ result: { totalFeedbackRatings: "many" } })])
        .fetchImplementation,
    );
    await expect(
      malformedAggregate.getSellerFeedbackAggregation({
        sellerKey: syntheticSellerKey,
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

    await expect(
      crossSeller.listSellerFeedback({
        sellerKey: syntheticSellerKey,
        rating: 0 as 1,
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("accepts feedback that omits optional fulfillment questions", async () => {
    const client = clientWith(
      fetchQueue([
        jsonResponse({
          result: [
            {
              active: true,
              createdDate: "2026-08-01T12:00:00.000Z",
              feedbackRating: 4,
              sellerKey: syntheticSellerKey,
            },
          ],
          total: 1,
        }),
      ]).fetchImplementation,
    );

    const result = await client.listSellerFeedback({
      sellerKey: syntheticSellerKey,
    });

    expect(result.feedback).toEqual([
      {
        rating: 4,
        createdAt: "2026-08-01T12:00:00.000Z",
        active: true,
      },
    ]);
  });
});
