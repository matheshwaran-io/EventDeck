export type TierForPricing = { id: string; pricePaise: number; capacity: number; allocated: number };
export type LineRequest = { tierId: string; quantity: number };

export class PricingError extends Error {}

/** Server-side order pricing. Prices always come from the database rows passed in. */
export function priceOrder(lines: LineRequest[], tiers: TierForPricing[], maxPerBooking: number) {
  const merged = new Map<string, number>();
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 0) throw new PricingError("Invalid quantity");
    if (l.quantity === 0) continue;
    merged.set(l.tierId, (merged.get(l.tierId) ?? 0) + l.quantity);
  }
  const quantity = [...merged.values()].reduce((a, b) => a + b, 0);
  if (quantity === 0) throw new PricingError("Select at least one ticket.");
  if (quantity > maxPerBooking) throw new PricingError(`You can book up to ${maxPerBooking} tickets per booking.`);

  const items = [...merged.entries()].map(([tierId, qty]) => {
    const tier = tiers.find((t) => t.id === tierId);
    if (!tier) throw new PricingError("That ticket type is not available.");
    return { tierId, quantity: qty, unitPricePaise: tier.pricePaise };
  });
  const amountPaise = items.reduce((sum, i) => sum + i.unitPricePaise * i.quantity, 0);
  return { items, quantity, amountPaise };
}
