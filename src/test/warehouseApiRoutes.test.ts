import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const server = readFileSync(resolve(process.cwd(), "server/index.js"), "utf8");

function routeSource(signature: string, nextSignature: string) {
  const start = server.indexOf(signature);
  const end = server.indexOf(nextSignature, start);
  return server.slice(start, end);
}

describe("warehouse API routes", () => {
  const sectionStart = server.indexOf("// ─── Warehouses");
  const sectionEnd = server.indexOf('app.get("/api/products"', sectionStart);
  const warehouseSection = server.slice(sectionStart, sectionEnd);
  const listRoute = routeSource('app.get("/api/warehouses"', 'app.post("/api/warehouses"');
  const createRoute = routeSource('app.post("/api/warehouses"', 'app.patch("/api/warehouses/:id"');
  const updateRoute = routeSource('app.patch("/api/warehouses/:id"', 'app.delete("/api/warehouses/:id"');
  const deleteRoute = routeSource('app.delete("/api/warehouses/:id"', 'app.get("/api/products"');

  it("registers the scoped CRUD routes", () => {
    expect(sectionStart).toBeGreaterThan(-1);
    expect(server).toContain('app.get("/api/warehouses"');
    expect(server).toContain('app.post("/api/warehouses"');
    expect(server).toContain('app.patch("/api/warehouses/:id"');
    expect(server).toContain('app.delete("/api/warehouses/:id"');
  });

  it("authenticates every route and resolves active warehouses in the current workspace", () => {
    for (const route of [listRoute, createRoute, updateRoute, deleteRoute]) {
      expect(route).toContain("await getUser(getToken(req))");
      expect(route).toContain('res.status(401).json({ error: "Unauthorized" })');
      expect(route).toContain("await getUserOrg(supabase, user.id)");
    }

    expect(warehouseSection).toContain("async function getActiveWarehouse");
    expect(warehouseSection).toContain('.eq("id", warehouseId)');
    expect(warehouseSection).toContain('.eq("org_id", orgId)');
    expect(warehouseSection).toContain('.is("deleted_at", null)');
    expect(createRoute).toContain("org_id: orgId");
    expect(updateRoute).toContain("const warehouseId = req.params.id");
    expect(updateRoute).toContain("await getActiveWarehouse(supabase, orgId, warehouseId)");
    expect(deleteRoute).toContain("const warehouseId = req.params.id");
    expect(deleteRoute).toContain("await getActiveWarehouse(supabase, orgId, warehouseId)");
  });

  it("lists active warehouses with org-scoped product counts", () => {
    expect(listRoute).toContain('.from("warehouses")');
    expect(listRoute).toContain('.eq("org_id", orgId)');
    expect(listRoute).toContain('.is("deleted_at", null)');
    expect(listRoute).toContain('.from("products")');
    expect(listRoute).toContain("product_count");
  });

  it("uses the atomic default RPC after creating a non-default warehouse", () => {
    const insertedAsNonDefault = createRoute.indexOf("is_default: false");
    const setDefaultRpc = createRoute.indexOf('supabase.rpc("set_default_warehouse"');

    expect(insertedAsNonDefault).toBeGreaterThan(-1);
    expect(setDefaultRpc).toBeGreaterThan(insertedAsNonDefault);
    expect(createRoute).toContain("p_org_id: orgId");
    expect(createRoute).toContain("p_warehouse_id: warehouseId");
  });

  it("validates patch targets and only changes defaults through the atomic RPC", () => {
    expect(updateRoute).toContain("const makeDefault = req.body?.is_default === true");
    expect(updateRoute).toMatch(
      /if \(makeDefault\) \{[\s\S]*?supabase\.rpc\("set_default_warehouse", \{[\s\S]*?p_org_id: orgId,[\s\S]*?p_warehouse_id: warehouseId,/,
    );
    expect(updateRoute).not.toContain("updates.is_default");
    expect(updateRoute).not.toMatch(/\.update\(\{\s*is_default\s*:/);
  });

  it("refuses default deletion, unassigns scoped products, then soft-deletes", () => {
    const unassignProducts = deleteRoute.indexOf('.from("products")');
    const softDelete = deleteRoute.indexOf("deleted_at: new Date().toISOString()");

    expect(deleteRoute).toContain("Cannot delete the default warehouse");
    expect(deleteRoute).toContain("warehouse_id: null");
    expect(deleteRoute).toContain('.eq("org_id", orgId)');
    expect(unassignProducts).toBeGreaterThan(-1);
    expect(softDelete).toBeGreaterThan(unassignProducts);
  });
});
