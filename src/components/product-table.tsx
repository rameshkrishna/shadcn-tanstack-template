import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { AnimatePresence, motion } from "framer-motion"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Columns3,
  Download,
  ExternalLink,
  ImageDown,
  ImagePlus,
  Loader2,
  PackageSearch,
  PencilLine,
  RefreshCw,
  Search,
  Sparkles,
  Store,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import type {
  Column,
  ColumnDef,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table"
import type { BulkJobResult, Product, ProductStatus } from "@/types/product"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ProductThumbnail } from "@/components/product-thumbnail"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { downloadCsv } from "@/lib/csv-export"
import { removeProducts, resyncProduct, updateProduct } from "@/lib/product-store"
import {
  getEtsyCopyBatchResults,
  getEtsyCopyBatchStatus,
  submitEtsyCopyBatch,
} from "@/server/etsy-copy"
import {
  getImagePromptBatchResults,
  getImagePromptBatchStatus,
  submitImagePromptBatch,
} from "@/server/image-prompt"
import {
  upsertChannelListing,
  useChannelListings,
  useChannelListingsForProduct,
} from "@/lib/channel-listing-store"
import { exportEtsyCsv } from "@/lib/channel-export"
import {
  CHANNEL_LABELS,
  CHANNEL_STATUS_LABEL,
  CHANNEL_STATUS_VARIANT,
  resolvedVendorSku,
} from "@/lib/channel-registry"
import { PRODUCT_STATUS_LABEL, PRODUCT_STATUS_VARIANT } from "@/lib/product-options"
import { BulkEditDialog } from "@/components/bulk-edit-dialog"
import { fadeIn } from "@/lib/motion"

const COLUMN_LABELS: Record<string, string> = {
  name: "Product",
  sku: "SKU",
  category: "Category",
  vendorName: "Vendor",
  imageUrl: "Image URL",
  importedAt: "Date Imported",
  price: "Price",
  stock: "Stock",
  status: "Status",
  channels: "Channels",
  imagePrompt: "Image Prompt",
}

function ChannelBadges({ productId }: { productId: string }) {
  const listings = useChannelListingsForProduct(productId)
  if (listings.length === 0) {
    return <span className="text-muted-foreground/50">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      <AnimatePresence initial={false}>
        {listings.map((listing) => (
          <motion.div
            key={listing.channel}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <Badge variant={CHANNEL_STATUS_VARIANT[listing.status]} className="gap-1 font-normal">
              {CHANNEL_LABELS[listing.channel]}
              <span className="opacity-70">{CHANNEL_STATUS_LABEL[listing.status]}</span>
            </Badge>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

interface OpenAiBatchStatus {
  status: string
  completed: number
  failed: number
  total: number
}

const BATCH_TERMINAL_STATUSES = new Set(["completed", "failed", "expired", "cancelled"])

async function pollBatchUntilDone(
  batchId: string,
  getStatus: (args: { data: { batchId: string } }) => Promise<OpenAiBatchStatus>,
  onUpdate: (status: OpenAiBatchStatus) => void
): Promise<OpenAiBatchStatus> {
  let delay = 3000
  for (;;) {
    const status = await getStatus({ data: { batchId } })
    onUpdate(status)
    if (BATCH_TERMINAL_STATUSES.has(status.status)) {
      return status
    }
    await new Promise((resolve) => setTimeout(resolve, delay))
    delay = Math.min(delay * 1.5, 20000)
  }
}

function BulkJobDialog({
  open,
  running,
  jobs,
  title,
  description,
  statusNote,
  workingLabel = "Generating…",
  onClose,
}: {
  open: boolean
  running: boolean
  jobs: Array<BulkJobResult>
  title: string
  description: string
  statusNote?: string
  workingLabel?: string
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {statusNote && (
          <p className="-mt-2 text-xs text-muted-foreground">{statusNote}</p>
        )}
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {jobs.map((job, index) => (
            <motion.div
              key={job.productId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: index * 0.03 }}
              className="flex items-center justify-between rounded-lg bg-muted/30 p-3"
            >
              <p className="truncate text-sm font-medium">{job.productName}</p>
              <div className="flex shrink-0 items-center gap-2 text-sm">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={job.status}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.12 }}
                    className="flex items-center gap-2"
                  >
                    {job.status === "pending" && (
                      <span className="text-muted-foreground">Waiting…</span>
                    )}
                    {job.status === "generating" && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-muted-foreground">{workingLabel}</span>
                      </>
                    )}
                    {job.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {running ? "Run in background" : "Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function SortableHeader({
  column,
  children,
  align,
}: {
  column: Column<Product, unknown>
  children: React.ReactNode
  align?: "end"
}) {
  const sorted = column.getIsSorted()
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-3 h-8 gap-1.5", align === "end" && "-mr-3 ml-0")}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {children}
      {sorted === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </Button>
  )
}

const columns: Array<ColumnDef<Product>> = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column}>Product</SortableHeader>,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <ProductThumbnail imageUrl={row.original.imageUrl} name={row.original.name} />
        <p className="min-w-0 truncate font-medium">{row.original.name}</p>
      </div>
    ),
  },
  {
    accessorKey: "sku",
    header: ({ column }) => <SortableHeader column={column}>SKU</SortableHeader>,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: "category",
    header: ({ column }) => <SortableHeader column={column}>Category</SortableHeader>,
  },
  {
    accessorKey: "vendorName",
    header: ({ column }) => <SortableHeader column={column}>Vendor</SortableHeader>,
  },
  {
    accessorKey: "imageUrl",
    header: "Image URL",
    enableSorting: false,
    cell: ({ getValue }) => (
      <a
        href={getValue<string>()}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex max-w-48 items-center gap-1 truncate text-primary hover:underline"
      >
        <span className="truncate">{getValue<string>()}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    ),
  },
  {
    accessorKey: "importedAt",
    header: ({ column }) => <SortableHeader column={column}>Date Imported</SortableHeader>,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{formatDate(getValue<string>())}</span>
    ),
  },
  {
    accessorKey: "price",
    header: ({ column }) => (
      <SortableHeader column={column} align="end">
        Price
      </SortableHeader>
    ),
    cell: ({ row }) => (
      <div className="text-right">{formatCurrency(row.original.price, row.original.currency)}</div>
    ),
  },
  {
    accessorKey: "stock",
    header: ({ column }) => (
      <SortableHeader column={column} align="end">
        Stock
      </SortableHeader>
    ),
    cell: ({ getValue }) => <div className="text-right">{getValue<number>()}</div>,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
    cell: ({ getValue }) => {
      const status = getValue<ProductStatus>()
      return <Badge variant={PRODUCT_STATUS_VARIANT[status]}>{PRODUCT_STATUS_LABEL[status]}</Badge>
    },
  },
  {
    id: "channels",
    header: "Channels",
    enableSorting: false,
    cell: ({ row }) => <ChannelBadges productId={row.original.id} />,
  },
  {
    accessorKey: "imagePrompt",
    header: "Image Prompt",
    enableSorting: false,
    cell: ({ getValue }) => {
      const value = getValue<string | undefined>()
      return value ? (
        <span className="line-clamp-2 max-w-64 text-muted-foreground">{value}</span>
      ) : (
        <span className="text-muted-foreground/50">—</span>
      )
    },
  },
]

interface ProductTableProps {
  products: Array<Product>
  totalProductCount: number
  category: string
  categories: Array<string>
  onCategoryChange: (value: string) => void
}

export function ProductTable({
  products,
  totalProductCount,
  category,
  categories,
  onCategoryChange,
}: ProductTableProps) {
  const navigate = useNavigate()
  const channelListings = useChannelListings()
  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    imageUrl: false,
  })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [etsyCopyDialogOpen, setEtsyCopyDialogOpen] = useState(false)
  const [etsyCopyRunning, setEtsyCopyRunning] = useState(false)
  const [etsyCopyJobs, setEtsyCopyJobs] = useState<Array<BulkJobResult>>([])
  const [etsyCopyStatusNote, setEtsyCopyStatusNote] = useState("")
  const [imagePromptDialogOpen, setImagePromptDialogOpen] = useState(false)
  const [imagePromptRunning, setImagePromptRunning] = useState(false)
  const [imagePromptJobs, setImagePromptJobs] = useState<Array<BulkJobResult>>([])
  const [imagePromptStatusNote, setImagePromptStatusNote] = useState("")
  const [imagesDownloading, setImagesDownloading] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [resyncDialogOpen, setResyncDialogOpen] = useState(false)
  const [resyncRunning, setResyncRunning] = useState(false)
  const [resyncJobs, setResyncJobs] = useState<Array<BulkJobResult>>([])

  const table = useReactTable({
    data: products,
    columns,
    state: { sorting, columnVisibility, globalFilter, rowSelection },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
    globalFilterFn: (row, columnId, filterValue) => {
      const value = row.getValue(columnId)
      return String(value ?? "")
        .toLowerCase()
        .includes(String(filterValue).toLowerCase())
    },
  })

  const filteredRows = table.getFilteredRowModel().rows
  const pageRows = table.getRowModel().rows
  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex
  const selectedRows = table.getFilteredSelectedRowModel().rows

  function exportRows(rows: Array<Product>, filename: string) {
    const visibleColumns = table.getVisibleLeafColumns().filter((c) => c.id !== "select")
    const headers = visibleColumns.map((c) => COLUMN_LABELS[c.id] ?? c.id)
    const csvRows = rows.map((product) =>
      visibleColumns.map((col) => {
        if (col.id === "price") {
          return formatCurrency(product.price, product.currency)
        }
        if (col.id === "importedAt") {
          return formatDate(product.importedAt)
        }
        if (col.id === "channels") {
          return channelListings
            .filter((l) => l.productId === product.id)
            .map((l) => `${CHANNEL_LABELS[l.channel]}: ${CHANNEL_STATUS_LABEL[l.status]}`)
            .join("; ")
        }
        return String(product[col.id as keyof Product] ?? "")
      })
    )
    downloadCsv(filename, headers, csvRows)
  }

  function handleExportAll() {
    exportRows(
      filteredRows.map((r) => r.original),
      "inventory-export.csv"
    )
  }

  function handleExportSelected() {
    exportRows(
      selectedRows.map((r) => r.original),
      "inventory-selected-export.csv"
    )
  }

  async function handleExportEtsySelected() {
    const selectedProducts = selectedRows.map((r) => r.original)
    const withListing = selectedProducts.filter((p) =>
      channelListings.some((l) => l.productId === p.id && l.channel === "etsy")
    )
    if (withListing.length === 0) {
      toast.error("None of the selected products have an Etsy listing yet")
      return
    }
    exportEtsyCsv(withListing, channelListings, "etsy-export.csv")
    await Promise.all(
      withListing.map((product) => upsertChannelListing(product.id, "etsy", { status: "exported" }))
    )
    if (withListing.length < selectedProducts.length) {
      toast.info(
        `Exported ${withListing.length} of ${selectedProducts.length} — the rest have no Etsy listing`
      )
    }
  }

  async function handleDeleteSelected() {
    const ids = selectedRows.map((r) => r.original.id)
    await removeProducts(ids)
    setRowSelection({})
    toast.success(`Deleted ${ids.length} product${ids.length === 1 ? "" : "s"}`)
  }

  async function handleResyncSelected() {
    const targets = selectedRows.map((r) => r.original)
    setResyncDialogOpen(true)
    setResyncRunning(true)
    setResyncJobs(targets.map((p) => ({ productId: p.id, productName: p.name, status: "pending" })))

    function setJob(productId: string, patch: Partial<BulkJobResult>) {
      setResyncJobs((prev) => prev.map((job) => (job.productId === productId ? { ...job, ...patch } : job)))
    }

    let successCount = 0
    for (const product of targets) {
      setJob(product.id, { status: "generating" })
      try {
        await resyncProduct(product.id)
        setJob(product.id, { status: "done" })
        successCount += 1
      } catch (error) {
        setJob(product.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Resync failed",
        })
      }
    }

    setResyncRunning(false)
    if (successCount > 0) {
      toast.success(`Resynced ${successCount} product${successCount === 1 ? "" : "s"}`)
    }
    if (successCount < targets.length) {
      toast.error(`Failed to resync ${targets.length - successCount} product(s)`)
    }
  }

  async function handleGenerateEtsyCopy() {
    const targets = selectedRows.map((r) => r.original)
    setEtsyCopyDialogOpen(true)
    setEtsyCopyRunning(true)
    setEtsyCopyStatusNote("Submitting batch to OpenAI…")
    setEtsyCopyJobs(
      targets.map((p) => ({ productId: p.id, productName: p.name, status: "pending" }))
    )

    function setJob(productId: string, patch: Partial<BulkJobResult>) {
      setEtsyCopyJobs((prev) =>
        prev.map((job) => (job.productId === productId ? { ...job, ...patch } : job))
      )
    }

    try {
      const { batchId } = await submitEtsyCopyBatch({
        data: {
          products: targets.map((p) => ({ id: p.id, name: p.name, description: p.description })),
        },
      })

      setEtsyCopyJobs((prev) => prev.map((job) => ({ ...job, status: "generating" })))

      const finalStatus = await pollBatchUntilDone(batchId, getEtsyCopyBatchStatus, (status) => {
        setEtsyCopyStatusNote(
          `OpenAI batch ${status.status} — ${status.completed + status.failed}/${status.total} done`
        )
      })

      if (finalStatus.status !== "completed") {
        for (const product of targets) {
          setJob(product.id, { status: "error", error: `Batch ${finalStatus.status}` })
        }
        setEtsyCopyStatusNote(`Batch ${finalStatus.status} — no results generated`)
        toast.error(`Etsy copy batch ${finalStatus.status}`)
        return
      }

      const results = await getEtsyCopyBatchResults({ data: { batchId } })
      let successCount = 0

      for (const product of targets) {
        const result = results[product.id]
        if (result?.ok) {
          await upsertChannelListing(product.id, "etsy", {
            overrides: { name: result.title, description: result.description },
            fields: { tags: result.tags, materials: result.materials },
          })
          setJob(product.id, { status: "done" })
          successCount += 1
        } else {
          setJob(product.id, { status: "error", error: result?.error ?? "No result returned" })
        }
      }

      setEtsyCopyStatusNote("")
      if (successCount > 0) {
        toast.success(
          `Generated Etsy copy for ${successCount} product${successCount === 1 ? "" : "s"}`
        )
      }
      if (successCount < targets.length) {
        toast.error(`Failed to generate Etsy copy for ${targets.length - successCount} product(s)`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Batch failed"
      for (const product of targets) {
        setJob(product.id, { status: "error", error: message })
      }
      setEtsyCopyStatusNote("Batch submission failed")
      toast.error(message)
    } finally {
      setEtsyCopyRunning(false)
    }
  }

  async function handleGenerateImagePrompts() {
    const targets = selectedRows.map((r) => r.original)
    setImagePromptDialogOpen(true)
    setImagePromptRunning(true)
    setImagePromptStatusNote("Submitting batch to OpenAI…")
    setImagePromptJobs(
      targets.map((p) => ({ productId: p.id, productName: p.name, status: "pending" }))
    )

    function setJob(productId: string, patch: Partial<BulkJobResult>) {
      setImagePromptJobs((prev) =>
        prev.map((job) => (job.productId === productId ? { ...job, ...patch } : job))
      )
    }

    try {
      const { batchId } = await submitImagePromptBatch({
        data: {
          products: targets.map((p) => ({ id: p.id, name: p.name, description: p.description })),
        },
      })

      setImagePromptJobs((prev) => prev.map((job) => ({ ...job, status: "generating" })))

      const finalStatus = await pollBatchUntilDone(batchId, getImagePromptBatchStatus, (status) => {
        setImagePromptStatusNote(
          `OpenAI batch ${status.status} — ${status.completed + status.failed}/${status.total} done`
        )
      })

      if (finalStatus.status !== "completed") {
        for (const product of targets) {
          setJob(product.id, { status: "error", error: `Batch ${finalStatus.status}` })
        }
        setImagePromptStatusNote(`Batch ${finalStatus.status} — no results generated`)
        toast.error(`Image prompt batch ${finalStatus.status}`)
        return
      }

      const results = await getImagePromptBatchResults({ data: { batchId } })
      let successCount = 0

      for (const product of targets) {
        const result = results[product.id]
        if (result?.ok) {
          await updateProduct(product.id, {
            imagePrompt: result.prompt,
            imagePromptGeneratedAt: new Date().toISOString(),
          })
          setJob(product.id, { status: "done" })
          successCount += 1
        } else {
          setJob(product.id, { status: "error", error: result?.error ?? "No result returned" })
        }
      }

      setImagePromptStatusNote("")
      if (successCount > 0) {
        toast.success(`Generated ${successCount} image prompt${successCount === 1 ? "" : "s"}`)
      }
      if (successCount < targets.length) {
        toast.error(
          `Failed to generate image prompts for ${targets.length - successCount} product(s)`
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Batch failed"
      for (const product of targets) {
        setJob(product.id, { status: "error", error: message })
      }
      setImagePromptStatusNote("Batch submission failed")
      toast.error(message)
    } finally {
      setImagePromptRunning(false)
    }
  }

  function handleExportMockups() {
    const selectedProducts = selectedRows.map((r) => r.original)
    const withPrompt = selectedProducts.filter((p) => p.imagePrompt)
    if (withPrompt.length === 0) {
      toast.error("None of the selected products have an image prompt yet — generate them first")
      return
    }
    const rows = withPrompt.map((product) => {
      const listing = channelListings.find(
        (l) => l.productId === product.id && l.channel === "etsy"
      )
      const vendorSku = listing ? resolvedVendorSku(product, listing) : product.sku
      return [vendorSku, product.imagePrompt ?? ""]
    })
    downloadCsv("mockup-prompts.csv", ["vendor_sku", "image_prompt"], rows)
    if (withPrompt.length < selectedProducts.length) {
      toast.info(
        `Exported ${withPrompt.length} of ${selectedProducts.length} — the rest have no image prompt yet`
      )
    }
  }

  async function handleDownloadImagesSelected() {
    const selectedProducts = selectedRows.map((r) => r.original)
    if (selectedProducts.length === 0) return

    setImagesDownloading(true)
    try {
      const response = await fetch("/api/download-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: selectedProducts.map((p) => ({ id: p.id, sku: p.sku, imageUrl: p.imageUrl })),
        }),
      })

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(error?.message ?? "Failed to download images")
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "product-images.zip"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      const failedCount = Number(response.headers.get("X-Failed-Count") ?? 0)
      if (failedCount > 0) {
        toast.info(
          `Downloaded images — ${failedCount} product image${failedCount === 1 ? "" : "s"} failed to fetch`
        )
      } else {
        toast.success(
          `Downloaded images for ${selectedProducts.length} product${selectedProducts.length === 1 ? "" : "s"}`
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download images")
    } finally {
      setImagesDownloading(false)
    }
  }

  const rangeStart = filteredRows.length === 0 ? 0 : pageIndex * table.getState().pagination.pageSize + 1
  const rangeEnd = pageIndex * table.getState().pagination.pageSize + pageRows.length

  return (
    <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Products</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, SKU, vendor..."
              className="w-full pl-9 sm:w-56"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Columns3 className="h-4 w-4" />
                Fields
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {COLUMN_LABELS[column.id] ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExportAll}
            disabled={filteredRows.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {totalProductCount === 0 ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeIn}
            className="flex flex-col items-center gap-3 py-16 text-center"
          >
            <PackageSearch className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No products yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Import your first catalog by pasting a vendor's sitemap URLs.
            </p>
            <Button className="mt-2 gap-2" asChild>
              <Link to="/import_products">
                <Upload className="h-4 w-4" />
                Import Products
              </Link>
            </Button>
          </motion.div>
        ) : filteredRows.length === 0 ? (
          <motion.p
            initial="hidden"
            animate="show"
            variants={fadeIn}
            className="py-10 text-center text-sm text-muted-foreground"
          >
            No products match your search.
          </motion.p>
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {selectedRows.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2">
                <p className="text-sm font-medium">{selectedRows.length} selected</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setBulkEditOpen(true)}
                  >
                    <PencilLine className="h-4 w-4" />
                    Bulk Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={resyncRunning}
                    onClick={handleResyncSelected}
                  >
                    {resyncRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Resync
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        Generate
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={handleGenerateEtsyCopy} className="gap-2">
                        <Store className="h-4 w-4" />
                        Etsy listing copy
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleGenerateImagePrompts} className="gap-2">
                        <ImagePlus className="h-4 w-4" />
                        Mockup image prompts
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={handleExportSelected} className="gap-2">
                        <Download className="h-4 w-4" />
                        Selected (CSV)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleExportEtsySelected} className="gap-2">
                        <Store className="h-4 w-4" />
                        Etsy listing (CSV)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleExportMockups} className="gap-2">
                        <ImagePlus className="h-4 w-4" />
                        Mockup prompts (CSV)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={handleDownloadImagesSelected}
                        disabled={imagesDownloading}
                        className="gap-2"
                      >
                        {imagesDownloading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImageDown className="h-4 w-4" />
                        )}
                        {imagesDownloading ? "Downloading images…" : "Images (ZIP)"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Selected
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedRows.length} product{selectedRows.length === 1 ? "" : "s"}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the selected products from your inventory. This can't be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSelected}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setRowSelection({})}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Clear selection</span>
                  </Button>
                </div>
              </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                <AnimatePresence initial={false}>
                  {pageRows.map((row, index) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: index * 0.02 }}
                      className="cursor-pointer border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted"
                      onClick={() =>
                        navigate({
                          to: "/products/$productId",
                          params: { productId: row.original.id },
                        })
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {rangeStart}-{rangeEnd} of {filteredRows.length}
              </p>
              <div className="flex items-center gap-4">
                <Select
                  value={String(table.getState().pagination.pageSize)}
                  onValueChange={(value) => table.setPageSize(Number(value))}
                >
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <BulkJobDialog
        open={etsyCopyDialogOpen}
        running={etsyCopyRunning}
        jobs={etsyCopyJobs}
        title="Generating Etsy listing copy"
        description="OpenAI is writing Etsy-optimized titles, descriptions, tags, and materials from each product's title and description via a batch job."
        statusNote={etsyCopyStatusNote}
        onClose={() => {
          setEtsyCopyDialogOpen(false)
          setRowSelection({})
        }}
      />

      <BulkJobDialog
        open={imagePromptDialogOpen}
        running={imagePromptRunning}
        jobs={imagePromptJobs}
        title="Generating mockup image prompts"
        description="OpenAI is writing an image-generation prompt from each product's title and description via a batch job."
        statusNote={imagePromptStatusNote}
        onClose={() => {
          setImagePromptDialogOpen(false)
          setRowSelection({})
        }}
      />

      <BulkJobDialog
        open={resyncDialogOpen}
        running={resyncRunning}
        jobs={resyncJobs}
        title="Resyncing products"
        description="Re-fetching each product's page to refresh price, stock, status, description, and image from the source."
        workingLabel="Resyncing…"
        onClose={() => {
          setResyncDialogOpen(false)
          setRowSelection({})
        }}
      />

      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        products={selectedRows.map((r) => r.original)}
        categories={categories}
      />
    </Card>
  )
}
