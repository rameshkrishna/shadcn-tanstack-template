import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import type { EtsyDefaultFields } from "@/types/channel-listing"
import { defaultEtsyFields } from "@/lib/channel-registry"
import { db } from "@/server/db/client"
import { channelDefaults } from "@/server/db/schema"

function fallbackEtsyDefaults(): EtsyDefaultFields {
  const defaults = defaultEtsyFields()
  return {
    whoMade: defaults.whoMade,
    whenMade: defaults.whenMade,
    isSupply: defaults.isSupply,
    taxonomyCategory: defaults.taxonomyCategory,
    shippingProfile: defaults.shippingProfile,
    renewalOption: defaults.renewalOption,
    personalization: defaults.personalization,
    personalizationInstructions: defaults.personalizationInstructions,
    primaryColor: defaults.primaryColor,
    secondaryColor: defaults.secondaryColor,
  }
}

export const getEtsyDefaults = createServerFn({ method: "GET" }).handler(
  async (): Promise<EtsyDefaultFields> => {
    const row = db.select().from(channelDefaults).where(eq(channelDefaults.channel, "etsy")).get()
    return row?.fields ?? fallbackEtsyDefaults()
  }
)

export const updateEtsyDefaults = createServerFn({ method: "POST" })
  .inputValidator((data: EtsyDefaultFields) => data)
  .handler(async ({ data }): Promise<void> => {
    db.insert(channelDefaults)
      .values({ channel: "etsy", fields: data, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: channelDefaults.channel,
        set: { fields: data, updatedAt: new Date().toISOString() },
      })
      .run()
  })
