import { createFileRoute } from "@tanstack/react-router"
import { zipSync } from "fflate"

interface DownloadImagesRequest {
  products?: Array<{ id: string; sku: string; imageUrl: string }>
}

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
}

function extensionFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname
    const match = /\.([a-zA-Z0-9]{2,5})$/.exec(pathname)
    return match?.[1]?.toLowerCase()
  } catch {
    return undefined
  }
}

function sanitizeSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
}

export const Route = createFileRoute("/api/download-images")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as DownloadImagesRequest
        const products = body.products ?? []

        if (products.length === 0) {
          return Response.json({ message: "No products provided" }, { status: 400 })
        }

        const usedFolders = new Set<string>()
        const files: Record<string, Uint8Array> = {}
        let failedCount = 0

        await Promise.all(
          products.map(async (product) => {
            try {
              const response = await fetch(product.imageUrl)
              if (!response.ok) throw new Error(`HTTP ${response.status}`)

              const contentType = response.headers.get("content-type")?.split(";")[0]?.trim()
              const extension =
                (contentType && EXTENSION_BY_CONTENT_TYPE[contentType]) ??
                extensionFromUrl(product.imageUrl) ??
                "jpg"

              const bytes = new Uint8Array(await response.arrayBuffer())

              let folder = sanitizeSegment(product.sku) || sanitizeSegment(product.id) || "product"
              if (usedFolders.has(folder)) {
                folder = `${folder}-${sanitizeSegment(product.id).slice(0, 8)}`
              }
              usedFolders.add(folder)

              files[`images/${folder}/productimage.${extension}`] = bytes
            } catch {
              failedCount += 1
            }
          })
        )

        if (Object.keys(files).length === 0) {
          return Response.json(
            { message: "Failed to download any of the selected product images" },
            { status: 502 }
          )
        }

        const zipped = zipSync(files)

        return new Response(zipped, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="product-images.zip"`,
            "X-Failed-Count": String(failedCount),
          },
        })
      },
    },
  },
})
