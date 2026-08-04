import { createServerFn } from "@tanstack/react-start"
import type { CategoryPricingRule } from "@/types/pricing"
import { db } from "@/server/db/client"
import { categoryPricingRules } from "@/server/db/schema"

export const listCategoryPricingRules = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<CategoryPricingRule>> => {
    return db.select().from(categoryPricingRules).all()
  }
)

export const saveCategoryPricingRuleFn = createServerFn({ method: "POST" })
  .inputValidator((data: Omit<CategoryPricingRule, "updatedAt">) => data)
  .handler(async ({ data }): Promise<void> => {
    db.insert(categoryPricingRules)
      .values({ ...data, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: categoryPricingRules.category,
        set: {
          marginPercent: data.marginPercent,
          vendorShippingRate: data.vendorShippingRate,
          vendorProcessingFee: data.vendorProcessingFee,
          updatedAt: new Date().toISOString(),
        },
      })
      .run()
  })
