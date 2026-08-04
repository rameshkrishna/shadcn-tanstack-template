import type { Product } from "@/types/product"

export type ChannelId = "etsy"

export type EtsyWhoMade = "i_did" | "collective" | "someone_else"

export type EtsyWhenMade =
  | "made_to_order"
  | "2020_2026"
  | "2010_2019"
  | "2007_2009"
  | "before_2007"
  | "2000_2006"
  | "1990s"
  | "1980s"
  | "1970s"
  | "1960s"
  | "1950s"
  | "1940s"
  | "1930s"
  | "1920s"
  | "1910s"
  | "1900s"
  | "1800s"
  | "1700s"
  | "before_1700"

export type EtsyRenewalOption = "automatic" | "manual"

export interface EtsyListingFields {
  whoMade: EtsyWhoMade
  whenMade: EtsyWhenMade
  isSupply: boolean
  taxonomyCategory: string
  shippingProfile: string
  tags: Array<string>
  materials: Array<string>
  renewalOption: EtsyRenewalOption
  personalization: boolean
  personalizationInstructions?: string
  primaryColor?: string
  secondaryColor?: string
}

export type ChannelListingOverrides = Partial<
  Pick<Product, "name" | "description" | "price" | "stock" | "sku">
>

export interface ChannelListing {
  id: string
  productId: string
  channel: ChannelId
  status: "draft" | "ready" | "exported"
  overrides: ChannelListingOverrides
  fields: EtsyListingFields
  updatedAt: string
}

export interface ChannelListingPatch {
  status?: ChannelListing["status"]
  overrides?: ChannelListingOverrides
  fields?: Partial<EtsyListingFields>
}

// The subset of EtsyListingFields that's the same across every new listing
// rather than generated per-product — tags/materials are AI-generated or
// hand-written per listing, so they're excluded here.
export type EtsyDefaultFields = Omit<EtsyListingFields, "tags" | "materials">
