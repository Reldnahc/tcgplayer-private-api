import { TcgplayerApiError } from "./errors.js";
import type { PullSheetRow } from "./types.js";

const COLUMNS = [
  "Product Line",
  "Product Name",
  "Condition",
  "Number",
  "Set",
  "Rarity",
  "Quantity",
  "Main Photo URL",
  "Set Release Date",
  "SkuId",
  "Order Quantity",
] as const;

const MAXIMUM_ROWS = 10_000;
const MAXIMUM_FIELD_LENGTH = 4096;

export function parsePullSheetRows(text: string): readonly PullSheetRow[] {
  const records = parseCsv(text.replace(/^\uFEFF/u, ""));
  const header = records.shift();
  if (
    header === undefined ||
    header.length !== COLUMNS.length ||
    header.some((column, index) => column !== COLUMNS[index])
  ) {
    throw invalidPullSheet("unsupported column schema");
  }
  if (records.length > MAXIMUM_ROWS) {
    throw invalidPullSheet("too many product rows");
  }
  return records.map((record, index) => parseRow(record, index));
}

function parseRow(record: readonly string[], index: number): PullSheetRow {
  if (record.length !== COLUMNS.length) {
    throw invalidPullSheet(
      `row ${String(index + 1)} has the wrong column count`,
    );
  }
  return {
    productLine: textField(record[0], index, "Product Line"),
    productName: textField(record[1], index, "Product Name", true),
    condition: textField(record[2], index, "Condition"),
    number: textField(record[3], index, "Number"),
    setName: textField(record[4], index, "Set"),
    rarity: textField(record[5], index, "Rarity"),
    quantity: integerField(record[6], index, "Quantity"),
    mainPhotoUrl: textField(record[7], index, "Main Photo URL"),
    setReleaseDate: textField(record[8], index, "Set Release Date"),
    skuId: textField(record[9], index, "SkuId", true),
    orderQuantity: integerField(record[10], index, "Order Quantity"),
  };
}

function textField(
  value: string | undefined,
  rowIndex: number,
  column: string,
  required = false,
): string {
  if (value === undefined) {
    throw invalidPullSheet(`row ${String(rowIndex + 1)} is missing ${column}`);
  }
  const normalized = value.trim();
  if (
    normalized.length > MAXIMUM_FIELD_LENGTH ||
    (required && normalized.length === 0)
  ) {
    throw invalidPullSheet(
      `row ${String(rowIndex + 1)} has an invalid ${column}`,
    );
  }
  for (const character of normalized) {
    const code = character.charCodeAt(0);
    if (
      (code <= 0x1f && character !== "\n" && character !== "\t") ||
      code === 0x7f
    ) {
      throw invalidPullSheet(
        `row ${String(rowIndex + 1)} has an invalid ${column}`,
      );
    }
  }
  return normalized;
}

function integerField(
  value: string | undefined,
  rowIndex: number,
  column: string,
): number {
  const normalized = textField(value, rowIndex, column, true);
  if (!/^\d{1,9}$/u.test(normalized)) {
    throw invalidPullSheet(
      `row ${String(rowIndex + 1)} has an invalid ${column}`,
    );
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    throw invalidPullSheet(
      `row ${String(rowIndex + 1)} has an invalid ${column}`,
    );
  }
  return parsed;
}

function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let quoteClosed = false;

  const finishField = () => {
    record.push(field);
    field = "";
    quoteClosed = false;
  };
  const finishRecord = () => {
    finishField();
    records.push(record);
    record = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? "";
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else if (character === "\r" && text[index + 1] === "\n") {
        field += "\n";
        index += 1;
      } else {
        field += character;
      }
      continue;
    }
    if (quoteClosed) {
      if (character === ",") {
        finishField();
      } else if (character === "\r" || character === "\n") {
        finishRecord();
        if (character === "\r" && text[index + 1] === "\n") index += 1;
      } else {
        throw invalidPullSheet("malformed quoted field");
      }
      continue;
    }
    if (character === '"') {
      if (field.length !== 0) throw invalidPullSheet("malformed quoted field");
      quoted = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\r" || character === "\n") {
      finishRecord();
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw invalidPullSheet("unterminated quoted field");
  if (quoteClosed || field.length > 0 || record.length > 0) finishRecord();
  return records;
}

function invalidPullSheet(detail: string): TcgplayerApiError {
  return new TcgplayerApiError(
    "INVALID_RESPONSE",
    `TCGplayer returned an invalid pull sheet: ${detail}.`,
  );
}
