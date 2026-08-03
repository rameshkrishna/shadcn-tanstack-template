import { randomUUID } from "node:crypto"
import { gunzipSync } from "node:zlib"
import { createServerFn } from "@tanstack/react-start"
import type { ImportMode, Product, ProductStatus } from "@/types/product"

/**
 * Mirrors core/stages/discover.py (SterlingLuxeCo/jewelpipe): fetch a sitemap
 * or product page, pull structured data out of the schema.org Product
 * JSON-LD block (falling back to OG meta tags), and normalize it into a
 * Product row. Unlike discover.py this isn't scoped to one vendor's URL
 * pattern/config — it accepts whatever sitemap or product URL the user
 * pastes into the import page.
 */

const USER_AGENT = "SterlingLuxeCatalogImporter/1.0"
const REQUEST_INTERVAL_MS = 500 // ~2 req/s, same throttle as discover.py
const MAX_SITEMAP_PRODUCTS = 30

const CATEGORY_KEYWORDS: Record<string, string> = {
  ring: "Jewelry",
  necklace: "Jewelry",
  pendant: "Jewelry",
  earring: "Jewelry",
  bracelet: "Jewelry",
  bangle: "Jewelry",
  cufflink: "Jewelry",
  watch: "Watches",
  chronograph: "Watches",
  timepiece: "Watches",
  bag: "Handbags",
  tote: "Handbags",
  clutch: "Handbags",
  handbag: "Handbags",
  purse: "Handbags",
  crossbody: "Handbags",
  satchel: "Handbags",
  sunglass: "Sunglasses",
  eyewear: "Sunglasses",
  boot: "Footwear",
  shoe: "Footwear",
  loafer: "Footwear",
  sneaker: "Footwear",
  oxford: "Footwear",
  sandal: "Footwear",
}

const lastRequestAtByHost = new Map<string, number>()
const robotsDisallowByHost = new Map<string, Array<string>>()
const shopifySupportByHost = new Map<string, boolean>()

async function throttledFetch(url: string): Promise<Response> {
  const host = new URL(url).host
  const last = lastRequestAtByHost.get(host) ?? 0
  const wait = last + REQUEST_INTERVAL_MS - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequestAtByHost.set(host, Date.now())
  return fetch(url, { headers: { "User-Agent": USER_AGENT } })
}

function parseRobotsDisallow(text: string): Array<string> {
  let inWildcardGroup = false
  const prefixes: Array<string> = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim()
    if (!line) continue
    const separator = line.indexOf(":")
    if (separator < 0) continue
    const key = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()
    if (key === "user-agent") {
      inWildcardGroup = value === "*"
    } else if (key === "disallow" && inWildcardGroup && value) {
      prefixes.push(value)
    }
  }
  return prefixes
}

async function getDisallowedPrefixes(pageUrl: string): Promise<Array<string>> {
  const { origin, host } = new URL(pageUrl)
  const cached = robotsDisallowByHost.get(host)
  if (cached) return cached
  let prefixes: Array<string> = []
  try {
    const res = await throttledFetch(`${origin}/robots.txt`)
    if (res.ok) prefixes = parseRobotsDisallow(await res.text())
  } catch {
    // no reachable robots.txt — treat as unrestricted, matching discover.py's
    // best-effort robots check
  }
  robotsDisallowByHost.set(host, prefixes)
  return prefixes
}

function isAllowedByRobots(pageUrl: string, disallowedPrefixes: Array<string>): boolean {
  const path = new URL(pageUrl).pathname
  return !disallowedPrefixes.some((prefix) => path.startsWith(prefix))
}

async function fetchTextMaybeGzipped(url: string): Promise<string> {
  const res = await throttledFetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const isGzip = buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b
  const bytes = isGzip || url.toLowerCase().endsWith(".gz") ? gunzipSync(buffer) : buffer
  return bytes.toString("utf-8")
}

function extractTagBlocks(xml: string, tag: string): Array<string> {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")
  const blocks: Array<string> = []
  let match: RegExpExecArray | null
  while ((match = re.exec(xml))) blocks.push(match[1])
  return blocks
}

function extractTagText(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml)
  if (!match) return null
  return match[1]
    .trim()
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

interface SitemapEntry {
  sourceUrl: string
  sourceImageUrl: string | null
  sitemapTitle: string | null
}

async function walkSitemap(url: string, entries: Array<SitemapEntry>, limit: number): Promise<void> {
  if (entries.length >= limit) return
  const xml = await fetchTextMaybeGzipped(url)

  if (/<sitemapindex[\s>]/i.test(xml)) {
    for (const block of extractTagBlocks(xml, "sitemap")) {
      if (entries.length >= limit) break
      const childUrl = extractTagText(block, "loc")
      if (childUrl) await walkSitemap(childUrl, entries, limit)
    }
    return
  }

  for (const block of extractTagBlocks(xml, "url")) {
    if (entries.length >= limit) break
    const loc = extractTagText(block, "loc")
    if (!loc || !looksLikeProductPage(loc)) continue
    entries.push({
      sourceUrl: loc,
      sourceImageUrl: extractTagText(block, "image:loc"),
      sitemapTitle: extractTagText(block, "image:title"),
    })
  }
}

// Sitemaps mix product pages in with the homepage, collection/category pages,
// and blog posts. There's no universal way to tell them apart without a
// vendor-specific URL pattern (discover.py's VENDOR_PRODUCT_URL_PATTERN), so
// this is a best-effort generic filter: skip the bare domain root and paths
// that are obviously not product detail pages.
function looksLikeProductPage(url: string): boolean {
  try {
    const { pathname } = new URL(url)
    const segments = pathname.split("/").filter(Boolean)
    if (segments.length === 0) return false
    if (/^(collections?|category|categories|pages?|blogs?|news|about|contact|cart|account|search)$/i.test(segments[0])) {
      return false
    }
    return true
  } catch {
    return false
  }
}

interface ScrapedPage {
  title: string | null
  description: string | null
  price: string | null
  currency: string | null
  sku: string | null
  imageUrl: string | null
  availability: string | null
  isProductPage: boolean
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
}

function findJsonLdProduct(html: string): Record<string, any> | null {
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = scriptRe.exec(html))) {
    let data: unknown
    try {
      data = JSON.parse(match[1].trim())
    } catch {
      continue
    }
    const candidates = Array.isArray(data) ? data : ((data as any)?.["@graph"] ?? [data])
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") continue
      const type = (candidate as Record<string, unknown>)["@type"]
      const types = Array.isArray(type) ? type : [type]
      if (types.includes("Product")) return candidate as Record<string, any>
    }
  }
  return null
}

function extractMetaContent(html: string, property: string): string | null {
  const forward = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
    "i"
  ).exec(html)
  if (forward) return decodeHtmlEntities(forward[1])
  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
    "i"
  ).exec(html)
  return reversed ? decodeHtmlEntities(reversed[1]) : null
}

function extractImageUrl(product: Record<string, any>): string | null {
  let image = product.image
  if (Array.isArray(image)) image = image[0]
  if (image && typeof image === "object") return image.url ?? image.contentUrl ?? null
  return typeof image === "string" ? image : null
}

function extractAvailability(offer: Record<string, any>): string | null {
  const availability = offer.availability
  if (typeof availability !== "string" || !availability) return null
  return availability.replace(/\/$/, "").split("/").pop() ?? null
}

function scrapeProductPage(html: string, pageUrl: string): ScrapedPage {
  const product = findJsonLdProduct(html)
  let title: string | null = null
  let description: string | null = null
  let price: string | null = null
  let currency: string | null = null
  let sku: string | null = null
  let imageUrl: string | null = null
  let availability: string | null = null

  if (product) {
    title = typeof product.name === "string" ? product.name : null
    description = typeof product.description === "string" ? product.description : null
    const offers = product.offers
    const offer: Record<string, any> = (Array.isArray(offers) ? offers[0] : offers) ?? {}
    // Some vendors null out the top-level sku (e.g. on out-of-stock items)
    // but still set it on the offer.
    sku = (typeof product.sku === "string" && product.sku) || (typeof offer.sku === "string" && offer.sku) || null
    price = offer.price != null ? String(offer.price) : null
    currency = typeof offer.priceCurrency === "string" ? offer.priceCurrency : null
    imageUrl = extractImageUrl(product)
    availability = extractAvailability(offer)
  }

  // A sitemap can list non-product pages (a homepage, a bare .md file, a
  // blog post) that looksLikeProductPage's path heuristic lets through.
  // og:type="product" / JSON-LD Product / a real price are the actual
  // signal that this page IS a product, vs. just having *a* <title>.
  const isProductPage = product !== null || price !== null || extractMetaContent(html, "og:type") === "product"

  title = title ?? extractMetaContent(html, "og:title")
  description = description ?? extractMetaContent(html, "og:description")
  imageUrl = imageUrl ?? extractMetaContent(html, "og:image")

  if (!title) {
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
    title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null
  }

  if (imageUrl) {
    try {
      imageUrl = new URL(imageUrl, pageUrl).href
    } catch {
      // relative-looking but unresolvable — drop rather than store garbage
      imageUrl = null
    }
  }

  return { title, description, price, currency, sku, imageUrl, availability, isProductPage }
}

function inferCategory(title: string): string {
  const haystack = title.toLowerCase()
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    // Word-boundary match, not substring — plain "includes" would match
    // "shoe" inside "horseshoe" or "bag" inside "handbag" against the wrong
    // keyword.
    if (new RegExp(`\\b${keyword}\\b`).test(haystack)) return category
  }
  return "Accessories"
}

function statusForAvailability(availability: string | null): ProductStatus {
  switch (availability) {
    case "OutOfStock":
    case "SoldOut":
      return "out-of-stock"
    case "Discontinued":
      return "discontinued"
    case "LimitedAvailability":
    case "PreOrder":
    case "BackOrder":
      return "low-stock"
    default:
      return "in-stock"
  }
}

// schema.org Offer.availability tells us in/out of stock, never a count --
// pick a representative quantity per bucket rather than inventing precision
// the source data doesn't have.
function stockForStatus(status: ProductStatus): number {
  switch (status) {
    case "out-of-stock":
    case "discontinued":
      return 0
    case "low-stock":
      return 3
    default:
      return 20
  }
}

function statusForStockCount(count: number): ProductStatus {
  if (count <= 0) return "out-of-stock"
  if (count <= 5) return "low-stock"
  return "in-stock"
}

interface ShopifyVariantJson {
  inventory_quantity?: number
  inventory_management?: string | null
}

interface ShopifyProductJson {
  variants?: Array<ShopifyVariantJson>
}

// Shopify's Ajax API exposes real per-variant inventory counts at
// {product-url}.js. The JSON-LD Offer we parse elsewhere only ever carries an
// availability bucket (in/out of stock), never a quantity — and storefront
// text like "Only N left in stock" is injected client-side via JS, so it's
// never present in the HTML we fetch server-side. This is Shopify-specific
// and best-effort: non-Shopify vendors (or Shopify stores with inventory
// tracking off) just fall through to the bucket-based placeholder.
async function fetchShopifyStockCount(pageUrl: string): Promise<number | null> {
  const { host } = new URL(pageUrl)
  if (shopifySupportByHost.get(host) === false) return null

  let jsonUrl: string
  try {
    const url = new URL(pageUrl)
    jsonUrl = `${url.origin}${url.pathname.replace(/\/+$/, "")}.js`
  } catch {
    return null
  }

  try {
    const res = await throttledFetch(jsonUrl)
    if (!res.ok) {
      shopifySupportByHost.set(host, false)
      return null
    }
    // Shopify serves this endpoint as `text/javascript`, not `application/json`,
    // even though the body is plain JSON — parse it and let a syntax error
    // (i.e. it really wasn't JSON) be what disqualifies the host below.
    const data = JSON.parse(await res.text()) as ShopifyProductJson
    const tracked = (data.variants ?? []).filter((v) => v.inventory_management === "shopify")
    shopifySupportByHost.set(host, true)
    if (tracked.length === 0) return null
    return tracked.reduce((sum, v) => sum + Math.max(0, v.inventory_quantity ?? 0), 0)
  } catch {
    shopifySupportByHost.set(host, false)
    return null
  }
}

function slugTitleFromUrl(pageUrl: string): string | null {
  try {
    const last = new URL(pageUrl).pathname.split("/").filter(Boolean).at(-1)
    if (!last) return null
    const cleaned = last.replace(/\.(html?|php|aspx?)$/i, "")
    if (!/[a-zA-Z]/.test(cleaned)) return null
    return cleaned
      .split(/[-_]+/)
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(" ")
  } catch {
    return null
  }
}

function skuFromUrl(pageUrl: string, vendorName: string): string {
  let hash = 0
  for (let i = 0; i < pageUrl.length; i++) hash = (hash * 31 + pageUrl.charCodeAt(i)) >>> 0
  const prefix = vendorName.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "SKU"
  return `${prefix}-${(hash % 9000) + 1000}`
}

async function buildProduct(
  pageUrl: string,
  importUrl: string,
  vendorName: string,
  fallbackTitle?: string | null
): Promise<Product | null> {
  const disallowed = await getDisallowedPrefixes(pageUrl)
  if (!isAllowedByRobots(pageUrl, disallowed)) {
    throw new Error(`Blocked by robots.txt: ${pageUrl}`)
  }

  const res = await throttledFetch(pageUrl)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${pageUrl}`)
  const html = await res.text()
  const scraped = scrapeProductPage(html, pageUrl)
  if (!scraped.isProductPage) return null

  const title = scraped.title ?? fallbackTitle ?? slugTitleFromUrl(pageUrl)
  if (!title) return null

  const explicitStock = await fetchShopifyStockCount(pageUrl)
  const status =
    explicitStock !== null ? statusForStockCount(explicitStock) : statusForAvailability(scraped.availability)
  const priceNumber = scraped.price ? Number.parseFloat(scraped.price.replace(/[^0-9.]/g, "")) : NaN

  return {
    id: randomUUID(),
    name: title,
    sku: scraped.sku ?? skuFromUrl(pageUrl, vendorName),
    category: inferCategory(title),
    description: scraped.description ?? "",
    imageUrl: scraped.imageUrl ?? "",
    price: Number.isFinite(priceNumber) ? priceNumber : 0,
    currency: scraped.currency ?? "USD",
    stock: explicitStock ?? stockForStatus(status),
    status,
    vendorName,
    importUrl,
    sourceUrl: pageUrl,
    importedAt: new Date().toISOString(),
  }
}

interface ScrapeImportUrlInput {
  url: string
  vendorName: string
  mode: ImportMode
}

export const scrapeImportUrl = createServerFn({ method: "POST" })
  .inputValidator((data: ScrapeImportUrlInput) => data)
  .handler(async ({ data }): Promise<Array<Product>> => {
    const { url, vendorName, mode } = data

    if (mode === "sitemap") {
      const entries: Array<SitemapEntry> = []
      await walkSitemap(url, entries, MAX_SITEMAP_PRODUCTS)
      if (entries.length === 0) throw new Error("No product URLs found in sitemap")

      const products: Array<Product> = []
      for (const entry of entries) {
        try {
          const product = await buildProduct(entry.sourceUrl, url, vendorName, entry.sitemapTitle)
          if (product) {
            if (entry.sourceImageUrl && !product.imageUrl) product.imageUrl = entry.sourceImageUrl
            products.push(product)
          }
        } catch {
          // one bad product page shouldn't fail the whole sitemap crawl
        }
      }
      if (products.length === 0) throw new Error("Found sitemap entries but couldn't scrape any product pages")
      return products
    }

    const product = await buildProduct(url, url, vendorName)
    if (!product) throw new Error("Couldn't find product data on that page")
    return [product]
  })
