import type { Product } from "@/types/product"
import type { ChannelListing } from "@/types/channel-listing"
import { ETSY_CSV_HEADERS, etsyCsvRow } from "@/lib/channel-registry"
import { downloadCsv } from "@/lib/csv-export"

export function exportEtsyCsv(products: Array<Product>, listings: Array<ChannelListing>, filename: string) {
  const listingByProductId = new Map(listings.map((l) => [l.productId, l]))
  const rows = products
    .map((product) => {
      const listing = listingByProductId.get(product.id)
      if (!listing) return null
      return etsyCsvRow(product, listing)
    })
    .filter((row): row is Array<string> => row !== null)

  downloadCsv(filename, ETSY_CSV_HEADERS, rows)
}
