import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Calculator, Save } from "lucide-react"
import type { Product } from "@/types/product"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useProducts } from "@/lib/product-store"
import { upsertChannelListing, useChannelListings } from "@/lib/channel-listing-store"
import { resolvedPrice } from "@/lib/channel-registry"
import { saveCategoryPricingRule, useCategoryPricingRule } from "@/lib/pricing-store"
import { computeCategoryPrice, roundToCents } from "@/lib/pricing"
import { fadeInUp } from "@/lib/motion"

export const Route = createFileRoute("/pricing-strategy")({
  component: PricingStrategyPage,
})

interface RuleFormState {
  marginPercent: number
  vendorShippingRate: number
  vendorProcessingFee: number
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
  } catch {
    return value.toFixed(2)
  }
}

function PricingStrategyPage() {
  const products = useProducts()
  const categories = Array.from(new Set(products.map((p) => p.category))).sort()
  const [category, setCategory] = useState(categories[0])

  if (categories.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <p className="text-muted-foreground">No products yet — import products first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className="flex items-center gap-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pricing Strategy</h1>
          <p className="text-muted-foreground">
            Set a margin and vendor costs per category — the selling price is computed from
            each product's scraped price and pushed to its Etsy channel listing.
          </p>
        </div>
      </motion.div>

      <motion.div initial="hidden" animate="show" variants={fadeInUp} className="max-w-xs">
        <Label htmlFor="category">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="category" className="mt-1.5 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      <CategoryPricingPanel
        key={category}
        category={category}
        products={products.filter((p) => p.category === category)}
      />
    </div>
  )
}

function CategoryPricingPanel({
  category,
  products,
}: {
  category: string
  products: Array<Product>
}) {
  const savedRule = useCategoryPricingRule(category)
  const channelListings = useChannelListings()
  const [form, setForm] = useState<RuleFormState>({
    marginPercent: savedRule.marginPercent,
    vendorShippingRate: savedRule.vendorShippingRate,
    vendorProcessingFee: savedRule.vendorProcessingFee,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await saveCategoryPricingRule({ category, ...form })
      await Promise.all(
        products.map((product) => {
          const newPrice = computeCategoryPrice(product.price, form)
          if (newPrice === null) return Promise.resolve()
          return upsertChannelListing(product.id, "etsy", {
            overrides: { price: roundToCents(newPrice) },
          })
        })
      )
      toast.success(`Pricing rule saved and pushed to Etsy for ${products.length} product(s)`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save pricing")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <motion.div initial="hidden" animate="show" variants={fadeInUp}>
        <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>{category} pricing rule</CardTitle>
              <CardDescription>
                Selling price = (scraped price + vendor shipping + vendor processing fee) ÷ (1
                − margin).
              </CardDescription>
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save & push to Etsy"}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="marginPercent">Margin %</Label>
                <Input
                  id="marginPercent"
                  type="number"
                  min={0}
                  max={99}
                  step="0.1"
                  value={form.marginPercent}
                  onChange={(e) =>
                    setForm({ ...form, marginPercent: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vendorShippingRate">Vendor shipping rate</Label>
                <Input
                  id="vendorShippingRate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.vendorShippingRate}
                  onChange={(e) =>
                    setForm({ ...form, vendorShippingRate: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vendorProcessingFee">Vendor processing fee</Label>
                <Input
                  id="vendorProcessingFee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.vendorProcessingFee}
                  onChange={(e) =>
                    setForm({ ...form, vendorProcessingFee: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial="hidden" animate="show" variants={fadeInUp}>
        <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              What each product's Etsy price will become when you save this rule.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Scraped price</TableHead>
                  <TableHead>Current Etsy price</TableHead>
                  <TableHead>New Etsy price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const listing = channelListings.find(
                    (l) => l.productId === product.id && l.channel === "etsy"
                  )
                  const currentEtsyPrice = listing
                    ? resolvedPrice(product, listing)
                    : product.price
                  const newPrice = computeCategoryPrice(product.price, form)
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{product.name}</span>
                          <span className="text-xs text-muted-foreground">{product.sku}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(product.price, product.currency)}</TableCell>
                      <TableCell>
                        {formatCurrency(currentEtsyPrice, product.currency)}
                        {!listing && (
                          <Badge variant="outline" className="ml-2">
                            not listed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {newPrice === null ? (
                          <span className="text-xs text-muted-foreground">n/a</span>
                        ) : (
                          <span className="font-medium">
                            {formatCurrency(newPrice, product.currency)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
