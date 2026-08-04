import { createServerFn } from "@tanstack/react-start"
import { desc, eq, inArray } from "drizzle-orm"
import type { Product } from "@/types/product"
import type { EtsyListingFields } from "@/types/channel-listing"
import { computeCategoryPrice, roundToCents } from "@/lib/pricing"
import { defaultEtsyFields } from "@/lib/channel-registry"
import { db } from "@/server/db/client"
import { categoryPricingRules, channelDefaults, channelListings, products } from "@/server/db/schema"

// Duplicated from server/channel-listings.ts rather than imported — a plain
// (non-createServerFn) function shared across server files here confused
// the client/server code-split and leaked db/better-sqlite3 into the
// browser bundle (`util.promisify is not a function`).
function etsyFieldsForNewListing(): EtsyListingFields {
  const row = db.select().from(channelDefaults).where(eq(channelDefaults.channel, "etsy")).get()
  const defaults = row?.fields ?? defaultEtsyFields()
  return { ...defaults, tags: [], materials: [] }
}

export const listProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<Product>> => {
    const rows = db.select().from(products).orderBy(desc(products.importedAt)).all()
    return rows.map((row) => ({
      ...row,
      imagePrompt: row.imagePrompt ?? undefined,
      imagePromptGeneratedAt: row.imagePromptGeneratedAt ?? undefined,
    }))
  }
)

export const createProducts = createServerFn({ method: "POST" })
  .inputValidator((data: { products: Array<Product> }) => data)
  .handler(async ({ data }): Promise<void> => {
    if (data.products.length === 0) return
    db.insert(products).values(data.products).run()

    const categories = Array.from(new Set(data.products.map((p) => p.category)))
    const rules = db
      .select()
      .from(categoryPricingRules)
      .where(inArray(categoryPricingRules.category, categories))
      .all()
    const ruleByCategory = new Map(rules.map((rule) => [rule.category, rule]))
    const now = new Date().toISOString()

    for (const product of data.products) {
      const rule = ruleByCategory.get(product.category)
      if (!rule) continue
      const price = computeCategoryPrice(product.price, rule)
      if (price === null) continue

      db.insert(channelListings)
        .values({
          id: crypto.randomUUID(),
          productId: product.id,
          channel: "etsy",
          status: "draft",
          overrides: { price: roundToCents(price) },
          fields: etsyFieldsForNewListing(),
          updatedAt: now,
        })
        .run()
    }
  })

export const updateProductFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; patch: Partial<Product> }) => data)
  .handler(async ({ data }): Promise<void> => {
    db.update(products).set(data.patch).where(eq(products.id, data.id)).run()
  })

export const deleteProducts = createServerFn({ method: "POST" })
  .inputValidator((data: { ids: Array<string> }) => data)
  .handler(async ({ data }): Promise<void> => {
    if (data.ids.length === 0) return
    db.delete(products).where(inArray(products.id, data.ids)).run()
  })
