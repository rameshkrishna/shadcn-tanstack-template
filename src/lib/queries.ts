import { queryOptions } from "@tanstack/react-query"
import { listChannelListings } from "@/server/channel-listings"
import { getEtsyDefaults } from "@/server/etsy-settings"
import { listCategoryPricingRules } from "@/server/pricing"
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

export function etsyDefaultsQueryOptions() {
  return queryOptions({
    queryKey: ["etsy-defaults"],
    queryFn: () => getEtsyDefaults(),
  })
}

export function categoryPricingRulesQueryOptions() {
  return queryOptions({
    queryKey: ["category-pricing-rules"],
    queryFn: () => listCategoryPricingRules(),
  })
}
