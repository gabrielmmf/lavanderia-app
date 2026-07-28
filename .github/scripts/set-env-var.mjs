#!/usr/bin/env node
/**
 * Define (ou substitui) uma variável num arquivo .env, preservando as demais.
 *
 * Uso: node set-env-var.mjs <arquivo> <CHAVE> <valor>
 *
 * Usado para apontar o build de preview da Vercel para a branch do Neon
 * criada para o pull request, sem mexer nas outras variáveis baixadas.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"

const [file, key, value] = process.argv.slice(2)

if (!file || !key) {
  console.error("Uso: set-env-var.mjs <arquivo> <CHAVE> <valor>")
  process.exit(1)
}
if (!value) {
  console.error(`Valor vazio para ${key}. Verifique se o passo anterior gerou a saída esperada.`)
  process.exit(1)
}

const current = existsSync(file) ? readFileSync(file, "utf8") : ""
const lines = current.split(/\r?\n/).filter((line) => !line.startsWith(`${key}=`))

// Aspas simples: o valor é literal e pode conter `$`, `&` e `?` da query string.
lines.push(`${key}='${value.replace(/'/g, "'\\''")}'`)

writeFileSync(file, lines.filter(Boolean).join("\n") + "\n")
console.log(`${key} definido em ${file}.`)
