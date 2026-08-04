import { useEffect, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  CircleCheck,
  ExternalLink,
  Info,
  Loader2,
  Sparkles,
  Store,
  Trash2,
} from "lucide-react"
import type { Product, ProductStatus } from "@/types/product"
import type { EtsyDefaultFields, EtsyListingFields } from "@/types/channel-listing"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProductThumbnail } from "@/components/product-thumbnail"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { removeProduct, updateProduct, useProduct } from "@/lib/product-store"
import { generateEtsyCopy } from "@/server/etsy-copy"
import { generateImagePrompt } from "@/server/image-prompt"
import {
  removeChannelListing,
  upsertChannelListing,
  useChannelListing,
} from "@/lib/channel-listing-store"
import { useEtsyDefaults } from "@/lib/etsy-settings-store"
import {
  COLOR_OPTIONS,
  RENEWAL_OPTIONS,
  WHEN_MADE_OPTIONS,
  WHO_MADE_OPTIONS,
  resolvedDescription,
  resolvedPrice,
  resolvedQuantity,
  resolvedTitle,
  resolvedVendorSku,
} from "@/lib/channel-registry"
import { PRODUCT_STATUS_OPTIONS } from "@/lib/product-options"
import { fadeInUp } from "@/lib/motion"

type DetailTab = "details" | "etsy"

interface ProductDetailSearch {
  tab?: DetailTab
}

export const Route = createFileRoute("/products/$productId")({
  validateSearch: (search: Record<string, unknown>): ProductDetailSearch => ({
    tab: search.tab === "etsy" || search.tab === "details" ? search.tab : undefined,
  }),
  component: ProductDetail,
})

type FormState = Pick<
  Product,
  | "name"
  | "sku"
  | "category"
  | "description"
  | "price"
  | "stock"
  | "status"
  | "imageUrl"
> & {
  imagePrompt: string
}

interface EtsyFormState {
  vendorSku: string
  title: string
  description: string
  price: number
  quantity: number
  fields: EtsyListingFields
  tagsText: string
  materialsText: string
}

function buildEtsyForm(
  product: Product,
  listing: ReturnType<typeof useChannelListing>,
  defaultFields: EtsyDefaultFields
): EtsyFormState {
  const fields: EtsyListingFields = listing?.fields ?? { ...defaultFields, tags: [], materials: [] }
  return {
    vendorSku: listing ? resolvedVendorSku(product, listing) : product.sku,
    title: listing ? resolvedTitle(product, listing) : product.name,
    description: listing ? resolvedDescription(product, listing) : product.description,
    price: listing ? resolvedPrice(product, listing) : product.price,
    quantity: listing ? resolvedQuantity(product, listing) : product.stock,
    fields,
    tagsText: fields.tags.join(", "),
    materialsText: fields.materials.join(", "),
  }
}

function ProductDetail() {
  const { productId } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = useNavigate()
  const product = useProduct(productId)
  const etsyListing = useChannelListing(productId, "etsy")
  const etsyDefaults = useEtsyDefaults()
  const [form, setForm] = useState<FormState | null>(null)
  const [etsyForm, setEtsyForm] = useState<EtsyFormState | null>(null)
  const [generatingEtsyCopy, setGeneratingEtsyCopy] = useState(false)
  const [generatingImagePrompt, setGeneratingImagePrompt] = useState(false)
  const activeTab: DetailTab = tab ?? "details"

  function setActiveTab(next: string) {
    navigate({
      to: "/products/$productId",
      params: { productId },
      search: next === "details" ? {} : { tab: next as DetailTab },
      replace: true,
    })
  }

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku,
        category: product.category,
        description: product.description,
        price: product.price,
        stock: product.stock,
        status: product.status,
        imageUrl: product.imageUrl,
        imagePrompt: product.imagePrompt ?? "",
      })
      setEtsyForm(buildEtsyForm(product, etsyListing, etsyDefaults))
    }
  }, [product?.id])

  if (!product || !form || !etsyForm) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6 text-center">
        <p className="text-muted-foreground">Product not found.</p>
        <Button variant="outline" asChild>
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Inventory
          </Link>
        </Button>
      </div>
    )
  }

  async function handleSave() {
    if (!form) return
    const imagePromptChanged = form.imagePrompt !== (product!.imagePrompt ?? "")
    await updateProduct(product!.id, {
      ...form,
      ...(imagePromptChanged ? { imagePromptGeneratedAt: new Date().toISOString() } : {}),
    })
    toast.success("Product saved")
  }

  async function handleGenerateImagePrompt() {
    if (!form || !product) return
    setGeneratingImagePrompt(true)
    try {
      const result = await generateImagePrompt({
        data: {
          name: product.name,
          description: product.description,
        },
      })
      setForm((prev) => (prev ? { ...prev, imagePrompt: result.prompt } : prev))
      toast.success("Image prompt generated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate image prompt")
    } finally {
      setGeneratingImagePrompt(false)
    }
  }

  async function handleDelete() {
    await removeProduct(product!.id)
    toast.success("Product deleted")
    navigate({ to: "/" })
  }

  async function handleSaveEtsyListing() {
    if (!etsyForm || !product) return
    const tags = etsyForm.tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 13)
    const materials = etsyForm.materialsText
      .split(",")
      .map((material) => material.trim())
      .filter(Boolean)
      .slice(0, 13)

    await upsertChannelListing(product.id, "etsy", {
      status: "ready",
      overrides: {
        name: etsyForm.title !== product.name ? etsyForm.title : undefined,
        description: etsyForm.description !== product.description ? etsyForm.description : undefined,
        price: etsyForm.price !== product.price ? etsyForm.price : undefined,
        stock: etsyForm.quantity !== product.stock ? etsyForm.quantity : undefined,
        sku: etsyForm.vendorSku !== product.sku ? etsyForm.vendorSku : undefined,
      },
      fields: { ...etsyForm.fields, tags, materials },
    })
    toast.success("Etsy listing saved")
  }

  async function handleRemoveEtsyListing() {
    if (!product) return
    await removeChannelListing(product.id, "etsy")
    setEtsyForm(buildEtsyForm(product, undefined, etsyDefaults))
    toast.success("Removed from Etsy")
  }

  async function handleGenerateEtsyCopy() {
    if (!etsyForm || !product) return
    setGeneratingEtsyCopy(true)
    try {
      const result = await generateEtsyCopy({
        data: {
          name: product.name,
          description: product.description,
        },
      })
      setEtsyForm((prev) =>
        prev
          ? {
              ...prev,
              title: result.title,
              description: result.description,
              tagsText: result.tags.join(", "),
              materialsText: result.materials.join(", "),
            }
          : prev
      )
      toast.success("Etsy title, description, tags, and materials generated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate Etsy copy")
    } finally {
      setGeneratingEtsyCopy(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <Button variant="ghost" size="sm" className="gap-2" asChild>
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </Link>
      </Button>

      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-4">
          <ProductThumbnail imageUrl={form.imageUrl} name={form.name} className="h-14 w-14 text-lg" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{form.name}</h1>
            <p className="text-sm text-muted-foreground">
              {product.vendorName} · Imported {new Date(product.importedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this product?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes "{product.name}" from your inventory. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={activeTab === "etsy" ? handleSaveEtsyListing : handleSave}>
            {activeTab === "etsy" ? (etsyListing ? "Save Etsy Listing" : "Add to Etsy") : "Save changes"}
          </Button>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
                    <TabsTrigger value="etsy" className="gap-1.5">
            <Store className="h-4 w-4" />
            Etsy Listing
            {etsyListing && <CircleCheck className="h-3.5 w-3.5 text-green-500" />}
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-1.5">
            <Info className="h-4 w-4" />
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <motion.div initial="hidden" animate="show" variants={fadeInUp}>
          <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value: ProductStatus) => setForm({ ...form, status: value })}
                  >
                    <SelectTrigger id="status" className="w-full">
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
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="price">Price ({product.currency})</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stock">Stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    min={0}
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="imageUrl">Image URL</Label>
                <div className="flex items-center gap-3">
                  <ProductThumbnail imageUrl={form.imageUrl} name={form.name} className="h-10 w-10" />
                  <Input
                    id="imageUrl"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  className="min-h-24"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="imagePrompt">Image Prompt</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleGenerateImagePrompt}
                    disabled={generatingImagePrompt}
                  >
                    {generatingImagePrompt ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Generate
                  </Button>
                </div>
                <Textarea
                  id="imagePrompt"
                  className="min-h-24"
                  placeholder="Describe the mockup image you want an AI image generator to create for this product..."
                  value={form.imagePrompt}
                  onChange={(e) => setForm({ ...form, imagePrompt: e.target.value })}
                />
                {product.imagePromptGeneratedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last generated {new Date(product.imagePromptGeneratedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Source</Label>
                <a
                  href={product.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {product.sourceUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="etsy" className="mt-6">
          <motion.div initial="hidden" animate="show" variants={fadeInUp}>
          <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {etsyListing ? `Last saved ${new Date(etsyListing.updatedAt).toLocaleString()}` : "Not listed on Etsy yet"}
              </p>
              <div className="flex items-center gap-2">
                {etsyListing && (
                  <Badge variant="secondary">
                    {etsyListing.status === "ready" ? "Ready to export" : etsyListing.status}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleGenerateEtsyCopy}
                  disabled={generatingEtsyCopy}
                >
                  {generatingEtsyCopy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generatingEtsyCopy ? "Generating…" : "Generate listing copy"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="etsyVendorSku">Vendor SKU</Label>
              <Input
                id="etsyVendorSku"
                value={etsyForm.vendorSku}
                onChange={(e) => setEtsyForm({ ...etsyForm, vendorSku: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etsyTaxonomy">Category</Label>
              <Input
                id="etsyTaxonomy"
                value={etsyForm.fields.taxonomyCategory}
                onChange={(e) =>
                  setEtsyForm({
                    ...etsyForm,
                    fields: { ...etsyForm.fields, taxonomyCategory: e.target.value },
                  })
                }
                placeholder="e.g. Jewelry > Necklaces"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etsyPrice">Price</Label>
              <Input
                id="etsyPrice"
                type="number"
                min={0}
                value={etsyForm.price}
                onChange={(e) => setEtsyForm({ ...etsyForm, price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etsyQuantity">Quantity</Label>
              <Input
                id="etsyQuantity"
                type="number"
                min={0}
                value={etsyForm.quantity}
                onChange={(e) => setEtsyForm({ ...etsyForm, quantity: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="etsyTitle">Title</Label>
            <Input
              id="etsyTitle"
              value={etsyForm.title}
              onChange={(e) => setEtsyForm({ ...etsyForm, title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="etsyDescription">Description</Label>
            <Textarea
              id="etsyDescription"
              className="min-h-20"
              value={etsyForm.description}
              onChange={(e) => setEtsyForm({ ...etsyForm, description: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="etsyWhoMade">Who made it?</Label>
              <Select
                value={etsyForm.fields.whoMade}
                onValueChange={(value: EtsyListingFields["whoMade"]) =>
                  setEtsyForm({ ...etsyForm, fields: { ...etsyForm.fields, whoMade: value } })
                }
              >
                <SelectTrigger id="etsyWhoMade" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHO_MADE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etsyWhenMade">When was it made?</Label>
              <Select
                value={etsyForm.fields.whenMade}
                onValueChange={(value: EtsyListingFields["whenMade"]) =>
                  setEtsyForm({ ...etsyForm, fields: { ...etsyForm.fields, whenMade: value } })
                }
              >
                <SelectTrigger id="etsyWhenMade" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHEN_MADE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etsyShipping">Shipping profile</Label>
              <Input
                id="etsyShipping"
                value={etsyForm.fields.shippingProfile}
                onChange={(e) =>
                  setEtsyForm({
                    ...etsyForm,
                    fields: { ...etsyForm.fields, shippingProfile: e.target.value },
                  })
                }
                placeholder="e.g. Standard US Shipping"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etsyRenewal">Renewal option</Label>
              <Select
                value={etsyForm.fields.renewalOption}
                onValueChange={(value: EtsyListingFields["renewalOption"]) =>
                  setEtsyForm({ ...etsyForm, fields: { ...etsyForm.fields, renewalOption: value } })
                }
              >
                <SelectTrigger id="etsyRenewal" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RENEWAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etsyPrimaryColor">Primary color</Label>
              <Select
                value={etsyForm.fields.primaryColor || undefined}
                onValueChange={(value) =>
                  setEtsyForm({ ...etsyForm, fields: { ...etsyForm.fields, primaryColor: value } })
                }
              >
                <SelectTrigger id="etsyPrimaryColor" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etsySecondaryColor">Secondary color</Label>
              <Select
                value={etsyForm.fields.secondaryColor || undefined}
                onValueChange={(value) =>
                  setEtsyForm({ ...etsyForm, fields: { ...etsyForm.fields, secondaryColor: value } })
                }
              >
                <SelectTrigger id="etsySecondaryColor" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="etsyTags">Tags (comma-separated, up to 13)</Label>
            <Input
              id="etsyTags"
              value={etsyForm.tagsText}
              onChange={(e) => setEtsyForm({ ...etsyForm, tagsText: e.target.value })}
              placeholder="e.g. gold necklace, minimalist jewelry"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="etsyMaterials">Materials (comma-separated, up to 13)</Label>
            <Input
              id="etsyMaterials"
              value={etsyForm.materialsText}
              onChange={(e) => setEtsyForm({ ...etsyForm, materialsText: e.target.value })}
              placeholder="e.g. 18k gold, sterling silver"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="etsyIsSupply">Craft supply</Label>
              <p className="text-xs text-muted-foreground">
                This is a supply or tool rather than a finished product
              </p>
            </div>
            <Switch
              id="etsyIsSupply"
              checked={etsyForm.fields.isSupply}
              onCheckedChange={(checked) =>
                setEtsyForm({ ...etsyForm, fields: { ...etsyForm.fields, isSupply: checked } })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="etsyPersonalization">Offer personalization</Label>
              <p className="text-xs text-muted-foreground">
                Buyers can add custom text to this listing
              </p>
            </div>
            <Switch
              id="etsyPersonalization"
              checked={etsyForm.fields.personalization}
              onCheckedChange={(checked) =>
                setEtsyForm({ ...etsyForm, fields: { ...etsyForm.fields, personalization: checked } })
              }
            />
          </div>

          {etsyForm.fields.personalization && (
            <div className="space-y-1.5">
              <Label htmlFor="etsyPersonalizationInstructions">Personalization instructions</Label>
              <Textarea
                id="etsyPersonalizationInstructions"
                className="min-h-16"
                value={etsyForm.fields.personalizationInstructions ?? ""}
                onChange={(e) =>
                  setEtsyForm({
                    ...etsyForm,
                    fields: { ...etsyForm.fields, personalizationInstructions: e.target.value },
                  })
                }
                placeholder="Tell buyers what to include, e.g. initials or a date"
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          {etsyListing ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={handleRemoveEtsyListing}
            >
              <Trash2 className="h-4 w-4" />
              Remove from Etsy
            </Button>
          ) : (
            <span />
          )}
          <Button size="sm" onClick={handleSaveEtsyListing}>
            {etsyListing ? "Save Etsy Listing" : "Add to Etsy"}
          </Button>
        </CardFooter>
      </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
