import type { ProductStatus } from "@/types/product"

export const PRODUCT_STATUS_OPTIONS: Array<{ value: ProductStatus; label: string }> = [
  { value: "in-stock", label: "In Stock" },
  { value: "low-stock", label: "Low Stock" },
  { value: "out-of-stock", label: "Out of Stock" },
  { value: "discontinued", label: "Discontinued" },
]

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  "in-stock": "In Stock",
  "low-stock": "Low Stock",
  "out-of-stock": "Out of Stock",
  discontinued: "Discontinued",
}

export const PRODUCT_STATUS_VARIANT: Record<
  ProductStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  "in-stock": "default",
  "low-stock": "secondary",
  "out-of-stock": "destructive",
  discontinued: "outline",
}
