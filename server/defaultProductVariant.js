// Every product must have at least one product_variants row so public checkout
// (which prices and decrements stock per variant) can sell it. A "default"
// variant is a row with empty attributes ({}) and no price adjustment; the
// storefront labels it "Default".

export function isDefaultVariantAttributes(attributes) {
  if (attributes == null) return true;
  if (typeof attributes !== "object" || Array.isArray(attributes)) return false;
  return Object.keys(attributes).length === 0;
}

// Creates a default variant for the product when it has none. Returns the
// inserted row, or null when a variant already exists or the product is not
// found in this org. All queries are scoped to orgId.
export async function ensureDefaultProductVariant(supabase, orgId, productId, { stockQuantity, getLegacyStock } = {}) {
  const { data: existing, error: existingError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .eq("org_id", orgId)
    .limit(1);
  if (existingError) throw existingError;
  if (existing && existing.length > 0) return null;

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("cog")
    .eq("id", productId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) return null;

  let rawStock = stockQuantity;
  if (rawStock === undefined || rawStock === null) {
    rawStock = getLegacyStock ? await getLegacyStock() : 0;
  }
  const stock_quantity = Math.max(0, parseInt(rawStock, 10) || 0);

  const { data, error } = await supabase
    .from("product_variants")
    .insert({
      product_id: productId,
      org_id: orgId,
      attributes: {},
      cog: Math.max(0, parseFloat(product.cog) || 0),
      stock_quantity,
      price_adjustment: 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
