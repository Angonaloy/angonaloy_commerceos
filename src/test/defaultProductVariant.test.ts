import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureDefaultProductVariant, isDefaultVariantAttributes } from "../../server/defaultProductVariant.js";

type Result = { data: unknown; error: unknown };

interface FakeConfig {
  existingVariants?: unknown[];
  product?: { cog: unknown } | null;
  insertResult?: Result;
}

function createFakeSupabase(config: FakeConfig) {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const filters: Array<{ table: string; column: string; value: unknown }> = [];

  const from = (table: string) => {
    let inserting = false;
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push({ table, column, value });
        return builder;
      },
      limit: async (): Promise<Result> => ({ data: config.existingVariants ?? [], error: null }),
      maybeSingle: async (): Promise<Result> => ({ data: config.product ?? null, error: null }),
      insert: (row: Record<string, unknown>) => {
        inserting = true;
        inserts.push({ table, row });
        return builder;
      },
      single: async (): Promise<Result> => {
        if (inserting) {
          return config.insertResult ?? { data: { id: "variant-new", ...inserts[inserts.length - 1].row }, error: null };
        }
        return { data: null, error: null };
      },
    };
    return builder;
  };

  return { client: { from }, inserts, filters };
}

describe("ensureDefaultProductVariant", () => {
  it("does nothing when the product already has a variant", async () => {
    const fake = createFakeSupabase({ existingVariants: [{ id: "v1" }], product: { cog: 50 } });
    const result = await ensureDefaultProductVariant(fake.client, "org-1", "prod-1", { stockQuantity: 5 });
    expect(result).toBeNull();
    expect(fake.inserts).toHaveLength(0);
    expect(fake.filters).toContainEqual({ table: "product_variants", column: "org_id", value: "org-1" });
  });

  it("inserts an org-scoped default variant with product cog and given stock", async () => {
    const fake = createFakeSupabase({ product: { cog: "120.5" } });
    const result = await ensureDefaultProductVariant(fake.client, "org-1", "prod-1", { stockQuantity: "7" });
    expect(fake.inserts).toEqual([
      {
        table: "product_variants",
        row: {
          product_id: "prod-1",
          org_id: "org-1",
          attributes: {},
          cog: 120.5,
          stock_quantity: 7,
          price_adjustment: 0,
        },
      },
    ]);
    expect(result).toMatchObject({ id: "variant-new", attributes: {}, stock_quantity: 7 });
    expect(fake.filters).toContainEqual({ table: "products", column: "org_id", value: "org-1" });
  });

  it("falls back to legacy stock when no stock quantity is given", async () => {
    const fake = createFakeSupabase({ product: { cog: null } });
    await ensureDefaultProductVariant(fake.client, "org-1", "prod-1", { getLegacyStock: async () => 12 });
    expect(fake.inserts[0].row).toMatchObject({ stock_quantity: 12, cog: 0 });
  });

  it("clamps negative or missing stock to zero", async () => {
    const fake = createFakeSupabase({ product: { cog: 10 } });
    await ensureDefaultProductVariant(fake.client, "org-1", "prod-1", { stockQuantity: -3 });
    expect(fake.inserts[0].row).toMatchObject({ stock_quantity: 0 });

    const fake2 = createFakeSupabase({ product: { cog: 10 } });
    await ensureDefaultProductVariant(fake2.client, "org-1", "prod-1");
    expect(fake2.inserts[0].row).toMatchObject({ stock_quantity: 0 });
  });

  it("returns null when the product is not found in the org", async () => {
    const fake = createFakeSupabase({ product: null });
    const result = await ensureDefaultProductVariant(fake.client, "org-1", "missing", { stockQuantity: 3 });
    expect(result).toBeNull();
    expect(fake.inserts).toHaveLength(0);
  });

  it("throws when the insert fails", async () => {
    const fake = createFakeSupabase({ product: { cog: 1 }, insertResult: { data: null, error: new Error("boom") } });
    await expect(ensureDefaultProductVariant(fake.client, "org-1", "prod-1", { stockQuantity: 1 })).rejects.toThrow("boom");
  });
});

describe("isDefaultVariantAttributes", () => {
  it("treats empty objects and missing attributes as default", () => {
    expect(isDefaultVariantAttributes({})).toBe(true);
    expect(isDefaultVariantAttributes(null)).toBe(true);
    expect(isDefaultVariantAttributes(undefined)).toBe(true);
  });

  it("treats non-empty objects and non-objects as not default", () => {
    expect(isDefaultVariantAttributes({ size: "M" })).toBe(false);
    expect(isDefaultVariantAttributes([])).toBe(false);
    expect(isDefaultVariantAttributes("size")).toBe(false);
  });
});

describe("default variant wiring", () => {
  const serverSource = readFileSync(resolve(process.cwd(), "server/index.js"), "utf8");
  const aiActionsSource = readFileSync(resolve(process.cwd(), "server/ai-actions.js"), "utf8");
  const between = (start: string, end: string) =>
    serverSource.slice(serverSource.indexOf(start), serverSource.indexOf(end, serverSource.indexOf(start)));

  it("imports the helper module", () => {
    expect(serverSource).toContain('from "./defaultProductVariant.js"');
  });

  it("gives saved products without variants a default variant", () => {
    const saveRoute = between('app.post("/api/products/save"', 'app.post("/api/products/crawl"');
    expect(saveRoute).toContain("ensureDefaultVariantFor(supabase, orgId, savedProduct.id");
  });

  it("heals products on edit before syncing stock", () => {
    const patchRoute = between('app.patch("/api/products/:id"', 'app.delete("/api/products/:id"');
    const ensureAt = patchRoute.indexOf("ensureDefaultVariantFor(supabase, orgId, req.params.id)");
    const stockAt = patchRoute.indexOf("saveProductStock(orgId, req.params.id");
    expect(ensureAt).toBeGreaterThan(-1);
    expect(stockAt).toBeGreaterThan(ensureAt);
  });

  it("ensures default variants on publish-all", () => {
    const publishAll = between('app.post("/api/products/publish-all"', 'app.post("/api/products/:id/images"');
    expect(publishAll).toContain("ensureDefaultVariantFor(supabase, orgId, product.id)");
  });

  it("converts a lone default variant when adding the first real variant", () => {
    const addVariant = between('app.post("/api/products/:id/variants"', 'app.patch("/api/products/:id/variants/:variantId"');
    expect(addVariant).toContain("isDefaultVariantAttributes(existingVariants[0].attributes)");
    expect(addVariant).toContain(".update(variantFields)");
    expect(addVariant).toContain('.eq("org_id", orgId)');
  });

  it("recreates a default variant after deleting the last variant", () => {
    const deleteVariant = between('app.delete("/api/products/:id/variants/:variantId"', "async function ensureAppSettingsTable");
    expect(deleteVariant).toContain("ensureDefaultVariantFor(supabase, orgId, req.params.id, { stockQuantity: 0 })");
  });

  it("syncs simple-product stock to the default variant", () => {
    const saveStock = between("async function saveProductStock", "async function ensureDefaultVariantFor");
    expect(saveStock).toContain("isDefaultVariantAttributes(variants[0].attributes)");
    expect(saveStock).toContain('.eq("org_id", orgId)');
  });

  it("exposes the helper to AI actions and uses it in create/update product", () => {
    expect(serverSource).toContain("ensureDefaultProductVariant: (supabase, orgId, productId, opts) => ensureDefaultVariantFor(supabase, orgId, productId, opts)");
    expect(aiActionsSource).toContain("helpers.ensureDefaultProductVariant?.(supabase, orgId, product.id, { stockQuantity: args.stock_quantity })");
    expect(aiActionsSource).toContain("helpers.ensureDefaultProductVariant?.(supabase, orgId, args.product_id)");
  });
});
