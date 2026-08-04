import { useSuspenseQuery } from "@tanstack/react-query"
import type { EtsyDefaultFields } from "@/types/channel-listing"
import { getBrowserQueryClient } from "@/lib/query-client"
import { etsyDefaultsQueryOptions } from "@/lib/queries"
import { updateEtsyDefaults } from "@/server/etsy-settings"

export function useEtsyDefaults(): EtsyDefaultFields {
  return useSuspenseQuery(etsyDefaultsQueryOptions()).data
}

export async function saveEtsyDefaults(fields: EtsyDefaultFields) {
  await updateEtsyDefaults({ data: fields })
  await getBrowserQueryClient().invalidateQueries({ queryKey: ["etsy-defaults"] })
}
