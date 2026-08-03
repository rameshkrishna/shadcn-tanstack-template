import type { Product, ProductStatus } from "@/types/product"

const CATEGORIES = [
  "Watches",
  "Handbags",
  "Jewelry",
  "Sunglasses",
  "Footwear",
  "Accessories",
] as const

const MATERIALS: Record<(typeof CATEGORIES)[number], Array<string>> = {
  Watches: ["Titanium", "Rose Gold", "Stainless Steel", "Platinum", "Carbon Fiber"],
  Handbags: ["Calfskin", "Full-Grain Leather", "Suede", "Crocodile-Embossed", "Canvas"],
  Jewelry: ["18k Gold", "Sterling Silver", "White Gold", "Platinum", "Rose Gold"],
  Sunglasses: ["Acetate", "Titanium", "Polarized Glass", "Carbon Fiber", "Tortoiseshell"],
  Footwear: ["Nappa Leather", "Suede", "Patent Leather", "Exotic Leather", "Canvas"],
  Accessories: ["Silk", "Leather", "Cashmere", "Sterling Silver", "Enamel"],
}

const ITEM_NAMES: Record<(typeof CATEGORIES)[number], Array<string>> = {
  Watches: ["Chronograph", "Diver", "Skeleton Automatic", "Dress Watch", "GMT Traveler"],
  Handbags: ["Tote", "Shoulder Bag", "Clutch", "Crossbody", "Weekender"],
  Jewelry: ["Tennis Bracelet", "Signet Ring", "Pendant Necklace", "Hoop Earrings", "Cufflinks"],
  Sunglasses: ["Aviator", "Wayfarer", "Round Frame", "Cat-Eye", "Rectangle Frame"],
  Footwear: ["Oxford", "Chelsea Boot", "Loafer", "Derby", "Monk Strap"],
  Accessories: ["Silk Scarf", "Leather Belt", "Card Holder", "Cufflink Set", "Money Clip"],
}

const ADJECTIVES = ["Heritage", "Signature", "Classic", "Modern", "Artisan", "Reserve", "Icon", "Prestige"]

const PRICE_RANGES: Record<(typeof CATEGORIES)[number], [number, number]> = {
  Watches: [1200, 18000],
  Handbags: [800, 9500],
  Jewelry: [400, 22000],
  Sunglasses: [180, 650],
  Footwear: [350, 1800],
  Accessories: [90, 900],
}

function pick<T>(arr: ReadonlyArray<T>): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function statusForStock(stock: number): ProductStatus {
  if (stock === 0) return "out-of-stock"
  if (stock <= 5) return "low-stock"
  return "in-stock"
}

export function vendorNameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    const label = host.split(".").slice(0, -1).join(".") || host
    return label
      .split(/[-.]/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" ")
  } catch {
    return "Unknown Vendor"
  }
}

function generateMockProduct(sitemapUrl: string, vendorName: string, index: number): Product {
  const category = pick(CATEGORIES)
  const material = pick(MATERIALS[category])
  const item = pick(ITEM_NAMES[category])
  const adjective = pick(ADJECTIVES)
  const [min, max] = PRICE_RANGES[category]
  const stock = randomInt(0, 40)
  const slug = `${adjective}-${material}-${item}`.toLowerCase().replace(/\s+/g, "-")
  const id = crypto.randomUUID()

  return {
    id,
    name: `${adjective} ${material} ${item}`,
    sku: `${vendorName.slice(0, 3).toUpperCase()}-${randomInt(1000, 9999)}`,
    category,
    description: `${material} ${item.toLowerCase()} from the ${vendorName} ${adjective.toLowerCase()} collection.`,
    imageUrl: `https://picsum.photos/seed/${id}/600/600`,
    price: randomInt(min, max),
    currency: "USD",
    stock,
    status: statusForStock(stock),
    vendorName,
    importUrl: sitemapUrl,
    sourceUrl: `${sitemapUrl.replace(/\/sitemap.*$/i, "")}/products/${slug}-${index}`,
    importedAt: new Date().toISOString(),
  }
}

export function generateSeedProducts(): Array<Product> {
  const seedVendors = [
    "https://maison-verrier.example.com/sitemap.xml",
    "https://northpeak-leather.example.com/sitemap.xml",
  ]

  return seedVendors.flatMap((sitemapUrl) => {
    const vendorName = vendorNameFromUrl(sitemapUrl)
    return Array.from({ length: randomInt(4, 6) }, (_, i) =>
      generateMockProduct(sitemapUrl, vendorName, i)
    )
  })
}

export { CATEGORIES }
