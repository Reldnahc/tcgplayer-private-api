import { invalidArgument } from "../errors.js";
import type {
  AddSellerInventoryInput,
  AddSellerInventoryResult,
  RemoveSellerInventoryInput,
  RemoveSellerInventoryResult,
  RequestOptions,
  SellerInventoryAddition,
  SellerInventoryRemoval,
  UpdateSellerPricesInput,
  UpdateSellerPricesResult,
} from "../types.js";
import {
  boundedInteger,
  buildInventoryUpdateForm,
  requestSignal,
} from "./input.js";
import { SellerClientCore } from "./core.js";

const UPDATE_INVENTORY_PATH = "/admin/pricing/updateinventory";

export class SellerInventoryClient extends SellerClientCore {
  async updateSellerPrices(
    input: UpdateSellerPricesInput,
    options?: RequestOptions,
  ): Promise<UpdateSellerPricesResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Price-update input is required.");
    }
    if (
      !Array.isArray(input.updates) ||
      input.updates.length === 0 ||
      input.updates.length > 100
    ) {
      throw invalidArgument("updates must contain 1-100 price updates.");
    }

    const formUpdates = input.updates.map((update, index) => {
      if (typeof update !== "object" || update === null) {
        throw invalidArgument(`updates[${index}] must be an object.`);
      }
      return {
        ...update,
        addQuantity: 0,
      };
    });
    const { form, productConditionIds } = buildInventoryUpdateForm(formUpdates);

    await this.transport.sellerPortalFormCommand(
      UPDATE_INVENTORY_PATH,
      form,
      requestSignal(options),
    );
    return { submittedProductConditionIds: productConditionIds };
  }

  async addSellerInventory(
    input: AddSellerInventoryInput,
    options?: RequestOptions,
  ): Promise<AddSellerInventoryResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Inventory-add input is required.");
    }
    if (
      !Array.isArray(input.additions) ||
      input.additions.length === 0 ||
      input.additions.length > 100
    ) {
      throw invalidArgument(
        "additions must contain 1-100 inventory additions.",
      );
    }
    input.additions.forEach((addition: SellerInventoryAddition, index) => {
      if (typeof addition !== "object" || addition === null) {
        throw invalidArgument(`additions[${index}] must be an object.`);
      }
      const addQuantity = boundedInteger(
        `additions[${index}].addQuantity`,
        addition.addQuantity,
        0,
        1,
        10_000_000,
      );
      const currentQuantity = boundedInteger(
        `additions[${index}].currentQuantity`,
        addition.currentQuantity,
        0,
        0,
        10_000_000,
      );
      if (currentQuantity + addQuantity > 10_000_000) {
        throw invalidArgument(
          `additions[${index}] would exceed the supported quantity limit.`,
        );
      }
    });
    const formAdditions = input.additions.map((addition) => ({
      ...addition,
      quantity: addition.currentQuantity + addition.addQuantity,
    }));
    const { form, productConditionIds } =
      buildInventoryUpdateForm(formAdditions);
    await this.transport.sellerPortalFormCommand(
      UPDATE_INVENTORY_PATH,
      form,
      requestSignal(options),
    );
    return { submittedProductConditionIds: productConditionIds };
  }

  async removeSellerInventory(
    input: RemoveSellerInventoryInput,
    options?: RequestOptions,
  ): Promise<RemoveSellerInventoryResult> {
    if (typeof input !== "object" || input === null) {
      throw invalidArgument("Inventory-removal input is required.");
    }
    if (
      !Array.isArray(input.removals) ||
      input.removals.length === 0 ||
      input.removals.length > 100
    ) {
      throw invalidArgument("removals must contain 1-100 inventory removals.");
    }
    input.removals.forEach((removal: SellerInventoryRemoval, index) => {
      if (typeof removal !== "object" || removal === null) {
        throw invalidArgument(`removals[${index}] must be an object.`);
      }
      boundedInteger(
        `removals[${index}].currentQuantity`,
        removal.currentQuantity,
        0,
        1,
        10_000_000,
      );
      if (removal.reserveQuantity !== 0) {
        throw invalidArgument(
          `removals[${index}].reserveQuantity must be zero.`,
        );
      }
    });
    const formRemovals = input.removals.map((removal) => ({
      ...removal,
      addQuantity: 0,
      quantity: 0,
    }));
    const { form, productConditionIds } =
      buildInventoryUpdateForm(formRemovals);
    await this.transport.sellerPortalFormCommand(
      UPDATE_INVENTORY_PATH,
      form,
      requestSignal(options),
    );
    return { submittedProductConditionIds: productConditionIds };
  }
}
