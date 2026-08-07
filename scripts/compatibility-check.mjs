import {
  createTcgplayerSellerClient,
  isTcgplayerApiError,
} from "../dist/index.js";
import process from "node:process";

function writeOutput(message) {
  process.stdout.write(`${message}\n`);
}

function writeError(message) {
  process.stderr.write(`${message}\n`);
}

const authCookie = process.env.TCGPLAYER_AUTH_COOKIE;
const sellerKey = process.env.TCGPLAYER_SELLER_KEY;
const orderNumber = process.env.TCGPLAYER_ORDER_NUMBER;
const checkPackingSlip = process.env.TCGPLAYER_CHECK_PACKING_SLIP === "1";
const checkPullSheet = process.env.TCGPLAYER_CHECK_PULL_SHEET === "1";

if (!authCookie || !sellerKey) {
  writeError(
    "Set TCGPLAYER_AUTH_COOKIE and TCGPLAYER_SELLER_KEY to run the opt-in compatibility check.",
  );
  process.exitCode = 2;
} else if ((checkPackingSlip || checkPullSheet) && !orderNumber) {
  writeError(
    "TCGPLAYER_ORDER_NUMBER is required when a document compatibility check is enabled.",
  );
  process.exitCode = 2;
} else {
  const client = createTcgplayerSellerClient({
    session: { authCookie },
  });

  try {
    const search = await client.searchOrders({
      sellerKey,
      statuses: ["ReadyToShip"],
      limit: 1,
    });
    writeOutput(
      `Order search compatible; remote reported ${search.totalOrders} matching order(s).`,
    );

    const inventory = await client.listSellerInventory({ sellerKey });
    writeOutput(
      `Seller inventory search compatible; remote reported ${inventory.length} product(s).`,
    );

    const feedback = await client.listSellerFeedback({
      sellerKey,
      offset: 0,
      rows: 1,
    });
    const feedbackSummary = await client.getSellerFeedbackAggregation({
      sellerKey,
    });
    writeOutput(
      `Seller feedback compatible; remote reported ${feedback.totalFeedback} feedback item(s) and ${feedbackSummary.totalRatings} aggregate rating(s).`,
    );

    if (orderNumber) {
      await client.confirmOrder({ sellerKey, orderNumber });
      writeOutput("Exact-order confirmation compatible.");

      if (checkPackingSlip) {
        const packingSlip = await client.getPackingSlip({
          orderNumber,
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        });
        writeOutput(
          `Packing-slip export compatible; received ${packingSlip.bytes.byteLength} PDF byte(s).`,
        );
      }

      if (checkPullSheet) {
        const pullSheet = await client.exportPullSheet({
          orderNumbers: [orderNumber],
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        });
        writeOutput(
          `Pull-sheet export compatible; received ${pullSheet.text.length} UTF-8 character(s).`,
        );
      }
    }
  } catch (error) {
    if (isTcgplayerApiError(error)) {
      writeError(
        `Compatibility check failed: ${JSON.stringify({
          code: error.code,
          status: error.status,
          retryable: error.retryable,
          requestId: error.requestId,
        })}`,
      );
    } else {
      writeError("Compatibility check failed with an unexpected local error.");
    }
    process.exitCode = 1;
  }
}
