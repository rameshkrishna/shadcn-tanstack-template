import { useSuspenseQuery } from "@tanstack/react-query"
import type { ChannelId, ChannelListing, ChannelListingPatch } from "@/types/channel-listing"
import { queryClient } from "@/lib/query-client"
import { channelListingsQueryOptions } from "@/lib/queries"
import { removeChannelListingFn, upsertChannelListingFn } from "@/server/channel-listings"

export function useChannelListings(): Array<ChannelListing> {
  return useSuspenseQuery(channelListingsQueryOptions()).data
}

export function useChannelListing(
  productId: string | undefined,
  channel: ChannelId
): ChannelListing | undefined {
  const all = useChannelListings()
  return all.find((l) => l.productId === productId && l.channel === channel)
}

export function useChannelListingsForProduct(productId: string | undefined): Array<ChannelListing> {
  const all = useChannelListings()
  return all.filter((l) => l.productId === productId)
}

export async function upsertChannelListing(
  productId: string,
  channel: ChannelId,
  patch: ChannelListingPatch
) {
  await upsertChannelListingFn({ data: { productId, channel, patch } })
  await queryClient.invalidateQueries({ queryKey: ["channel-listings"] })
}

export async function removeChannelListing(productId: string, channel: ChannelId) {
  await removeChannelListingFn({ data: { productId, channel } })
  await queryClient.invalidateQueries({ queryKey: ["channel-listings"] })
}
