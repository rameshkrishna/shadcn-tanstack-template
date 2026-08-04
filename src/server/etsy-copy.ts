import { createServerFn } from "@tanstack/react-start"
import { toFile } from "openai"
import { openai } from "@/server/openai-client"

interface EtsyCopyGenerationInput {
  name: string
  description: string
}

interface EtsyCopyGenerationResult {
  title: string
  description: string
  tags: Array<string>
  materials: Array<string>
}

const ETSY_MAX_TAGS = 13
const ETSY_TAG_MAX_LENGTH = 20
const ETSY_MAX_MATERIALS = 5

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    materials: { type: "array", items: { type: "string" } },
  },
  required: ["title", "description", "tags", "materials"],
  additionalProperties: false,
} as const

function buildPrompt(data: EtsyCopyGenerationInput) {
  return `You are an Etsy listing copywriter.

Product title: ${data.name}
Product description: ${data.description}

Write Etsy listing copy based only on the title and description above:
- "title": an Etsy listing title, up to 140 characters, keyword-rich and buyer-focused, front-loading the most important search terms, phrases separated by commas or " | "
- "description": an Etsy listing description, 2-4 short paragraphs, expanding on the product, materials or craftsmanship, and why a buyer would want it, written in a warm shop-owner voice
- "tags": up to ${ETSY_MAX_TAGS} Etsy search tags as an array of strings, following Etsy's tag rules — each tag ${ETSY_TAG_MAX_LENGTH} characters or fewer, specific buyer-searched phrases rather than single generic words (e.g. "boho drop earrings" not just "earrings"), no duplicate or near-duplicate tags, no punctuation-only tags
- "materials": up to ${ETSY_MAX_MATERIALS} materials the product is made from as an array of strings (e.g. "sterling silver", "genuine leather"), only what's stated or clearly implied by the title/description — don't invent materials that aren't mentioned

Respond only with the JSON object.`
}

function buildChatBody(data: EtsyCopyGenerationInput) {
  return {
    model: "gpt-4.1-mini",
    messages: [{ role: "user" as const, content: buildPrompt(data) }],
    response_format: {
      type: "json_schema" as const,
      json_schema: { name: "etsy_copy", strict: true, schema: RESPONSE_SCHEMA },
    },
  }
}

function clampEtsyList(values: unknown, maxItems: number, maxLength?: number): Array<string> {
  if (!Array.isArray(values)) return []
  const cleaned: Array<string> = []
  for (const value of values) {
    if (typeof value !== "string") continue
    const trimmed = value.trim()
    if (!trimmed) continue
    cleaned.push(maxLength ? trimmed.slice(0, maxLength) : trimmed)
    if (cleaned.length >= maxItems) break
  }
  return cleaned
}

function normalizeEtsyCopyResult(raw: unknown): EtsyCopyGenerationResult {
  const parsed = (raw ?? {}) as Partial<EtsyCopyGenerationResult>
  return {
    title: typeof parsed.title === "string" ? parsed.title : "",
    description: typeof parsed.description === "string" ? parsed.description : "",
    tags: clampEtsyList(parsed.tags, ETSY_MAX_TAGS, ETSY_TAG_MAX_LENGTH),
    materials: clampEtsyList(parsed.materials, ETSY_MAX_MATERIALS),
  }
}

export const generateEtsyCopy = createServerFn({ method: "POST" })
  .inputValidator((data: EtsyCopyGenerationInput) => data)
  .handler(async ({ data }): Promise<EtsyCopyGenerationResult> => {
    const response = await openai.chat.completions.create(buildChatBody(data))

    const content = response.choices[0]?.message.content
    if (!content) {
      throw new Error("Model returned no content")
    }

    return normalizeEtsyCopyResult(JSON.parse(content))
  })

interface EtsyCopyBatchProduct extends EtsyCopyGenerationInput {
  id: string
}

export interface EtsyCopyBatchStatus {
  status: string
  completed: number
  failed: number
  total: number
}

export type EtsyCopyBatchResult =
  | ({ ok: true } & EtsyCopyGenerationResult)
  | { ok: false; error: string }

export const submitEtsyCopyBatch = createServerFn({ method: "POST" })
  .inputValidator((data: { products: Array<EtsyCopyBatchProduct> }) => data)
  .handler(async ({ data }): Promise<{ batchId: string }> => {
    const lines = data.products.map((product) =>
      JSON.stringify({
        custom_id: product.id,
        method: "POST",
        url: "/v1/chat/completions",
        body: buildChatBody(product),
      })
    )

    const file = await openai.files.create({
      file: await toFile(Buffer.from(lines.join("\n")), "etsy-copy-batch.jsonl"),
      purpose: "batch",
    })

    const batch = await openai.batches.create({
      input_file_id: file.id,
      endpoint: "/v1/chat/completions",
      completion_window: "24h",
    })

    return { batchId: batch.id }
  })

export const getEtsyCopyBatchStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { batchId: string }) => data)
  .handler(async ({ data }): Promise<EtsyCopyBatchStatus> => {
    const batch = await openai.batches.retrieve(data.batchId)
    return {
      status: batch.status,
      completed: batch.request_counts?.completed ?? 0,
      failed: batch.request_counts?.failed ?? 0,
      total: batch.request_counts?.total ?? 0,
    }
  })

export const getEtsyCopyBatchResults = createServerFn({ method: "POST" })
  .inputValidator((data: { batchId: string }) => data)
  .handler(async ({ data }): Promise<Partial<Record<string, EtsyCopyBatchResult>>> => {
    const batch = await openai.batches.retrieve(data.batchId)
    const results: Partial<Record<string, EtsyCopyBatchResult>> = {}

    if (batch.output_file_id) {
      const fileContent = await openai.files.content(batch.output_file_id)
      const text = await fileContent.text()
      for (const line of text.split("\n").filter(Boolean)) {
        const entry = JSON.parse(line) as {
          custom_id: string
          error?: { message?: string }
          response?: { body?: { choices?: Array<{ message?: { content?: string } }> } }
        }
        if (entry.error) {
          results[entry.custom_id] = { ok: false, error: entry.error.message ?? "Generation failed" }
          continue
        }
        const content = entry.response?.body?.choices?.[0]?.message?.content
        if (!content) {
          results[entry.custom_id] = { ok: false, error: "Model returned no content" }
          continue
        }
        try {
          const parsed = normalizeEtsyCopyResult(JSON.parse(content))
          results[entry.custom_id] = { ok: true, ...parsed }
        } catch {
          results[entry.custom_id] = { ok: false, error: "Failed to parse model output" }
        }
      }
    }

    if (batch.error_file_id) {
      const fileContent = await openai.files.content(batch.error_file_id)
      const text = await fileContent.text()
      for (const line of text.split("\n").filter(Boolean)) {
        const entry = JSON.parse(line) as {
          custom_id: string
          response?: { body?: { error?: { message?: string } } }
        }
        if (!(entry.custom_id in results)) {
          results[entry.custom_id] = {
            ok: false,
            error: entry.response?.body?.error?.message ?? "Request failed",
          }
        }
      }
    }

    return results
  })
