import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { Save, Settings as SettingsIcon, Store } from "lucide-react"
import type { EtsyDefaultFields, EtsyListingFields } from "@/types/channel-listing"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { saveEtsyDefaults, useEtsyDefaults } from "@/lib/etsy-settings-store"
import {
  COLOR_OPTIONS,
  RENEWAL_OPTIONS,
  WHEN_MADE_OPTIONS,
  WHO_MADE_OPTIONS,
} from "@/lib/channel-registry"
import { fadeInUp } from "@/lib/motion"

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  const etsyDefaults = useEtsyDefaults()
  const [form, setForm] = useState<EtsyDefaultFields>(etsyDefaults)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await saveEtsyDefaults(form)
      toast.success("Etsy defaults saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Default values applied to every new channel listing.
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </motion.div>

      <motion.div initial="hidden" animate="show" variants={fadeInUp}>
        <Card className="border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
          <CardHeader className="flex flex-row items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle>Etsy listing defaults</CardTitle>
              <CardDescription>
                Used whenever a product is first added to Etsy — you can still override any of
                these per-listing afterward.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="whoMade">Who made it?</Label>
                <Select
                  value={form.whoMade}
                  onValueChange={(value: EtsyListingFields["whoMade"]) =>
                    setForm({ ...form, whoMade: value })
                  }
                >
                  <SelectTrigger id="whoMade" className="w-full">
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
                <Label htmlFor="whenMade">When was it made?</Label>
                <Select
                  value={form.whenMade}
                  onValueChange={(value: EtsyListingFields["whenMade"]) =>
                    setForm({ ...form, whenMade: value })
                  }
                >
                  <SelectTrigger id="whenMade" className="w-full">
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
                <Label htmlFor="taxonomyCategory">Category</Label>
                <Input
                  id="taxonomyCategory"
                  value={form.taxonomyCategory}
                  onChange={(e) => setForm({ ...form, taxonomyCategory: e.target.value })}
                  placeholder="e.g. Jewelry > Necklaces"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shippingProfile">Shipping profile</Label>
                <Input
                  id="shippingProfile"
                  value={form.shippingProfile}
                  onChange={(e) => setForm({ ...form, shippingProfile: e.target.value })}
                  placeholder="e.g. Standard US Shipping"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="renewalOption">Renewal option</Label>
                <Select
                  value={form.renewalOption}
                  onValueChange={(value: EtsyListingFields["renewalOption"]) =>
                    setForm({ ...form, renewalOption: value })
                  }
                >
                  <SelectTrigger id="renewalOption" className="w-full">
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
                <Label htmlFor="primaryColor">Primary color</Label>
                <Select
                  value={form.primaryColor || undefined}
                  onValueChange={(value) => setForm({ ...form, primaryColor: value })}
                >
                  <SelectTrigger id="primaryColor" className="w-full">
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
                <Label htmlFor="secondaryColor">Secondary color</Label>
                <Select
                  value={form.secondaryColor || undefined}
                  onValueChange={(value) => setForm({ ...form, secondaryColor: value })}
                >
                  <SelectTrigger id="secondaryColor" className="w-full">
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

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="isSupply">Craft supply</Label>
                <p className="text-xs text-muted-foreground">
                  Default new listings to "this is a supply or tool" rather than a finished product
                </p>
              </div>
              <Switch
                id="isSupply"
                checked={form.isSupply}
                onCheckedChange={(checked) => setForm({ ...form, isSupply: checked })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="personalization">Offer personalization</Label>
                <p className="text-xs text-muted-foreground">
                  Default new listings to letting buyers add custom text
                </p>
              </div>
              <Switch
                id="personalization"
                checked={form.personalization}
                onCheckedChange={(checked) => setForm({ ...form, personalization: checked })}
              />
            </div>

            {form.personalization && (
              <div className="space-y-1.5">
                <Label htmlFor="personalizationInstructions">
                  Default personalization instructions
                </Label>
                <Textarea
                  id="personalizationInstructions"
                  className="min-h-16"
                  value={form.personalizationInstructions ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, personalizationInstructions: e.target.value })
                  }
                  placeholder="Tell buyers what to include, e.g. initials or a date"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
