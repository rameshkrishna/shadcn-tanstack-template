import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import type { ChannelId, ChannelListing, ChannelListingPatch, EtsyListingFields } from "@/types/channel-listing"
import { defaultEtsyFields } from "@/lib/channel-registry"
import { db } from "@/server/db/client"
import { channelDefaults, channelListings } from "@/server/db/schema"

function fieldsForChannel(channel: ChannelId): EtsyListingFields {
  switch (channel) {
    case "etsy": {
      const row = db.select().from(channelDefaults).where(eq(channelDefaults.channel, "etsy")).get()
      const defaults = row?.fields ?? defaultEtsyFields()
      return { ...defaults, tags: [], materials: [] }
    }
  }
}

export const listChannelListings = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<ChannelListing>> => {
    return db.select().from(channelListings).all()
  }
)

export const upsertChannelListingFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { productId: string; channel: ChannelId; patch: ChannelListingPatch }) => data
  )
  .handler(async ({ data }): Promise<void> => {
    const existing = db
      .select()
      .from(channelListings)
      .where(
        and(eq(channelListings.productId, data.productId), eq(channelListings.channel, data.channel))
      )
      .get()

    if (existing) {
      db.update(channelListings)
        .set({
          status: data.patch.status ?? existing.status,
          overrides: data.patch.overrides
            ? { ...existing.overrides, ...data.patch.overrides }
            : existing.overrides,
          fields: data.patch.fields ? { ...existing.fields, ...data.patch.fields } : existing.fields,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(channelListings.id, existing.id))
        .run()
      return
    }

    const defaultFields = fieldsForChannel(data.channel)
    db.insert(channelListings)
      .values({
        id: crypto.randomUUID(),
        productId: data.productId,
        channel: data.channel,
        status: data.patch.status ?? "draft",
        overrides: data.patch.overrides ?? {},
        fields: data.patch.fields ? { ...defaultFields, ...data.patch.fields } : defaultFields,
        updatedAt: new Date().toISOString(),
      })
      .run()
  })

export const removeChannelListingFn = createServerFn({ method: "POST" })
  .inputValidator((data: { productId: string; channel: ChannelId }) => data)
  .handler(async ({ data }): Promise<void> => {
    db.delete(channelListings)
      .where(
        and(eq(channelListings.productId, data.productId), eq(channelListings.channel, data.channel))
      )
      .run()
  })
