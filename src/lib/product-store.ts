import { useSuspenseQuery } from "@tanstack/react-query"
import type { Product } from "@/types/product"
import { queryClient } from "@/lib/query-client"
import { productsQueryOptions } from "@/lib/queries"
import { createProducts, deleteProducts, updateProductFn } from "@/server/products"

export function useProducts(): Array<Product> {
  return useSuspenseQuery(productsQueryOptions()).data
}

export function useProduct(id: string | undefined): Product | undefined {
  return useProducts().find((product) => product.id === id)
}

export async function addProducts(newProducts: Array<Product>) {
  await createProducts({ data: { products: newProducts } })
  await queryClient.invalidateQueries({ queryKey: ["products"] })
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  await updateProductFn({ data: { id, patch } })
  await queryClient.invalidateQueries({ queryKey: ["products"] })
}

export async function removeProduct(id: string) {
  await deleteProducts({ data: { ids: [id] } })
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["products"] }),
    queryClient.invalidateQueries({ queryKey: ["channel-listings"] }),
  ])
}

export async function removeProducts(ids: Array<string>) {
  await deleteProducts({ data: { ids } })
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["products"] }),
    queryClient.invalidateQueries({ queryKey: ["channel-listings"] }),
  ])
}
