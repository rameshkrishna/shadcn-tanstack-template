# Code Review — Sterling Luxe Inventory

Scope: full `src/` review (excluding generated `components/ui/*` and `routeTree.gen.ts`), prioritizing correctness, security, performance, and maintainability. Context: internal, single-user listing manager (products → Etsy channel listings), TanStack Start + React Query + Drizzle/better-sqlite3.

Overall: the codebase is in good shape — clean layering (types → server fns → query options → store hooks → components), consistent style, and sensible comments where behavior is non-obvious. The recommendations below are ordered by impact.

---

## 1. Correctness & data integrity

### 1.1 `channel_listings` has no unique constraint on `(product_id, channel)` — HIGH
`src/server/db/schema.ts:29` and `src/server/channel-listings.ts:24`

`upsertChannelListingFn` does a read-then-insert ("check if exists, else insert"). Nothing in the schema prevents two rows for the same product+channel, and the UI can trigger concurrent upserts (e.g. `handleExportEtsySelected` in `product-table.tsx:542` fires a `Promise.all` of upserts; the bulk-edit dialog does the same). If a listing is ever created twice, every `find()` in the store layer silently returns whichever row comes first, and exports may use the stale one.

**Fix:** add a unique index on `(product_id, channel)` and rewrite the upsert as a single atomic statement:

```ts
// schema.ts
export const channelListings = sqliteTable("channel_listings", { ... }, (t) => [
  uniqueIndex("channel_listings_product_channel").on(t.productId, t.channel),
])
```

Then use `insert().onConflictDoUpdate({ target: [productId, channel], set: ... })` like `updateEtsyDefaults` already does. This also removes the extra SELECT round-trip. (Note: the merge semantics of `patch.overrides`/`patch.fields` need the existing row, so either keep the read inside a `db.transaction()`, or use SQLite `json_patch` — a transaction is the simpler, correct choice with better-sqlite3 since it's synchronous.)

Also add a plain index on `product_id` — the `onDelete: "cascade"` FK does a full scan of `channel_listings` per deleted product without one.

### 1.2 No runtime input validation on any server function — HIGH
`src/server/products.ts:19`, `src/server/channel-listings.ts:25`, `src/server/etsy-settings.ts:32`, etc.

Every `inputValidator((data: T) => data)` is a compile-time-only cast. Server functions are real HTTP endpoints — anything can POST arbitrary JSON to them. Concrete consequences:

- `updateProductFn` accepts any `Partial<Product>` including `id`, so a malformed patch can rewrite a row's primary key or set `price` to a string that Drizzle happily stores.
- `createProducts` inserts client-constructed rows verbatim (the client currently builds them from the server scrape result, but the trust boundary is wrong — the server should build/validate rows).
- `updateEtsyDefaults` will persist any object as the `fields` JSON blob, which then flows into every future listing.

**Fix:** add a schema validator (zod or valibot — valibot is lighter) and validate in `inputValidator`. Strip `id` from `updateProductFn`'s patch type. Even for an internal tool this is the single best robustness upgrade because bad data written once (e.g. into the `fields` JSON column) corrupts every downstream read with no error.

### 1.3 `walkSitemap` has no cycle/depth protection — MEDIUM
`src/server/catalog-scrape.ts:135`

A sitemap index that references itself (or two indexes referencing each other — this happens in the wild with misconfigured stores) recurses forever. `entries.length >= limit` never triggers because index pages add no entries. **Fix:** carry a `visited: Set<string>` and a max depth.

### 1.4 No fetch timeouts anywhere on the server — MEDIUM
`src/server/catalog-scrape.ts:57`, `src/routes/api/download-images.ts:52`

A vendor server that accepts the connection and never responds hangs the import server function (and the client's `await`) indefinitely. **Fix:** `fetch(url, { signal: AbortSignal.timeout(15_000) })` in `throttledFetch` and in the image download handler.

### 1.5 Product detail form goes stale / effect deps are wrong — MEDIUM
`src/routes/products.$productId.tsx:145-160`

The effect rebuilds both forms only when `product?.id` changes, but reads `product`, `etsyListing`, and `etsyDefaults`. Consequences:

- After "Save Etsy Listing", `etsyListing` updates (query invalidation) but `etsyForm` is not rebuilt — the next save recomputes overrides against a form built from the pre-save listing. Usually harmless, but it means the "Last saved" header and the form can disagree.
- If the products query refetches with changed data (another tab, bulk edit), the form silently keeps stale values and "Save changes" writes them back — a lost-update path.

**Fix:** at minimum rebuild the Etsy form after save/remove (you already do this in `handleRemoveEtsyListing` — do the same in `handleSaveEtsyListing`). Better: key the component (`<ProductDetail key={productId}>` via route `key` or splitting the form into a child that takes `initialValues`), which removes the effect entirely and is the idiomatic React fix for "state initialized from props".

Also `products.$productId.tsx:178`: `handleSave` spreads the whole form, storing `imagePrompt: ""` when empty rather than `null` — the DB column is nullable, so normalize `"" → null` to keep "no prompt" a single representation.

### 1.6 Inventory Value sums across currencies — LOW
`src/routes/index.tsx:46-48,103`

`totalValue` adds `price * stock` for every product and then labels it USD. Imported products keep their scraped currency (`catalog-scrape.ts:449`), so a GBP product inflates a "USD" total. **Fix:** group by currency (show the dominant one, or one stat row per currency), or convert explicitly.

### 1.7 Batch polling never stops and results are applied one-by-one — LOW/MEDIUM
`src/components/product-table.tsx:173-188, 583-634`

- `pollBatchUntilDone` loops forever with no cancellation — if the batch gets stuck in `validating` or the tab stays open, it polls indefinitely; navigating away doesn't stop it. Add an `AbortSignal`/max-duration and stop when the component unmounts or the user cancels.
- After a batch completes, results are applied with sequential `await upsertChannelListing(...)` per product — each helper invalidates `["channel-listings"]`, so N products = N refetches of the entire listings table (see §3.1).
- Batch IDs live only in component state — a page refresh orphans an in-flight OpenAI batch with no way to recover the results you paid for. Consider persisting submitted batch IDs (a tiny `batches` table) so results can be fetched later.

### 1.8 Misc small correctness items
- `src/lib/mock-catalog.ts` seeds the DB at import time via `db/client.ts:19-22` — any empty production DB silently fills with fake products. Gate on `NODE_ENV !== "production"` or an explicit `SEED=1`.
- `src/server/catalog-scrape.ts:410-414` `skuFromUrl` maps to only 9,000 values (`hash % 9000`) with a 3-letter prefix — collisions across a large import are likely, and SKU is used as the ZIP folder name and Etsy `vendor_sku`. Use more of the hash (e.g. base36 of the full 32-bit hash).
- `src/components/bulk-edit-dialog.tsx:89-91` — effect resets state when `open` changes but omits `categories` from deps; if the category list changes while closed, the stale value can linger. Include it (the reset-on-open already makes this cheap).
- `src/routes/products.$productId.tsx:327` — stray indentation in the `TabsList` block; also the Etsy tab is listed before Details while the default tab is `details`, which reads oddly (order tabs to match the default, or default to `etsy` if that's the primary workflow).

---

## 2. Security

Context matters here — this is an internal tool, so these are "before it's ever exposed beyond localhost" items, but two are cheap to fix now.

### 2.1 CSV formula injection in exports — MEDIUM (cheap fix)
`src/lib/csv-export.ts:1-6`

Product names/descriptions come from scraped third-party pages. A value beginning with `=`, `+`, `-`, or `@` is executed as a formula when the CSV is opened in Excel (classic CSV injection — a scraped title like `=WEBSERVICE(...)` exfiltrates data). **Fix:** in `escapeCsvField`, prefix a `'` (or space) when the value starts with one of `= + - @ \t \r`.

### 2.2 SSRF surface in scrape + image download — MEDIUM (matters if ever deployed)
`src/server/catalog-scrape.ts`, `src/routes/api/download-images.ts:52`

Both endpoints fetch arbitrary user/client-supplied URLs from the server. On a laptop this is fine; deployed anywhere (especially a cloud VM), it lets a request reach internal services / metadata endpoints (`http://169.254.169.254/…`). The download endpoint also buffers unlimited-size responses into memory and zips them. **Fix when deploying:** resolve + reject private/link-local IP ranges, allow only `http(s)`, cap response size (check `Content-Length` and stream with a byte cap), and require auth (see 2.3).

### 2.3 No authentication on any endpoint — note
All server functions (delete all products, rewrite settings, trigger scrapes/OpenAI spend) are unauthenticated. Fine for localhost; a blocker for anything else. Worth a one-line `README` note so future-you doesn't deploy it as-is.

### 2.4 OpenAI client construction at module load — LOW
`src/server/openai-client.ts:3`

`new OpenAI()` throws at import time if `OPENAI_API_KEY` is unset, which can take down unrelated server routes that transitively import it. Lazy-init:

```ts
let client: OpenAI | undefined
export function getOpenAI() { return (client ??= new OpenAI()) }
```

That converts "server won't boot" into "AI features error when used".

---

## 3. Performance

### 3.1 Mutation helpers invalidate per call → O(N) full refetches on bulk actions — HIGH (biggest real perf issue)
`src/lib/product-store.ts`, `src/lib/channel-listing-store.ts`, used in loops at `product-table.tsx:601-613`, `bulk-edit-dialog.tsx:102-117`, `product-table.tsx:542-544`

Every helper does `await serverFn(); await invalidateQueries()`. Bulk flows call them in a loop, so applying a 50-product batch = 50 POSTs + 50 sequential refetches of the entire products and/or listings tables. This is the main reason bulk actions will feel slow as the catalog grows.

**Fix (two parts):**
1. Add bulk server functions: `updateProductsFn(patches: Array<{id, patch}>)` and `upsertChannelListingsFn(items: [...])`, each wrapping a `db.transaction()`. better-sqlite3 transactions are extremely fast — this turns 50 round-trips into 1.
2. Invalidate once per user action, not per row. Simplest shape: have the store helpers *not* invalidate, and export a `refresh()` per store that the action handler calls once at the end — or keep the current helpers for single-row use and add `updateProductsBulk` / `upsertListingsBulk` that invalidate once.

### 3.2 SQLite pragmas — quick win
`src/server/db/client.ts:10`

Add alongside `foreign_keys`:

```ts
sqlite.pragma("journal_mode = WAL")
sqlite.pragma("synchronous = NORMAL")
```

WAL removes writer-blocks-reader stalls (relevant since better-sqlite3 is synchronous on the event loop) and is the standard production setting.

### 3.3 Per-row listing lookups are O(rows × listings) — LOW now, grows quadratically
`src/components/product-table.tsx:137` (`ChannelBadges` → `useChannelListingsForProduct` filters the whole array per row), `product-table.tsx:507-510` (CSV export filters per product), `product-table.tsx:721` (mockup export `find` per product)

At 30 products this is nothing; at a few thousand products × page size 100 it's noticeable re-render work. **Fix:** build the lookup once — add a `useChannelListingsByProduct(): Map<string, ChannelListing[]>` hook (a `useMemo` over the one suspense query) and pass listings down through the column context or a memoized map instead of calling a filtering hook inside every row.

### 3.4 `Intl` formatters recreated per cell — LOW
`product-table.tsx:269-279` and duplicated in `index.tsx:22-24`

`new Intl.NumberFormat` / `toLocaleDateString` per cell per render is measurable on 100-row pages. Cache formatters at module scope (one `NumberFormat` per currency in a `Map`, one `DateTimeFormat`), and move both helpers into `src/lib/format.ts` to kill the duplication at the same time.

### 3.5 Suspense queries refetch on every focus/mount — LOW
The three root queries use React Query defaults (`staleTime: 0`), so every window refocus refetches all products + listings + settings. For a local SQLite app the fetch is cheap, but setting `staleTime: 30_000` in `createQueryClient()` (`src/lib/query-client.ts:4`) removes visible refetch flicker for free, since all writes already invalidate explicitly.

### 3.6 Row animation stagger scales with page size — LOW
`product-table.tsx:1010`: `delay: index * 0.02` means the 100th row waits 2s to appear at page size 100. Cap it (`Math.min(index, 15) * 0.02`).

---

## 4. Maintainability

### 4.1 `product-table.tsx` (1,100 lines) is four features in one file
It currently owns: table rendering, CSV export logic, two nearly-identical OpenAI batch orchestrations, and the image ZIP download. Suggested split, mostly mechanical:

- `use-openai-batch.ts` — see 4.2; removes ~250 lines.
- `use-product-csv-export.ts` or `lib/product-csv.ts` — `exportRows`/`handleExportAll`/`handleExportSelected`/`handleExportMockups`.
- `bulk-job-dialog.tsx` — `BulkJobDialog` + `BulkJobResult` rendering (already self-contained).
- Keep the table, toolbar, and pagination in `product-table.tsx`.

### 4.2 The batch pipelines are copy-pasted twice at both layers
Server: `src/server/etsy-copy.ts:110-199` and `src/server/image-prompt.ts:73-162` are line-for-line identical except for the JSONL filename and the result parser. Extract a generic helper:

```ts
// server/openai-batch.ts
export async function submitBatch(lines: Array<object>, filename: string): Promise<string>
export async function getBatchStatus(batchId: string): Promise<BatchStatus>
export async function collectBatchResults<T>(batchId: string, parse: (content: string) => T): Promise<Record<string, Result<T>>>
```

Client: `handleGenerateEtsyCopy` and `handleGenerateImagePrompts` (`product-table.tsx:559-711`) differ only in which server fns they call and how a success is applied. One `useOpenAiBatch({ submit, getStatus, getResults, applyResult })` hook collapses ~150 duplicated lines and gives you a single place to fix the polling-cancellation issue (1.7).

### 4.3 Store-layer shape: module functions reaching for a global QueryClient
`src/lib/query-client.ts` + the three `*-store.ts` files work, and the comment explaining the SSR constraint is good. Two refinements worth considering rather than urgent:

- The helpers are plain async functions, so callers hand-roll loading/error state everywhere (`etsyCopyRunning`, `saving`, `imagesDownloading`, …). Converting the write paths to `useMutation` gives you `isPending`/`onError` for free, keeps invalidation declarative (`onSuccess`), and removes the need for `getBrowserQueryClient()` entirely (the hook gets the client from context). This would also naturally solve the "invalidate once per action" goal in 3.1 via mutation-scoped `onSettled`.
- If you keep the current shape, at least route all query keys through constants (`export const productsKey = ["products"] as const` in `queries.ts`) — today the string literals are repeated in stores and would silently break on a typo.

### 4.4 `ETSY_FIELD_SCHEMA` is defined but never used
`src/lib/channel-registry.ts:65-84` describes every Etsy field (type, options, dependsOn) — exactly what would drive a generated form — but `products.$productId.tsx` and `settings.tsx` hand-write ~400 lines of near-identical field JSX instead (same Selects, same Switch rows, duplicated between the two routes). Either:
- build a small `<EtsyFieldsForm schema={ETSY_FIELD_SCHEMA} value onChange exclude={["tags","materials"]} />` used by both routes (settings passes `exclude` for the per-listing-only fields), or
- delete `ETSY_FIELD_SCHEMA` — dead structure that promises a capability the code doesn't have is worse than nothing.

The first option is the real win: the settings page and the listing tab can never drift apart.

### 4.5 Naming/typing nits
- `fieldsForChannel` (`channel-listings.ts:8`) — the exhaustive `switch` on a one-member union with no default return only typechecks because `ChannelId = "etsy"`; adding a second channel makes it fall through to `undefined` at runtime while the return type still says `EtsyListingFields`. Add an explicit `default: throw` (and the same anywhere `ChannelId` is switched) so a new channel fails loudly.
- `EtsyListingFields` is stored under the channel-generic `fields` column typed as Etsy-specific (`schema.ts:37`) — fine for now, but when a second channel arrives this becomes a discriminated union; a `// per-channel payload, discriminate on `channel`` note in the schema would save the future migration some archaeology.
- `src/lib/mock-catalog.ts` — `vendorNameFromUrl` is real logic living in a file named "mock". Move it to `catalog-import.ts` so `mock-catalog` can be deleted wholesale when seeding goes.
- `Route.useSearch` cast in `app-sidebar.tsx:21-24` — you can type this properly with `useSearch({ from: "/" , shouldThrow: false})` or by reading `location.search` via the route's validated search type, dropping the manual cast.

### 4.6 Tests
Vitest + Testing Library are configured but I found no test files. The highest-value, lowest-effort targets are the pure functions with real failure modes:
- `escapeCsvField` (incl. the formula-injection fix from 2.1),
- `parseRobotsDisallow`, `looksLikeProductPage`, `scrapeProductPage` against a few captured HTML fixtures (this is the code most exposed to weird inputs),
- `clampEtsyList` / `normalizeEtsyCopyResult`,
- the upsert merge semantics of `upsertChannelListingFn` (via an in-memory sqlite DB — better-sqlite3 supports `new Database(":memory:")`).

---

## 5. Suggested order of attack

1. **Quick wins (≈1 hour):** WAL pragma (3.2), unique index + upsert rewrite (1.1), CSV formula-escape (2.1), fetch timeouts (1.4), sitemap cycle guard (1.3), lazy OpenAI client (2.4), formatter caching + `lib/format.ts` (3.4), stagger cap (3.6), `staleTime` (3.5).
2. **Bulk write path (biggest felt improvement):** bulk server fns in transactions + single invalidation per action (3.1), wiring bulk-edit, batch-apply, and Etsy-export flows through them.
3. **Validation:** valibot/zod schemas on every server fn input (1.2).
4. **Refactors:** extract the OpenAI batch helper (server + client hook, fixes 1.7 en route), split `product-table.tsx` (4.1), schema-driven Etsy form (4.4).
5. **Tests** for the pure logic listed in 4.6, ideally added alongside each refactor.
