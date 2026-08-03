export type ProductStatus = "in-stock" | "low-stock" | "out-of-stock" | "discontinued"

export interface Product {
  id: string
  name: string
  sku: string
  category: string
  description: string
  imageUrl: string
  price: number
  currency: string
  stock: number
  status: ProductStatus
  vendorName: string
  importUrl: string
  sourceUrl: string
  importedAt: string
  imagePrompt?: string
  imagePromptGeneratedAt?: string
}

export type ImportMode = "sitemap" | "product"

export interface ImportJobResult {
  url: string
  mode: ImportMode
  vendorName: string
  status: "pending" | "parsing" | "done" | "error"
  productsFound: number
  error?: string
}

export interface BulkJobResult {
  productId: string
  productName: string
  status: "pending" | "generating" | "done" | "error"
  error?: string
}
