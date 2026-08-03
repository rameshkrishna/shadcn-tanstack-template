import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"
import type { ProductStatus } from "@/types/product"
import type { ChannelId, ChannelListingOverrides, EtsyListingFields } from "@/types/channel-listing"

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  price: real("price").notNull(),
  currency: text("currency").notNull(),
  stock: integer("stock").notNull(),
  status: text("status").$type<ProductStatus>().notNull(),
  vendorName: text("vendor_name").notNull(),
  importUrl: text("import_url").notNull(),
  sourceUrl: text("source_url").notNull(),
  importedAt: text("imported_at").notNull(),
  imagePrompt: text("image_prompt"),
  imagePromptGeneratedAt: text("image_prompt_generated_at"),
})

export const channelListings = sqliteTable("channel_listings", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  channel: text("channel").$type<ChannelId>().notNull(),
  status: text("status").$type<"draft" | "ready" | "exported">().notNull(),
  overrides: text("overrides", { mode: "json" }).$type<ChannelListingOverrides>().notNull(),
  fields: text("fields", { mode: "json" }).$type<EtsyListingFields>().notNull(),
  updatedAt: text("updated_at").notNull(),
})
