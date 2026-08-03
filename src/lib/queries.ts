import { queryOptions } from "@tanstack/react-query"
import { listChannelListings } from "@/server/channel-listings"
import { listProducts } from "@/server/products"

export function productsQueryOptions() {
  return queryOptions({
    queryKey: ["products"],
    queryFn: () => listProducts(),
  })
}

export function channelListingsQueryOptions() {
  return queryOptions({
    queryKey: ["channel-listings"],
    queryFn: () => listChannelListings(),
  })
}
