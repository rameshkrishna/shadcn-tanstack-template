import type { Product } from "@/types/product"
import type {
  ChannelId,
  ChannelListing,
  EtsyListingFields,
  EtsyRenewalOption,
  EtsyWhenMade,
  EtsyWhoMade,
} from "@/types/channel-listing"

export interface FieldOption {
  value: string
  label: string
}

export interface FieldSchema {
  key: keyof EtsyListingFields
  label: string
  type: "text" | "textarea" | "select" | "boolean" | "tags"
  required: boolean
  options?: Array<FieldOption>
  placeholder?: string
  dependsOn?: { key: keyof EtsyListingFields; value: unknown }
}

export const WHO_MADE_OPTIONS: Array<{ value: EtsyWhoMade; label: string }> = [
  { value: "i_did", label: "I did" },
  { value: "collective", label: "A member of my shop" },
  { value: "someone_else", label: "Another company or person" },
]

export const WHEN_MADE_OPTIONS: Array<{ value: EtsyWhenMade; label: string }> = [
  { value: "made_to_order", label: "Made to order" },
  { value: "2020_2026", label: "2020 - 2026" },
  { value: "2010_2019", label: "2010 - 2019" },
  { value: "2007_2009", label: "2007 - 2009" },
  { value: "before_2007", label: "Before 2007" },
  { value: "2000_2006", label: "2000 - 2006" },
  { value: "1990s", label: "1990s" },
  { value: "1980s", label: "1980s" },
  { value: "1970s", label: "1970s" },
  { value: "1960s", label: "1960s" },
  { value: "1950s", label: "1950s" },
  { value: "1940s", label: "1940s" },
  { value: "1930s", label: "1930s" },
  { value: "1920s", label: "1920s" },
  { value: "1910s", label: "1910s" },
  { value: "1900s", label: "1900s" },
  { value: "1800s", label: "1800s" },
  { value: "1700s", label: "1700s" },
  { value: "before_1700", label: "Before 1700" },
]

export const RENEWAL_OPTIONS: Array<{ value: EtsyRenewalOption; label: string }> = [
  { value: "automatic", label: "Automatic renewal" },
  { value: "manual", label: "Manual renewal" },
]

export const COLOR_OPTIONS: Array<FieldOption> = [
  "Beige", "Black", "Blue", "Bronze", "Brown", "Clear", "Copper", "Gold",
  "Grey", "Green", "Orange", "Pink", "Purple", "Rainbow", "Red", "Silver",
  "White", "Yellow",
].map((c) => ({ value: c, label: c }))

export const ETSY_FIELD_SCHEMA: Array<FieldSchema> = [
  { key: "whoMade", label: "Who made it?", type: "select", required: true, options: WHO_MADE_OPTIONS },
  { key: "whenMade", label: "When was it made?", type: "select", required: true, options: WHEN_MADE_OPTIONS },
  { key: "isSupply", label: "This is a craft supply", type: "boolean", required: true },
  { key: "taxonomyCategory", label: "Category", type: "text", required: true, placeholder: "e.g. Jewelry > Necklaces" },
  { key: "shippingProfile", label: "Shipping profile", type: "text", required: true, placeholder: "e.g. Standard US Shipping" },
  { key: "tags", label: "Tags (up to 13)", type: "tags", required: false },
  { key: "materials", label: "Materials (up to 13)", type: "tags", required: false },
  { key: "renewalOption", label: "Renewal option", type: "select", required: true, options: RENEWAL_OPTIONS },
  { key: "personalization", label: "Offer personalization", type: "boolean", required: false },
  {
    key: "personalizationInstructions",
    label: "Personalization instructions",
    type: "textarea",
    required: false,
    dependsOn: { key: "personalization", value: true },
  },
  { key: "primaryColor", label: "Primary color", type: "select", required: false, options: COLOR_OPTIONS },
  { key: "secondaryColor", label: "Secondary color", type: "select", required: false, options: COLOR_OPTIONS },
]

export function defaultEtsyFields(): EtsyListingFields {
  return {
    whoMade: "i_did",
    whenMade: "made_to_order",
    isSupply: false,
    taxonomyCategory: "",
    shippingProfile: "",
    tags: [],
    materials: [],
    renewalOption: "automatic",
    personalization: false,
    personalizationInstructions: "",
    primaryColor: "",
    secondaryColor: "",
  }
}

export function resolvedTitle(product: Product, listing: ChannelListing) {
  return listing.overrides.name ?? product.name
}
export function resolvedDescription(product: Product, listing: ChannelListing) {
  return listing.overrides.description ?? product.description
}
export function resolvedPrice(product: Product, listing: ChannelListing) {
  return listing.overrides.price ?? product.price
}
export function resolvedQuantity(product: Product, listing: ChannelListing) {
  return listing.overrides.stock ?? product.stock
}
export function resolvedVendorSku(product: Product, listing: ChannelListing) {
  return listing.overrides.sku ?? product.sku
}

export const ETSY_CSV_HEADERS = [
  "vendor_sku",
  "title",
  "description",
  "price",
  "quantity",
  "who_made",
  "when_made",
  "is_supply",
  "taxonomy_category",
  "shipping_profile",
  "tags",
  "materials",
  "renewal_option",
  "personalization",
  "personalization_instructions",
  "primary_color",
  "secondary_color",
]

export function etsyCsvRow(product: Product, listing: ChannelListing): Array<string> {
  const f = listing.fields
  return [
    resolvedVendorSku(product, listing),
    resolvedTitle(product, listing),
    resolvedDescription(product, listing),
    String(resolvedPrice(product, listing)),
    String(resolvedQuantity(product, listing)),
    f.whoMade,
    f.whenMade,
    f.isSupply ? "true" : "false",
    f.taxonomyCategory,
    f.shippingProfile,
    f.tags.join(", "),
    f.materials.join(", "),
    f.renewalOption,
    f.personalization ? "true" : "false",
    f.personalizationInstructions ?? "",
    f.primaryColor ?? "",
    f.secondaryColor ?? "",
  ]
}

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  etsy: "Etsy",
}

export const CHANNEL_STATUS_OPTIONS: Array<{ value: ChannelListing["status"]; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "exported", label: "Exported" },
]

export const CHANNEL_STATUS_LABEL: Record<ChannelListing["status"], string> = {
  draft: "Draft",
  ready: "Ready",
  exported: "Exported",
}

export const CHANNEL_STATUS_VARIANT: Record<
  ChannelListing["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  ready: "default",
  exported: "secondary",
}
