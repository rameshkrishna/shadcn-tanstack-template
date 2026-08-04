import type { CategoryPricingRule } from "@/types/pricing"

// Selling price = (scraped price + vendor shipping + vendor processing fee) / (1 - margin)
export function computeCategoryPrice(
  scrapedPrice: number,
  rule: Pick<CategoryPricingRule, "marginPercent" | "vendorShippingRate" | "vendorProcessingFee">
): number | null {
  const marginFraction = rule.marginPercent / 100
  if (marginFraction >= 1) return null
  const totalCost = scrapedPrice + rule.vendorShippingRate + rule.vendorProcessingFee
  return totalCost / (1 - marginFraction)
}

export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}
