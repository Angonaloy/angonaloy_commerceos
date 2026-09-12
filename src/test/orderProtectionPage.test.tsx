import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import userEvent from "@testing-library/user-event";

const { fetchProtectionReviews, updateProtectionReview } = vi.hoisted(() => ({
  fetchProtectionReviews: vi.fn(),
  updateProtectionReview: vi.fn(),
}));

vi.mock("@/lib/orderProtection", () => ({
  fetchProtectionReviews,
  updateProtectionReview,
}));

import OrderProtection from "@/pages/OrderProtection";

describe("order protection dashboard", () => {
  beforeEach(() => {
    fetchProtectionReviews.mockResolvedValue({ reviews: [{
      id: "review-1",
      status: "on_hold",
      score: 65,
      reason_codes: ["phone_velocity_15m", "phone_network_change"],
      customer_name: "Rahim Uddin",
      phone: "01712345678",
      address: "House 1, Dhanmondi, Dhaka",
      items: [
        { productName: "Katimon Mango", variantName: "6KG", quantity: 2, unitPrice: 1180 },
        { product_name: "Honey", quantity: 1, unit_price: 800 },
      ],
      source_route: "public_v1",
      created_at: "2026-09-12T08:00:00.000Z",
    }] });
    updateProtectionReview.mockResolvedValue({ orderRef: "ML-1001" });
  });

  test("shows the abandoned-style held order row with protection details", async () => {
    render(<OrderProtection />);

    expect(await screen.findByText("Rahim Uddin")).toBeInTheDocument();
    expect(screen.getByText("On hold")).toBeInTheDocument();
    expect(screen.getByText("Storefront checkout")).toBeInTheDocument();
    expect(screen.getByText("65")).toBeInTheDocument();
    expect(screen.getByText("2 × Katimon Mango — 6KG · ৳1,180")).toBeInTheDocument();
    expect(screen.getByText("1 × Honey · ৳800")).toBeInTheDocument();
    expect(screen.getByText("phone_velocity_15m")).toBeInTheDocument();
    expect(screen.getByText("phone_network_change")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select all reviews" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /call 01712345678/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open whatsapp for 01712345678/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy review summary/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /contact status: awaiting contact/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dismiss review/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  test("maps Dismiss to the existing protection reject mutation after confirmation", async () => {
    const user = userEvent.setup();
    render(<OrderProtection />);

    await user.click(await screen.findByRole("button", { name: /dismiss review/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Dismiss held review?")).toBeInTheDocument();
    expect(updateProtectionReview).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /confirm dismiss/i }));
    await waitFor(() => expect(updateProtectionReview).toHaveBeenCalledWith("review-1", "reject"));
    expect(screen.queryByText("Rahim Uddin")).not.toBeInTheDocument();
  });
});
