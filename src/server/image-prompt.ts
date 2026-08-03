import { createServerFn } from "@tanstack/react-start"
import { toFile } from "openai"
import { openai } from "@/server/openai-client"

interface ImagePromptGenerationInput {
  name: string
  description: string
}

interface ImagePromptGenerationResult {
  prompt: string
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    prompt: { type: "string" },
  },
  required: ["prompt"],
  additionalProperties: false,
} as const

function buildPrompt(data: ImagePromptGenerationInput) {
  return `You are an art director briefing an AI image generator (e.g. Midjourney) to create a product mockup image.

Product title: ${data.name}
Product description: ${data.description}

Write a single detailed image-generation prompt (60-100 words) for a photorealistic product mockup based only on the title and description above: describe the product's appearance, staging/background, lighting, camera angle, and mood. It should read as a self-contained prompt someone could paste directly into an image generation tool. Do not include the product name as a literal instruction like "generate an image of X" — describe the scene instead.

Respond only with the JSON object.`
}

function buildChatBody(data: ImagePromptGenerationInput) {
  return {
    model: "gpt-4.1-mini",
    messages: [{ role: "user" as const, content: buildPrompt(data) }],
    response_format: {
      type: "json_schema" as const,
      json_schema: { name: "image_prompt", strict: true, schema: RESPONSE_SCHEMA },
    },
  }
}

export const generateImagePrompt = createServerFn({ method: "POST" })
  .inputValidator((data: ImagePromptGenerationInput) => data)
  .handler(async ({ data }): Promise<ImagePromptGenerationResult> => {
    const response = await openai.chat.completions.create(buildChatBody(data))

    const content = response.choices[0]?.message.content
    if (!content) {
      throw new Error("Model returned no content")
    }

    return JSON.parse(content) as ImagePromptGenerationResult
  })

interface ImagePromptBatchProduct extends ImagePromptGenerationInput {
  id: string
}

export interface ImagePromptBatchStatus {
  status: string
  completed: number
  failed: number
  total: number
}

export type ImagePromptBatchResult =
  | ({ ok: true } & ImagePromptGenerationResult)
  | { ok: false; error: string }

export const submitImagePromptBatch = createServerFn({ method: "POST" })
  .inputValidator((data: { products: Array<ImagePromptBatchProduct> }) => data)
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
      file: await toFile(Buffer.from(lines.join("\n")), "image-prompt-batch.jsonl"),
      purpose: "batch",
    })

    const batch = await openai.batches.create({
      input_file_id: file.id,
      endpoint: "/v1/chat/completions",
      completion_window: "24h",
    })

    return { batchId: batch.id }
  })

export const getImagePromptBatchStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { batchId: string }) => data)
  .handler(async ({ data }): Promise<ImagePromptBatchStatus> => {
    const batch = await openai.batches.retrieve(data.batchId)
    return {
      status: batch.status,
      completed: batch.request_counts?.completed ?? 0,
      failed: batch.request_counts?.failed ?? 0,
      total: batch.request_counts?.total ?? 0,
    }
  })

export const getImagePromptBatchResults = createServerFn({ method: "POST" })
  .inputValidator((data: { batchId: string }) => data)
  .handler(async ({ data }): Promise<Partial<Record<string, ImagePromptBatchResult>>> => {
    const batch = await openai.batches.retrieve(data.batchId)
    const results: Partial<Record<string, ImagePromptBatchResult>> = {}

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
          const parsed = JSON.parse(content) as ImagePromptGenerationResult
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
