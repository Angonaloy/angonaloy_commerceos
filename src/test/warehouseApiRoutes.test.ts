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

  it("validates warehouse IDs and typed payloads before database access", () => {
    expect(warehouseSection).toContain("function isValidWarehouseId");
    expect(warehouseSection).toContain('typeof body.name !== "string"');
    expect(warehouseSection).toContain('value !== null && typeof value !== "string"');
    expect(warehouseSection).toContain('typeof body.is_default !== "boolean"');

    expect(createRoute).toContain("validateWarehouseInput(req.body, { requireName: true })");
    expect(updateRoute).toContain("validateWarehouseInput(req.body)");
    for (const route of [updateRoute, deleteRoute]) {
      expect(route).toContain("if (!isValidWarehouseId(warehouseId))");
      expect(route).toContain('res.status(400).json({ error: "Invalid warehouse ID" })');
    }

    expect(createRoute.indexOf("validateWarehouseInput")).toBeLessThan(createRoute.indexOf("getServiceSupabase"));
    expect(updateRoute.indexOf("validateWarehouseInput")).toBeLessThan(updateRoute.indexOf("getServiceSupabase"));
    expect(deleteRoute.indexOf("isValidWarehouseId")).toBeLessThan(deleteRoute.indexOf("getServiceSupabase"));
  });

  it("lists active warehouses with org-scoped product counts and defaults only unassigned products", () => {
    expect(listRoute).toContain('.from("warehouses")');
    expect(listRoute).toContain('.eq("org_id", orgId)');
    expect(listRoute).toContain('.is("deleted_at", null)');
    expect(listRoute).toContain('.from("products")');
    expect(listRoute).toContain("product_count");
    expect(listRoute).toMatch(/if \(product\.warehouse_id\) \{[\s\S]*?\} else \{[\s\S]*?unassignedProducts \+= 1;/);
    expect(listRoute).toContain("warehouse.is_default ? unassignedProducts : 0");
  });

  it("uses the atomic default RPC after creating a non-default warehouse", () => {
    const insertedAsNonDefault = createRoute.indexOf("is_default: false");
    const setDefaultRpc = createRoute.indexOf('supabase.rpc("set_default_warehouse"');

    expect(warehouseSection).not.toContain("clearOtherDefaultWarehouses");
    expect(insertedAsNonDefault).toBeGreaterThan(-1);
    expect(setDefaultRpc).toBeGreaterThan(insertedAsNonDefault);
    expect(createRoute).toContain("p_org_id: orgId");
    expect(createRoute).toContain("p_warehouse_id: warehouseId");
  });

  it("does not clear a default on false and only promotes through the atomic RPC", () => {
    expect(warehouseSection).toContain("const isDefault = body.is_default === true");
    expect(updateRoute).toMatch(
      /if \(input\.isDefault\) \{[\s\S]*?supabase\.rpc\("set_default_warehouse", \{[\s\S]*?p_org_id: orgId,[\s\S]*?p_warehouse_id: warehouseId,/,
    );
    expect(updateRoute).not.toContain("updates.is_default");
    expect(updateRoute).not.toMatch(/\.update\(\{\s*is_default\s*:/);
    expect(updateRoute).not.toMatch(/is_default\s*:\s*false/);
  });

  it("keeps warehouse and product mutations within the active workspace", () => {
    expect(updateRoute).toMatch(
      /\.from\("warehouses"\)[\s\S]*?\.update\(updates\)[\s\S]*?\.eq\("id", warehouseId\)[\s\S]*?\.eq\("org_id", orgId\)[\s\S]*?\.is\("deleted_at", null\)/,
    );
    expect(deleteRoute).toMatch(
      /\.from\("products"\)[\s\S]*?\.update\(\{ warehouse_id: null \}\)[\s\S]*?\.eq\("org_id", orgId\)[\s\S]*?\.eq\("warehouse_id", warehouseId\)/,
    );
  });

  it("conditionally soft-deletes non-default warehouses before clearing products", () => {
    const unassignProducts = deleteRoute.indexOf('.from("products")');
    const softDelete = deleteRoute.indexOf("deleted_at: new Date().toISOString()");
    const conditionalDelete = deleteRoute.slice(softDelete, unassignProducts);

    expect(deleteRoute).toContain("Cannot delete the default warehouse");
    expect(deleteRoute).toContain("warehouse_id: null");
    expect(unassignProducts).toBeGreaterThan(-1);
    expect(softDelete).toBeGreaterThan(-1);
    expect(softDelete).toBeLessThan(unassignProducts);
    expect(conditionalDelete).toContain('.eq("org_id", orgId)');
    expect(conditionalDelete).toContain('.eq("is_default", false)');
    expect(conditionalDelete).toContain('.is("deleted_at", null)');
    expect(conditionalDelete).toContain('.select("id")');
    expect(deleteRoute).toContain("if (!deletedWarehouse)");
  });

  it("uses a safe error response for unexpected warehouse failures", () => {
    expect(warehouseSection).toContain("function sendWarehouseError");
    expect(warehouseSection).toContain('res.status(500).json({ error: "An internal error occurred" })');
    for (const route of [listRoute, createRoute, updateRoute, deleteRoute]) {
      expect(route).toContain("return sendWarehouseError(res, err)");
    }
  });
});
