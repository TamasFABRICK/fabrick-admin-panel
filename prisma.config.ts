import path from 'node:path'
import { defineConfig } from 'prisma/config'

/**
 * Prisma Configuration File (Prisma 6.6+)
 *
 * Nahrádza deprecated `package.json#prisma` konfiguráciu (seed príkaz).
 * Keď je tento súbor prítomný, Prisma CLI prestane automaticky načítavať
 * .env súbor — DATABASE_URL musí byť nastavená v prostredí (Docker Compose
 * alebo manuálne cez shell pred spustením Prisma CLI).
 *
 * Dokumentácia: https://pris.ly/prisma-config
 */

// Načítame fallback DATABASE_URL pre lokálny vývoj, keďže prisma.config.ts
// prítomnosť vypína automatické načítavanie .env súboru v Prisma CLI.
if (process.env.DATABASE_URL === undefined) {
  process.env.DATABASE_URL = 'file:./dev.db'
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),

  migrations: {
    path: path.join('prisma', 'migrations'),
  },
})
