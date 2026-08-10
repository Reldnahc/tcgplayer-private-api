export interface ListSellerMessageThreadsInput {
  readonly sellerKey: string;
  /** One-based page number. */
  readonly page?: number;
  readonly pageSize?: number;
  /** Optional exact seller order number filter. */
  readonly orderNumber?: string;
  /** Include threads deleted in the Seller Portal. */
  readonly includeDeleted?: boolean;
}

export interface GetSellerMessageThreadInput {
  readonly sellerKey: string;
  readonly threadId: number;
  /** One-based message page number. */
  readonly page?: number;
  readonly pageSize?: number;
}

export interface MarkSellerMessageThreadReadInput {
  readonly sellerKey: string;
  readonly threadId: number;
}

export interface ReplyToSellerMessageThreadInput {
  readonly sellerKey: string;
  readonly threadId: number;
  readonly body: string;
}

export interface SellerMessageThreadSummary {
  readonly threadId: number;
  readonly unreadMessageCount: number;
  readonly totalMessageCount: number;
  readonly sender: string;
  readonly receiver: string;
  readonly subject: string;
  readonly orderType: string;
  readonly orderNumber: string;
  readonly orderStatus: string;
  readonly createdAt: string;
  readonly respondedAt?: string;
  readonly activeEscalationAsOf?: string;
  readonly deleted: boolean;
}

export interface ListSellerMessageThreadsResult {
  readonly totalThreads: number;
  readonly page: number;
  readonly pageSize: number;
  readonly threads: readonly SellerMessageThreadSummary[];
}

export interface SellerMessage {
  readonly messageId: number;
  readonly body: string;
  readonly createdAt: string;
  readonly sender: string;
  readonly responseRequired: boolean;
  readonly isRead: boolean;
}

export interface SellerMessageThread {
  readonly threadId: number;
  readonly subject: string;
  readonly activeEscalationAsOf?: string;
  readonly totalMessageCount: number;
  readonly messages: readonly SellerMessage[];
  readonly orderType: string;
  readonly orderNumber: string;
  readonly deleted: boolean;
  readonly page: number;
  readonly pageSize: number;
}

export const SellerPayoutStatus = {
  Staged: "Staged",
  InReview: "InReview",
  Committed: "Committed",
  InTransit: "InTransit",
  Succeeded: "Succeeded",
  Rejected: "Rejected",
  Failed: "Failed",
  Retrying: "Retrying",
} as const;

export type SellerPayoutStatus =
  (typeof SellerPayoutStatus)[keyof typeof SellerPayoutStatus];

export interface ListSellerPayoutsInput {
  readonly sellerKey: string;
  /** One-based page number. */
  readonly page?: number;
  readonly pageSize?: number;
  readonly status?: SellerPayoutStatus;
}

export interface GetSellerPayoutInput {
  readonly sellerKey: string;
  readonly referenceId: string;
}

export interface GetSellerUnpaidBalanceInput {
  readonly sellerKey: string;
}

export const SellerPaymentExperience = {
  Legacy: "legacy",
  MoneyMovement: "money-movement",
} as const;

export type SellerPaymentExperience =
  (typeof SellerPaymentExperience)[keyof typeof SellerPaymentExperience];

export interface GetSellerPaymentExperienceInput {
  readonly sellerKey: string;
}

export interface ListLegacySellerPaymentsInput {
  /** One-based page number for past payments. */
  readonly page?: number;
}

export interface LegacySellerPayment {
  /** Calendar date in YYYY-MM-DD form, or null when TCGplayer displays Not Scheduled. */
  readonly estimatedArrivalDate: string | null;
  /** Calendar date in YYYY-MM-DD form, or null when TCGplayer displays Not Scheduled. */
  readonly initiatedDate: string | null;
  readonly ordersCount: number;
  /** USD minor units (cents), preserving the displayed sign. */
  readonly totalSales: number;
  /** USD minor units (cents), preserving the displayed sign. */
  readonly totalFees: number;
  /** USD minor units (cents), preserving the displayed sign. */
  readonly refundedOrders: number;
  /** USD minor units (cents), preserving the displayed sign. */
  readonly refundedFees: number;
  /** USD minor units (cents), preserving the displayed sign. */
  readonly adjustments: number;
  /** USD minor units (cents), preserving the displayed sign. */
  readonly amount: number;
}

export interface ListLegacySellerPaymentsResult {
  readonly page: number;
  readonly totalPages: number;
  readonly payments: readonly LegacySellerPayment[];
}

export interface ListLegacyUpcomingSellerPaymentsResult {
  readonly payments: readonly LegacySellerPayment[];
}

export type SellerFeedbackRating = 1 | 2 | 3 | 4 | 5;

export interface ListSellerFeedbackInput {
  readonly sellerKey: string;
  /** Zero-based record offset. */
  readonly offset?: number;
  readonly rows?: number;
  readonly rating?: SellerFeedbackRating;
  readonly requireComment?: boolean;
  /** Restrict results to feedback created within this many days. */
  readonly days?: number;
}

export interface GetSellerFeedbackAggregationInput {
  readonly sellerKey: string;
  /** Restrict the aggregate to feedback created within this many days. */
  readonly days?: number;
}

export interface SellerFeedbackEntry {
  readonly rating: SellerFeedbackRating;
  readonly comment?: string;
  readonly buyerNickname?: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly active: boolean;
  readonly arrivedWhenExpected?: boolean;
  readonly asDescribed?: boolean;
  readonly goodCommunication?: boolean;
}

export interface ListSellerFeedbackResult {
  readonly totalFeedback: number;
  readonly offset: number;
  readonly rows: number;
  readonly feedback: readonly SellerFeedbackEntry[];
}

export interface SellerFeedbackAnswerCounts {
  readonly positive: number;
  readonly negative: number;
  readonly unanswered: number;
}

export interface SellerFeedbackAggregation {
  readonly totalRatings: number;
  readonly fiveStar: number;
  readonly fourStar: number;
  readonly threeStar: number;
  readonly twoStar: number;
  readonly oneStar: number;
  readonly arrivedWhenExpected: SellerFeedbackAnswerCounts;
  readonly asDescribed: SellerFeedbackAnswerCounts;
  readonly goodCommunication: SellerFeedbackAnswerCounts;
  readonly totalAdditionalRatings: number;
}

export interface SellerPayoutMetadata {
  /** Optional amount in the target currency's major units. */
  readonly targetAmount?: number;
  readonly targetCurrency?: string;
}

export interface SellerPayoutSummary {
  readonly payoutId: string;
  readonly referenceId: string | null;
  readonly createdAt: string;
  readonly holdUntil?: string;
  readonly lastSentAt?: string;
  /** USD minor units (cents), matching the Money Movement contract. */
  readonly amount: number;
  readonly ordersCount: number;
  /** The validated provider status label, preserved verbatim. */
  readonly status: string;
  readonly metadata?: SellerPayoutMetadata;
}

export interface ListSellerPayoutsResult {
  readonly totalPayouts: number;
  readonly page: number;
  readonly pageSize: number;
  readonly payouts: readonly SellerPayoutSummary[];
}

export type SellerPayoutTransactionType =
  "SettleOrder" | "ApplyRefund" | "ApplyAdjustment";

export interface SellerPayoutTransaction {
  readonly createdAt: string;
  readonly type: SellerPayoutTransactionType;
  readonly orderNumber?: string;
  /** USD minor units (cents). */
  readonly amount: number;
  /** USD minor units (cents). */
  readonly feeAmount: number;
  /** USD minor units (cents). */
  readonly netAmount: number;
}

export interface SellerPayoutDetail {
  readonly payoutId: string;
  readonly referenceId: string;
  readonly createdAt: string;
  readonly lastSentAt?: string;
  /** USD minor units (cents). */
  readonly amount: number;
  readonly status: string;
  readonly totalSales: number;
  readonly totalRefunds: number;
  readonly totalFees: number;
  readonly totalAdjustments: number;
  readonly metadata?: SellerPayoutMetadata;
  readonly transactions: readonly SellerPayoutTransaction[];
}

export interface SellerUnpaidBalance {
  /** USD minor units (cents). */
  readonly totalBalance: number;
  readonly transactions: readonly SellerPayoutTransaction[];
}
