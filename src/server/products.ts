import { createServerFn } from "@tanstack/react-start"
import { desc, eq, inArray } from "drizzle-orm"
import type { Product } from "@/types/product"
import { db } from "@/server/db/client"
import { products } from "@/server/db/schema"

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
