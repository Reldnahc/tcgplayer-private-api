import type { SellerApiTransport } from "../transport.js";

export class SellerClientCore {
  constructor(protected readonly transport: SellerApiTransport) {}
}
