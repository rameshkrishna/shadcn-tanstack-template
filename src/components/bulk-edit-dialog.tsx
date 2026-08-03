import { useEffect, useState } from "react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import type { Product, ProductStatus } from "@/types/product"
import type { ChannelListing } from "@/types/channel-listing"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateProduct } from "@/lib/product-store"
import { upsertChannelListing } from "@/lib/channel-listing-store"
import { CHANNEL_STATUS_OPTIONS } from "@/lib/channel-registry"
import { PRODUCT_STATUS_OPTIONS } from "@/lib/product-options"
import { fadeInUp, staggerContainer } from "@/lib/motion"

interface BulkEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Array<Product>
  categories: Array<string>
}

function initialState(categories: Array<string>) {
  return {
    category: { enabled: false, value: categories[0] ?? "" },
    status: { enabled: false, value: "in-stock" as ProductStatus },
    price: { enabled: false, value: 0 },
    stock: { enabled: false, value: 0 },
    etsyStatus: { enabled: false, value: "ready" as ChannelListing["status"] },
  }
}

type BulkEditState = ReturnType<typeof initialState>

function BulkEditRow({
  label,
  enabled,
  onEnabledChange,
  hint,
  children,
}: {
  label: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  hint?: string
  children: React.ReactNode
}) {
  const inputId = `bulk-edit-${label.toLowerCase().replace(/\s+/g, "-")}`
  return (
    <motion.div
      variants={fadeInUp}
      className="flex items-start gap-3 rounded-lg border border-border p-3"
    >
      <Checkbox
        id={inputId}
        checked={enabled}
        onCheckedChange={(value) => onEnabledChange(!!value)}
        className="mt-1"
      />
      <div className="flex-1 space-y-1.5">
        <Label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </Label>
        <div className={enabled ? undefined : "pointer-events-none opacity-50"}>{children}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </motion.div>
  )
}

export function BulkEditDialog({ open, onOpenChange, products, categories }: BulkEditDialogProps) {
  const [state, setState] = useState<BulkEditState>(() => initialState(categories))

  useEffect(() => {
    if (open) setState(initialState(categories))
  }, [open])

  function updateField<TKey extends keyof BulkEditState>(
    key: TKey,
    patch: Partial<BulkEditState[TKey]>
  ) {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const enabledCount = Object.values(state).filter((field) => field.enabled).length

  async function handleApply() {
    await Promise.all(
      products.map(async (product) => {
        const patch: Partial<Product> = {}
        if (state.category.enabled) patch.category = state.category.value
        if (state.status.enabled) patch.status = state.status.value
        if (state.price.enabled) patch.price = state.price.value
        if (state.stock.enabled) patch.stock = state.stock.value
        if (Object.keys(patch).length > 0) {
          await updateProduct(product.id, patch)
        }
        if (state.etsyStatus.enabled) {
          await upsertChannelListing(product.id, "etsy", { status: state.etsyStatus.value })
        }
      })
    )
    toast.success(`Updated ${products.length} product${products.length === 1 ? "" : "s"}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Bulk edit {products.length} product{products.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Turn on a field to apply the same value to every selected product.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="max-h-[26rem] space-y-3 overflow-y-auto py-1"
        >
          <BulkEditRow
            label="Category"
            enabled={state.category.enabled}
            onEnabledChange={(enabled) => updateField("category", { enabled })}
          >
            <Select
              value={state.category.value}
              onValueChange={(value) => updateField("category", { value })}
            >
              <SelectTrigger className="w-full">
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
          </BulkEditRow>

          <BulkEditRow
            label="Status"
            enabled={state.status.enabled}
            onEnabledChange={(enabled) => updateField("status", { enabled })}
          >
            <Select
              value={state.status.value}
              onValueChange={(value: ProductStatus) => updateField("status", { value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </BulkEditRow>

          <BulkEditRow
            label="Price"
            enabled={state.price.enabled}
            onEnabledChange={(enabled) => updateField("price", { enabled })}
          >
            <Input
              type="number"
              min={0}
              value={state.price.value}
              onChange={(e) => updateField("price", { value: Number(e.target.value) })}
            />
          </BulkEditRow>

          <BulkEditRow
            label="Stock"
            enabled={state.stock.enabled}
            onEnabledChange={(enabled) => updateField("stock", { enabled })}
          >
            <Input
              type="number"
              min={0}
              value={state.stock.value}
              onChange={(e) => updateField("stock", { value: Number(e.target.value) })}
            />
          </BulkEditRow>

          <BulkEditRow
            label="Etsy status"
            enabled={state.etsyStatus.enabled}
            onEnabledChange={(enabled) => updateField("etsyStatus", { enabled })}
            hint="Creates an Etsy listing for any selected product that doesn't have one yet."
          >
            <Select
              value={state.etsyStatus.value}
              onValueChange={(value: ChannelListing["status"]) =>
                updateField("etsyStatus", { value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </BulkEditRow>
        </motion.div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={enabledCount === 0}>
            Apply to {products.length} product{products.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
