import { describe, expect, it } from "vitest";
import {
  calculateProtectionTotal,
  formatProtectionItem,
  formatProtectionTotal,
  normalizeProtectionItem,
  protectionSourceLabel,
  protectionTelHref,
  protectionWhatsAppHref,
} from "@/lib/orderProtectionDisplay";

describe("order protection display helpers", () => {
  it("normalizes product, variant, quantity, and price fields", () => {
    expect(normalizeProtectionItem({
      productName: "Katimon Mango",
      variantName: "6KG",
      quantity: 2,
      unitPrice: 1180,
    })).toEqual({ productName: "Katimon Mango", variantName: "6KG", quantity: 2, unitPrice: 1180 });
  });

  it("formats one product line with the quantity after the product", () => {
    expect(formatProtectionItem({
      product_name: "Honey",
      variant_name: "1 kg",
      quantity: 3,
      unit_price: 800,
    })).toBe("Honey — 1 kg × 3 · ৳800");
  });

  it("computes a total only from valid priced lines", () => {
    expect(calculateProtectionTotal([
      { productName: "Honey", quantity: 2, unitPrice: 800 },
      { productName: "Mango", quantity: 1, unitPrice: 1200 },
    ])).toBe(2800);
    expect(calculateProtectionTotal([{ productName: "Unknown", quantity: 1, unitPrice: null }])).toBeNull();
    expect(formatProtectionTotal(2800)).toBe("৳2,800");
    expect(formatProtectionTotal(null)).toBe("—");
  });

  it("uses English source labels and safe Bangladesh contact links", () => {
    expect(protectionSourceLabel("public_v1")).toBe("Storefront checkout");
    expect(protectionTelHref("01712345678")).toBe("tel:01712345678");
    expect(protectionWhatsAppHref("01712345678")).toBe("https://wa.me/8801712345678");
    expect(protectionTelHref("123")).toBeNull();
  });
});
