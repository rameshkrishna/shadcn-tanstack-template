import { useSuspenseQuery } from "@tanstack/react-query"
import type { CategoryPricingRule } from "@/types/pricing"
import { getBrowserQueryClient } from "@/lib/query-client"
import { categoryPricingRulesQueryOptions } from "@/lib/queries"
import { saveCategoryPricingRuleFn } from "@/server/pricing"

function emptyRule(category: string): CategoryPricingRule {
  return { category, marginPercent: 0, vendorShippingRate: 0, vendorProcessingFee: 0, updatedAt: "" }
}

export function useCategoryPricingRules(): Array<CategoryPricingRule> {
  return useSuspenseQuery(categoryPricingRulesQueryOptions()).data
}

export function useCategoryPricingRule(category: string): CategoryPricingRule {
  const rules = useCategoryPricingRules()
  return rules.find((r) => r.category === category) ?? emptyRule(category)
}

export async function saveCategoryPricingRule(rule: Omit<CategoryPricingRule, "updatedAt">) {
  await saveCategoryPricingRuleFn({ data: rule })
  await getBrowserQueryClient().invalidateQueries({ queryKey: ["category-pricing-rules"] })
}
