import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { generateSeedProducts } from "@/lib/mock-catalog"
import * as schema from "@/server/db/schema"

const globalForDb = globalThis as unknown as { __sqlite?: Database.Database }

const sqlite = globalForDb.__sqlite ?? new Database(process.env.DATABASE_URL ?? "sqlite.db")
sqlite.exec("PRAGMA foreign_keys = ON")
if (!globalForDb.__sqlite) {
  globalForDb.__sqlite = sqlite
}

export const db = drizzle(sqlite, { schema })

migrate(db, { migrationsFolder: "drizzle" })

const existingProduct = db.select().from(schema.products).limit(1).all()
if (existingProduct.length === 0) {
  db.insert(schema.products).values(generateSeedProducts()).run()
}
