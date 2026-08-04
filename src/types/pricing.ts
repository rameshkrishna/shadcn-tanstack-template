export interface CategoryPricingRule {
  category: string
  marginPercent: number
  vendorShippingRate: number
  vendorProcessingFee: number
  updatedAt: string
}

export type CategoryPricingRulePatch = Partial<
  Omit<CategoryPricingRule, "category" | "updatedAt">
>
