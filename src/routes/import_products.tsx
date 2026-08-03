import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { toast } from "sonner"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, CircleAlert, Loader2, PackagePlus, Upload } from "lucide-react"
import type { ImportJobResult } from "@/types/product"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { detectImportMode, parseImportUrls, runCatalogImport } from "@/lib/catalog-import"
import { vendorNameFromUrl } from "@/lib/mock-catalog"
import { addProducts } from "@/lib/product-store"
import { fadeInUp } from "@/lib/motion"

export const Route = createFileRoute("/import_products")({
  component: ImportPage,
})

const PLACEHOLDER = `https://maison-verrier.example.com/sitemap.xml
https://northpeak-leather.example.com/products/heritage-titanium-chronograph`

function ImportPage() {
  const [raw, setRaw] = useState("")
  const [running, setRunning] = useState(false)
  const [jobs, setJobs] = useState<Array<ImportJobResult>>([])
  const [importedCount, setImportedCount] = useState<number | null>(null)

  const urls = parseImportUrls(raw)

  async function handleImport() {
    if (urls.length === 0 || running) return

    setRunning(true)
    setImportedCount(null)
    setJobs(
      urls.map((url) => ({
        url,
        mode: detectImportMode(url),
        vendorName: vendorNameFromUrl(url),
        status: "pending",
        productsFound: 0,
      }))
    )

    const products = await runCatalogImport(urls, {
      onProgress: (result) => {
        setJobs((prev) => {
          const index = prev.findIndex((j) => j.url === result.url)
          if (index < 0) return [...prev, result]
          const next = [...prev]
          next[index] = result
          return next
        })
      },
    })

    if (products.length > 0) {
      await addProducts(products)
    }

    const vendorCount = new Set(products.map((p) => p.vendorName)).size
    setImportedCount(products.length)
    setRunning(false)

    if (products.length > 0) {
      toast.success(`Imported ${products.length} products from ${vendorCount} vendor${vendorCount === 1 ? `` : `s`}`)
    } else {
      toast.error("No products were imported. Check the URLs and try again.")
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <motion.div initial="hidden" animate="show" variants={fadeInUp}>
        <h1 className="text-2xl font-semibold tracking-tight">Import Products</h1>
        <p className="text-muted-foreground">
          Paste one URL per line — vendor sitemaps and direct product page URLs are both supported,
          mixed together if you like. Each sitemap is parsed for multiple products; each product URL
          is imported on its own.
        </p>
      </motion.div>

      <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
        <CardHeader>
          <CardTitle>Sitemap or product URLs</CardTitle>
          <CardDescription>
            Each URL is fetched live and parsed for schema.org product data. URLs ending in a sitemap
            .xml file are crawled as sitemaps (up to 30 products); everything else is treated as a
            single product page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={PLACEHOLDER}
            className="min-h-32 font-mono text-sm"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            disabled={running}
          />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {urls.length} URL{urls.length === 1 ? "" : "s"} detected
            </p>
            <Button className="gap-2" disabled={urls.length === 0 || running} onClick={handleImport}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {running ? "Importing..." : "Start Import"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {jobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
              <CardHeader>
                <CardTitle>Import progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {jobs.map((job, index) => (
                  <motion.div
                    key={job.url}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.04 }}
                    className="flex items-center justify-between rounded-lg bg-muted/30 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0 font-normal">
                          {job.mode === "sitemap" ? "Sitemap" : "Product page"}
                        </Badge>
                        <p className="truncate text-sm font-medium">{job.url}</p>
                      </div>
                      {job.vendorName && (
                        <p className="text-xs text-muted-foreground">{job.vendorName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={job.status}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.12 }}
                          className="flex shrink-0 items-center gap-2"
                        >
                          {job.status === "pending" && (
                            <span className="text-muted-foreground">Waiting…</span>
                          )}
                          {job.status === "parsing" && (
                            <>
                              <Spinner className="h-4 w-4" />
                              <span className="text-muted-foreground">
                                {job.mode === "sitemap" ? "Parsing…" : "Fetching…"}
                              </span>
                            </>
                          )}
                          {job.status === "done" && (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span>
                                {job.mode === "sitemap" ? `${job.productsFound} found` : "Imported"}
                              </span>
                            </>
                          )}
                          {job.status === "error" && (
                            <>
                              <CircleAlert className="h-4 w-4 text-destructive" />
                              <span className="text-destructive">{job.error ?? "Failed"}</span>
                            </>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {importedCount !== null && importedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex items-center justify-between rounded-lg border border-border/50 bg-card/60 p-4"
          >
            <div className="flex items-center gap-3">
              <PackagePlus className="h-5 w-5 text-primary" />
              <p className="text-sm">
                <span className="font-medium">{importedCount}</span> products added to your inventory.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/">View Inventory</Link>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
