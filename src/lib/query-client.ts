import { QueryClient } from "@tanstack/react-query"

export function createQueryClient() {
  return new QueryClient()
}

// The server calls getRouter() fresh per request, so each request must get
// its own QueryClient (see router.tsx) — reusing one instance across
// requests would leak one visitor's cached data to the next and never
// re-read the database once warmed. In the browser, getRouter() runs once
// at hydration, so this ends up holding that single long-lived instance,
// which store mutation helpers (product-store.ts etc.) use to invalidate
// queries after a write — they never run during SSR, so this is never
// touched server-side.
let browserQueryClient: QueryClient | undefined

export function setBrowserQueryClient(client: QueryClient) {
  browserQueryClient = client
}

export function getBrowserQueryClient(): QueryClient {
  if (!browserQueryClient) {
    throw new Error("Query client accessed before the router initialized")
  }
  return browserQueryClient
}
