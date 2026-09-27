import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isDefaultVariant,
  productPriceDisplayLines,
  productPriceSortValue,
  realVariants,
  type Product,
  type ProductVariant,
} from "../pages/products/shared";

function variant(id: string, attributes: Record<string, string>, priceAdjustment = 0): ProductVariant {
  return {
    id,
    product_id: "product-1",
    attributes,
    cog: 0,
    stock_quantity: 3,
    price_adjustment: priceAdjustment,
    weight_kg: null,
    org_id: null,
    created_at: "2026-09-27T00:00:00.000Z",
  };
}

const baseProduct: Product = {
  id: "product-1",
  name: "Simple Product",
  slug: null,
  description: null,
  url: null,
  image_url: null,
  selling_price: 1000,
  compare_at_price: null,
  cog: 0,
  stock_quantity: 7,
  weight_kg: null,
  warehouse_id: null,
  source_url: null,
  published: true,
  published_at: null,
  created_at: "2026-09-27T00:00:00.000Z",
  variants: [],
  images: [],
};

describe("default variant dashboard helpers", () => {
  it("treats empty or missing attributes as the default variant", () => {
    expect(isDefaultVariant(variant("d", {}))).toBe(true);
    expect(isDefaultVariant({ ...variant("n", {}), attributes: null as unknown as Record<string, string> })).toBe(true);
    expect(isDefaultVariant({ ...variant("u", {}), attributes: undefined as unknown as Record<string, string> })).toBe(true);
    expect(isDefaultVariant(variant("r", { size: "M" }))).toBe(false);
  });

  it("filters default variants out of realVariants", () => {
    const real = variant("r", { size: "M" });
    expect(realVariants({ ...baseProduct, variants: [variant("d", {})] })).toEqual([]);
    expect(realVariants({ ...baseProduct, variants: [variant("d", {}), real] })).toEqual([real]);
  });

  it("prices a default-only product like a simple product", () => {
    const product: Product = { ...baseProduct, variants: [variant("d", {}, 250)] };
    expect(productPriceDisplayLines(product)).toEqual(["৳1,000"]);
    expect(productPriceSortValue(product)).toBe(1000);
  });
});

describe("dashboard wiring for default variants", () => {
  const productEdit = readFileSync(resolve(__dirname, "../pages/ProductEdit.tsx"), "utf8");
  const products = readFileSync(resolve(__dirname, "../pages/Products.tsx"), "utf8");
  const serverSource = readFileSync(resolve(__dirname, "../../server/index.js"), "utf8");

  it("ProductEdit only sends stock_quantity when the stock input changed", () => {
    const editForm = productEdit.slice(productEdit.indexOf("function EditForm("));
    expect(editForm).toContain("const initialStock = String(product.stock_quantity ?? 0);");
    expect(editForm).toContain("...(stock !== initialStock ? { stock_quantity: Math.max(0, parseInt(stock, 10) || 0) } : {})");
    expect(editForm).not.toContain("          stock_quantity: Math.max(0, parseInt(stock, 10) || 0),");
  });

  it("ProductEdit and Products list only real variants", () => {
    expect(productEdit).toContain("realVariants(product).length > 0 ? realVariants(product).map((variant) =>");
    expect(productEdit).not.toContain("product.variants.map(");
    expect(products).not.toMatch(/\bp(roduct)?\.variants\b/);
  });

  it("publish-all ensures default variants before flipping published", () => {
    const start = serverSource.indexOf('app.post("/api/products/publish-all"');
    const publishAll = serverSource.slice(start, serverSource.indexOf('app.post("/api/products/:id/images"', start));
    const ensureAt = publishAll.indexOf("ensureDefaultVariantFor(supabase, orgId, product.id)");
    const updateAt = publishAll.indexOf(".update({ published: true");
    expect(publishAll).toContain("await Promise.all(");
    expect(ensureAt).toBeGreaterThan(-1);
    expect(updateAt).toBeGreaterThan(ensureAt);
  });
});
