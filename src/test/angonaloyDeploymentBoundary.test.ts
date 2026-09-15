import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Angonaloy deployment boundary", () => {
  it("shows the canonical Angonaloy webhook URL in integration settings", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/IntegrationSettings.tsx"),
      "utf8",
    );

    expect(source).toContain(
      "POST https://angonaloy-commerceos.vercel.app/api/custom-orders/webhook",
    );
    expect(source).toContain(
      "https://angonaloy-commerceos.vercel.app/api/webhooks/facebook",
    );
    expect(source).toContain(
      "https://angonaloy-commerceos.vercel.app/api/webhooks/whatsapp",
    );
    expect(source).toContain(
      "https://angonaloy-commerceos.vercel.app/api/auth/shopify/callback",
    );
    expect(source).not.toContain("suite.arclabtechnology.com");
    expect(source).not.toContain("https://merchant-suite.com/api/");
  });
});
