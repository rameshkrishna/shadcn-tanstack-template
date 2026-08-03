import type { ImportJobResult, ImportMode, Product } from "@/types/product"
import { vendorNameFromUrl } from "@/lib/mock-catalog"
import { scrapeImportUrl } from "@/server/catalog-scrape"

export function parseImportUrls(raw: string): Array<string> {
  return Array.from(
    new Set(
      raw
        .split(/[\n,]/)
        .map((line) => line.trim())
        .filter(Boolean)
    )
  )
}

export function isLikelyUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function detectImportMode(value: string): ImportMode {
  try {
    const { pathname } = new URL(value)
    if (/sitemap/i.test(pathname) && /\.xml(\.gz)?$/i.test(pathname)) {
      return "sitemap"
    }
  } catch {
    // not a valid URL — fall through to default mode
  }
  return "product"
}

interface RunImportOptions {
  onProgress: (result: ImportJobResult) => void
}

export async function runCatalogImport(
  urls: Array<string>,
  { onProgress }: RunImportOptions
): Promise<Array<Product>> {
  const allProducts: Array<Product> = []

  for (const url of urls) {
    const vendorName = vendorNameFromUrl(url)
    const mode = detectImportMode(url)

    if (!isLikelyUrl(url)) {
      onProgress({ url, mode, vendorName, status: "error", productsFound: 0, error: "Not a valid URL" })
      continue
    }

    onProgress({ url, mode, vendorName, status: "parsing", productsFound: 0 })

    try {
      const products = await scrapeImportUrl({ data: { url, vendorName, mode } })
      allProducts.push(...products)
      onProgress({ url, mode, vendorName, status: "done", productsFound: products.length })
    } catch (error) {
      onProgress({
        url,
        mode,
        vendorName,
        status: "error",
        productsFound: 0,
        error: error instanceof Error ? error.message : "Import failed",
      })
    }
  }

  return allProducts
}
