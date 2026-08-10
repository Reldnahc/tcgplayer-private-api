import { invalidArgument } from "../errors.js";
import type {
  MarkSellerMessageThreadReadInput,
  RefundOrderFullInput,
  RefundOrderPartialInput,
  ReplyToSellerMessageThreadInput,
  RequestOptions,
} from "../types.js";

export function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export function requiredText(
  name: string,
  value: string,
  maximum: number,
): string {
  if (typeof value !== "string") {
    throw invalidArgument(`${name} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw invalidArgument(`${name} must contain 1-${maximum} characters.`);
  }
  if (containsControlCharacter(normalized)) {
    throw invalidArgument(`${name} must not contain control characters.`);
  }
  return normalized;
}

export function sellerMessageBody(value: string): string {
  if (typeof value !== "string") {
    throw invalidArgument("body must be a string.");
  }
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (normalized.length < 1 || normalized.length > 10_000) {
    throw invalidArgument("body must contain 1-10000 characters.");
  }
  for (const character of normalized) {
    const code = character.charCodeAt(0);
    if (
      (code <= 0x1f && character !== "\n" && character !== "\t") ||
      code === 0x7f
    ) {
      throw invalidArgument(
        "body must not contain unsupported control characters.",
      );
    }
  }
  return normalized;
}

export function refundReasonText(value: string): string {
  if (typeof value !== "string") {
    throw invalidArgument("reasonText must be a string.");
  }
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (normalized.length < 1 || normalized.length > 500) {
    throw invalidArgument("reasonText must contain 1-500 characters.");
  }
  for (const character of normalized) {
    const code = character.charCodeAt(0);
    if (
      (code <= 0x1f && character !== "\n" && character !== "\t") ||
      code === 0x7f
    ) {
      throw invalidArgument("reasonText contains an unsupported character.");
    }
  }
  return normalized;
}

export function currencyCents(name: string, value: number): number {
  const normalized = finiteNumber(name, value, 0, 1_000_000);
  const cents = Math.round(normalized * 100);
  if (Math.abs(normalized * 100 - cents) > 1e-9) {
    throw invalidArgument(`${name} must use no more than two decimal places.`);
  }
  return cents;
}

export function refundBase(
  input: RefundOrderFullInput | RefundOrderPartialInput,
) {
  if (typeof input !== "object" || input === null) {
    throw invalidArgument("Refund input is required.");
  }
  return {
    sellerKey: requiredText("sellerKey", input.sellerKey, 256),
    orderNumber: requiredText("orderNumber", input.orderNumber, 128),
    origin: requiredText("origin", input.origin, 256),
    reason: requiredText("reason", input.reason, 256),
    reasonText: refundReasonText(input.reasonText),
  };
}

export function sellerMessageThreadTarget(
  input: MarkSellerMessageThreadReadInput | ReplyToSellerMessageThreadInput,
): { readonly sellerKey: string; readonly threadId: number } {
  if (typeof input !== "object" || input === null) {
    throw invalidArgument("Seller message thread input is required.");
  }
  return {
    sellerKey: requiredText("sellerKey", input.sellerKey, 256),
    threadId: boundedInteger(
      "threadId",
      input.threadId,
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
  };
}

export function boundedInteger(
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

export function finiteNumber(
  name: string,
  value: number,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw invalidArgument(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function appendFormValue(
  form: URLSearchParams,
  path: string,
  value: string | number | boolean | null,
): void {
  form.append(path, value === null ? "" : String(value));
}

export function normalizeOrderNumbers(values: readonly string[]): string[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 500) {
    throw invalidArgument("orderNumbers must contain 1-500 order numbers.");
  }

  const normalized = values.map((value, index) =>
    requiredText(`orderNumbers[${index}]`, value, 128),
  );
  if (new Set(normalized).size !== normalized.length) {
    throw invalidArgument("orderNumbers must not contain duplicates.");
  }
  return normalized;
}

export function requestSignal(options: RequestOptions | undefined) {
  return options?.signal;
}

export function uniqueTextValues(
  name: string,
  values: readonly string[] | undefined,
): string[] | undefined {
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.length === 0 || values.length > 100) {
    throw invalidArgument(`${name} must contain 1-100 values.`);
  }
  const normalized = values.map((value, index) =>
    requiredText(`${name}[${String(index)}]`, value, 256),
  );
  if (new Set(normalized).size !== normalized.length) {
    throw invalidArgument(`${name} must not contain duplicates.`);
  }
  return normalized;
}
export function uniqueProductIds(
  values: readonly number[] | undefined,
): number[] | undefined {
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.length === 0 || values.length > 24) {
    throw invalidArgument("productIds must contain 1-24 values.");
  }
  const normalized = values.map((value, index) =>
    boundedInteger(
      `productIds[${String(index)}]`,
      value,
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
  );
  if (new Set(normalized).size !== normalized.length) {
    throw invalidArgument("productIds must not contain duplicates.");
  }
  return normalized;
}

export function isShippedStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized.startsWith("shipped") || normalized === "delivered";
}

interface InventoryFormUpdate {
  readonly productId: number;
  readonly productName: string;
  readonly productConditionId: number;
  readonly conditionId: number;
  readonly channelId: number;
  readonly categoryName: string;
  /** Absolute post-add quantity, matching Seller Portal's computed newQty. */
  readonly quantity: number;
  readonly addQuantity: number;
  readonly price: number;
  readonly storePriceCustomId: number | null;
  readonly reserveQuantity: number;
}

export function buildInventoryUpdateForm(
  updates: readonly InventoryFormUpdate[],
): {
  readonly form: URLSearchParams;
  readonly productConditionIds: number[];
} {
  const form = new URLSearchParams();
  const listingKeys = new Set<string>();
  const productConditionIds: number[] = [];
  updates.forEach((update, index) => {
    if (typeof update !== "object" || update === null) {
      throw invalidArgument(`updates[${index}] must be an object.`);
    }
    const path = `productQuantityPrices[${index}]`;
    const productId = boundedInteger(
      `updates[${index}].productId`,
      update.productId,
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const productConditionId = boundedInteger(
      `updates[${index}].productConditionId`,
      update.productConditionId,
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const conditionId = boundedInteger(
      `updates[${index}].conditionId`,
      update.conditionId,
      0,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const channelId = boundedInteger(
      `updates[${index}].channelId`,
      update.channelId,
      0,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    const quantity = boundedInteger(
      `updates[${index}].quantity`,
      update.quantity,
      0,
      0,
      10_000_000,
    );
    const addQuantity = boundedInteger(
      `updates[${index}].addQuantity`,
      update.addQuantity,
      0,
      0,
      10_000_000,
    );
    const price = finiteNumber(
      `updates[${index}].price`,
      update.price,
      0.01,
      1_000_000,
    );
    if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-9) {
      throw invalidArgument(
        `updates[${index}].price must have at most two decimal places.`,
      );
    }
    const reserveQuantity = finiteNumber(
      `updates[${index}].reserveQuantity`,
      update.reserveQuantity,
      0,
      10_000_000,
    );
    const storePriceCustomId =
      update.storePriceCustomId === null
        ? null
        : boundedInteger(
            `updates[${index}].storePriceCustomId`,
            update.storePriceCustomId,
            0,
            0,
            Number.MAX_SAFE_INTEGER,
          );
    const key = `${productConditionId}:${channelId}`;
    if (listingKeys.has(key)) {
      throw invalidArgument(
        "updates must not contain duplicate productConditionId/channelId pairs.",
      );
    }
    listingKeys.add(key);
    productConditionIds.push(productConditionId);

    appendFormValue(form, `${path}[ProductId]`, productId);
    appendFormValue(
      form,
      `${path}[ProductName]`,
      requiredText(`updates[${index}].productName`, update.productName, 1024),
    );
    appendFormValue(form, `${path}[AddToQuantity]`, addQuantity);
    const conditionPath = `${path}[ConditionQuantityPrices][0]`;
    appendFormValue(
      form,
      `${conditionPath}[ProductConditionId]`,
      productConditionId,
    );
    appendFormValue(form, `${conditionPath}[ConditionId]`, conditionId);
    appendFormValue(form, `${conditionPath}[ChannelId]`, channelId);
    appendFormValue(
      form,
      `${conditionPath}[CategoryName]`,
      requiredText(`updates[${index}].categoryName`, update.categoryName, 256),
    );
    appendFormValue(form, `${conditionPath}[Quantity]`, quantity);
    appendFormValue(form, `${conditionPath}[Price]`, price.toFixed(2));
    appendFormValue(form, `${conditionPath}[ExistingQuantity]`, 0);
    appendFormValue(
      form,
      `${conditionPath}[StorePriceCustomId]`,
      storePriceCustomId,
    );
    appendFormValue(form, `${conditionPath}[ReserveQuantity]`, reserveQuantity);
  });
  appendFormValue(form, "type", "Pricing");
  appendFormValue(form, "isStaged", false);
  return { form, productConditionIds };
}
