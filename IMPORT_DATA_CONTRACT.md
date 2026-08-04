# `listings.csv` Import Data Contract

Authoritative spec for **generating** the CSV fed into the side panel. Written
from the actual parser (`src/types/listing.ts`), the actual content-script
fill logic (`src/content/content.ts`, `src/content/selectors.ts`), and live
DOM verification against the real Etsy "Add a listing" page. SPEC.md §4 is the
original design proposal; this document supersedes it with what's actually
enforced and what actually exists in Etsy's UI as of 2026-08-03.

Two real import failures drove this doc: `shipping_profile` set to a
shipping-speed label that wasn't a real processing profile, and `materials`
written as one comma-separated free-text string instead of pipe-separated
tokens from Etsy's fixed vocabulary. Both are called out below so a generator
doesn't repeat them.

## File-level rules

- Comma-delimited, UTF-8, header row required, one row per listing.
- Quote any field containing a comma, a newline, or a double quote; escape
  embedded double quotes by doubling them (`""`) — standard RFC 4180 CSV.
- Blank lines are skipped.
- Column names are matched case-insensitively but must otherwise match
  exactly; column order doesn't matter.
- Multi-value fields (`tags`, `materials`) use `|` as the separator, **not**
  `,` — a comma inside one of these fields is just a literal character, not a
  delimiter, and won't be split.

## Columns

| Column | Required | Type / format | Constraints |
|---|---|---|---|
| `vendor_sku` | yes | string | Must exactly match (case-sensitive) the name of a subfolder under the images root folder — that subfolder's contents get uploaded as this listing's photos. No match = listing is filled with no photos, not an error. |
| `title` | yes | string | Etsy hard limit **140 chars**. Not currently enforced by the parser — check yourself. |
| `description` | yes | string | No enforced limit. Multi-line is fine (quote the field). |
| `price` | yes | number | Parsed with `Number()`; must be finite. No currency symbol, no thousands separator. Decimals allowed (`26.95`). |
| `quantity` | yes | integer | Parsed with `Number()` and must be a whole number. No decimals. |
| `who_made` | yes | enum | Exactly one of `i_did`, `someone_else`, `collective`. Anything else is a hard parse error (row dropped before it ever reaches Etsy). |
| `when_made` | yes | enum | **Not validated by the parser** — a bad value only fails live, in the browser, at the "When was it made?" dropdown step. Confirmed live values (2026): `made_to_order`, `2020_2026`, `2010_2019`, `2007_2009`, `before_2007`, `2000_2006`, `1990s`, `1980s`, `1970s`, `1960s`, `1950s`, `1940s`, `1930s`, `1920s`, `1910s`, `1900_1909`, `1800s`, `1700s`, `before_1700`. Etsy rolls the top-of-range value forward yearly (`2020_2026` today) — verify live before trusting this list long after 2026. |
| `is_supply` | no | boolean-ish string | Truthy values: `yes`, `true`, `1` (case-insensitive). Everything else — including `no`, `false`, or blank — is treated as `false`. Default `false`. |
| `taxonomy_category` | yes | string, e.g. `Jewelry > Earrings > Stud Earrings` | Only the **last segment** after the final `>` is used (`leafCategoryName()` in content.ts) — it's typed into Etsy's category search and the first matching dropdown option is clicked. The leaf name must be something Etsy's category typeahead actually surfaces; the rest of the path is cosmetic/ignored. |
| `shipping_profile` | yes | string | Must exactly match the name of an **existing processing profile** already configured in this shop (Shop Manager → Finances/Settings → shipping profiles) — e.g. `Made to order`, `Ready to dispatch`. This is **not** a shipping-speed/carrier label and not the delivery/carrier profile — a value that isn't a real processing profile name fails at the "Change profile" modal with no matching row to apply. Check your shop's actual profile names live before generating this column; don't infer a plausible-sounding name. |
| `tags` | no | `\|`-separated list | Etsy max **13 tags**, each max **20 chars**. Both limits are enforced by the parser and will drop the whole row with an error if violated. |
| `materials` | no | `\|`-separated list | Etsy's Materials field is a **fixed vocabulary** typeahead, not free text — Etsy max **5 selections**. Each token must be (or closely match, since it's typed and the first matching option is used) an actual Etsy materials option, e.g. `Gold`, `Sterling silver`, `Cubic zirconia`. Descriptive/brand phrasing like `14 karat gold plating` or `Signity cubic zirconia` will not match anything and fails the fill. When unsure, search Etsy's own "Type to search…" materials box live to find the closest real option rather than guessing. |
| `renewal_option` | no | enum | `automatic` or `manual`, case-insensitive. Blank leaves Etsy's default (`Automatic` is pre-checked) alone. Any other value is a hard parse error. |
| `personalization` | no | boolean-ish string | Same truthy rule as `is_supply`. **Parsed but not currently wired to any UI action** — Etsy moved this to a "Custom options" flow the extension doesn't automate yet. Fill it manually in the browser after import if needed. |
| `personalization_instructions` | no | string | Parsed but **not wired** — same caveat as above. |
| `primary_color` / `secondary_color` | no | string | Parsed but **not wired** — content.ts has selectors for these but no fill step currently calls them. Category-dependent in Etsy anyway (not every category has color attributes). |

## Images folder pairing

Separate from the CSV: pick one parent folder in the side panel. Each
listing's `vendor_sku` must have its own subfolder directly under that parent
(`<root>/<vendor_sku>/*.jpg`), containing that product's photos. Files are
matched by exact folder name against `vendor_sku` (case-sensitive), sorted
alphabetically, capped at Etsy's max of **10 photos**. Name files so
alphabetical order is the order you want them to appear (`01_front.jpg`,
`02_side.jpg`, …).

## Before generating a batch, verify live rather than assume

The two failures that motivated this doc were both cases of a plausible-
looking value that simply didn't exist in this shop's Etsy configuration:

- **`shipping_profile`** — open the shop's processing-profile modal and copy
  the exact name(s) shown (`Made to order`, `Ready to dispatch` for this shop
  as of 2026-08-03; may change if profiles are added/renamed).
- **`materials`** — type candidate terms into Etsy's Materials "Type to
  search…" box for the target category and use whatever option it actually
  returns; don't write descriptive/marketing phrasing into this column.
- **`when_made`** — cross-check against the live `<select>` options if it's
  been a while since 2026-08-03.

Everything else (`who_made`, `renewal_option`, tag/material counts and
lengths) is enforced by the parser itself, so a bad value there fails fast
with a clear row-level error instead of silently reaching Etsy's UI.
