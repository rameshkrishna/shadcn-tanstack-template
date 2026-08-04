import { useMemo } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { motion } from "framer-motion"
import {
  Boxes,
  CalendarDays,
  DollarSign,
  Flame,
  PackageSearch,
  Target,
  TrendingUp,
  TriangleAlert,
  Upload,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ProductTable } from "@/components/product-table"
import { useProducts } from "@/lib/product-store"
import { fadeInUp, staggerContainer } from "@/lib/motion"

interface InventorySearch {
  category?: string
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): InventorySearch => ({
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  component: Inventory,
})

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
}

const DAILY_AVG_SALES = 350
const PROFIT_PER_UNIT = 3
const DAILY_PROFIT_GOAL = DAILY_AVG_SALES * PROFIT_PER_UNIT
const MONTHLY_PROFIT_GOAL = DAILY_PROFIT_GOAL * 30
const ANNUAL_PROFIT_GOAL = DAILY_PROFIT_GOAL * 365

function Inventory() {
  const products = useProducts()
  const navigate = useNavigate()
  const { category: activeCategory } = Route.useSearch()
  const category = activeCategory ?? "all"

  function setCategory(next: string) {
    navigate({ to: "/", search: next === "all" ? {} : { category: next } })
  }

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products]
  )

  const categoryFiltered = useMemo(
    () => (category === "all" ? products : products.filter((p) => p.category === category)),
    [products, category]
  )

  const totalValue = useMemo(
    () => products.reduce((sum, p) => sum + p.price * p.stock, 0),
    [products]
  )
  const vendorCount = useMemo(() => new Set(products.map((p) => p.vendorName)).size, [products])
  const lowStockCount = useMemo(
    () => products.filter((p) => p.status === "low-stock" || p.status === "out-of-stock").length,
    [products]
  )

  return (
    <div className="space-y-6 p-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            Products imported from vendor catalogs and sitemaps.
          </p>
        </div>
        <Button className="gap-2" asChild>
          <Link to="/import_products">
            <Upload className="h-4 w-4" />
            Import Products
          </Link>
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut", delay: 0.05 }}
      >
        <Card className="border-[#F1641E]/30 bg-gradient-to-br from-[#F1641E]/10 via-card/60 to-card/60 shadow-sm backdrop-blur-md">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Flame className="h-5 w-5 text-[#F1641E]" />
            <CardTitle className="text-sm font-medium text-[#F1641E]">Daily Motivation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3">
                <Target className="h-8 w-8 text-[#F1641E]" />
                <div>
                  <div className="text-xs text-muted-foreground">Daily Avg Sales</div>
                  <div className="text-xl font-bold">{DAILY_AVG_SALES} units</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-[#F1641E]" />
                <div>
                  <div className="text-xs text-muted-foreground">Profit / Unit</div>
                  <div className="text-xl font-bold">{formatCurrency(PROFIT_PER_UNIT, "USD")}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Flame className="h-8 w-8 text-[#F1641E]" />
                <div>
                  <div className="text-xs text-muted-foreground">Daily Profit Goal</div>
                  <div className="text-xl font-bold">{formatCurrency(DAILY_PROFIT_GOAL, "USD")}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 border-t border-[#F1641E]/20 pt-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-8 w-8 text-[#F1641E]" />
                <div>
                  <div className="text-xs text-muted-foreground">Monthly Profit Projection</div>
                  <div className="text-xl font-bold">{formatCurrency(MONTHLY_PROFIT_GOAL, "USD")}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-[#F1641E]" />
                <div>
                  <div className="text-xs text-muted-foreground">Annual Profit Projection</div>
                  <div className="text-xl font-bold">{formatCurrency(ANNUAL_PROFIT_GOAL, "USD")}</div>
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Hit {DAILY_AVG_SALES} sales today and bank {formatCurrency(DAILY_PROFIT_GOAL, "USD")} in profit. Keep pushing!
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={fadeInUp}>
          <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Boxes className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalValue, "USD")}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Vendors</CardTitle>
              <PackageSearch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vendorCount}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Low / Out of Stock</CardTitle>
              <TriangleAlert className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockCount}</div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <ProductTable
        products={categoryFiltered}
        totalProductCount={products.length}
        category={category}
        categories={categories}
        onCategoryChange={setCategory}
      />
    </div>
  )
}
