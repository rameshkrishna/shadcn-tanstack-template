# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo reseller (Sterling Luxe Co) running this as their own internal back-office
tool — not customer-facing. One person handles sourcing, listing, pricing, and
Etsy publishing through this app.

## Product Purpose

Turns vendor product catalogs into ready-to-publish Etsy listings. Covers the
full loop: import products from vendor sitemaps/product pages, hold them as
inventory, generate Etsy-ready copy, apply per-category pricing rules, and
export a CSV that drives Etsy publishing. Success is a fast, low-friction path
from "found a vendor product" to "live, correctly-priced Etsy listing."

## Positioning

An end-to-end pipeline, not a single-purpose utility: scrape any vendor
sitemap or product URL → normalize into inventory → AI-generate Etsy-ready
copy (title/description/tags/materials) → apply per-category margin pricing →
export a CSV for the Etsy-filler browser extension. A neighboring tool that
only does AI copy, or only does scraping, couldn't replace this without
reassembling the rest of the loop by hand.

## Operating Context

- Companion system: a Python pipeline (`SterlingLuxeCo/jewelpipe`,
  `core/stages/discover.py`) that this app's catalog-scrape logic mirrors but
  generalizes — the Python version is scoped per-vendor; this app accepts any
  sitemap/product URL pasted in.
- Downstream: a separate browser extension fills Etsy's "Add a listing" form
  by reading the CSV this app exports. `IMPORT_DATA_CONTRACT.md` at the repo
  root is the authoritative spec for that CSV's shape — treat it as binding
  when touching export logic.
- Product categories seen in scraping logic: Jewelry, Watches, Handbags,
  Sunglasses, Footwear — this is a general luxury-goods reseller, not
  jewelry-only despite the app name.
- Core workflows: Import Products (paste vendor URLs) → Inventory (review/
  filter/bulk-edit) → per-product channel listing (Etsy fields, AI-generated
  copy) → Pricing Strategy (category margin rules, pushed to Etsy listings) →
  Settings (default Etsy field values for new listings) → CSV export.

## Capabilities and Constraints

- Etsy is the only sales channel implemented today (`ChannelId = "etsy"` in
  `channel-registry.ts`), but the type is structured to admit more channels
  later — avoid hard-coding Etsy-only assumptions into shared UI where a
  multi-channel future is cheap to keep open.
- Local-first, single-user: SQLite via `better-sqlite3`, no auth, no
  multi-tenant concerns. Designed to run on one person's machine against one
  shop's data.
- AI copy generation (title/description/tags/materials) is OpenAI-backed
  (`gpt-4.1-mini`), both single-product and batch modes.
- Etsy CSV export is not the end of the workflow — it's an input to a
  separate, already-built tool. Column shape, enum values, and separator
  rules (`|` for multi-value fields) are fixed by that tool's parser and must
  not drift without updating `IMPORT_DATA_CONTRACT.md` and the extension in
  lockstep.

## Evidence on Hand

- `IMPORT_DATA_CONTRACT.md` — authoritative CSV export contract, including
  two real past import failures (bad `shipping_profile`, comma- vs
  pipe-separated `materials`) that any future export logic must not repeat.
- No customer testimonials, case studies, or press exist or should be
  fabricated — this is an internal tool with no external-facing marketing
  surface.

## Product Principles

1. The loop matters more than any single stage — sourcing, copy, pricing, and
   export should stay connected, not become disconnected point tools.
2. Trust the vendor/live source over a plausible-looking default — the CSV
   contract's own lessons (shipping profile names, materials vocabulary) show
   that invented-but-plausible values fail silently downstream.
3. Single-operator efficiency over collaboration features — this is one
   person's daily tool; don't add multi-user complexity the product doesn't
   need.
4. Etsy-specific today, multi-channel-shaped tomorrow — keep the door open in
   the data model without building for channels that don't exist yet.
