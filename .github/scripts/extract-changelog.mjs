#!/usr/bin/env node
/**
 * Extrai de CHANGELOG.md a seção de uma versão, para virar o corpo da
 * GitHub Release.
 *
 * Uso: node extract-changelog.mjs <versao> [caminho-do-changelog]
 *
 * Sai com sucesso e texto vazio quando a seção não existe (ex.: primeira
 * versão ainda sem changelog), para não derrubar o release por isso.
 */
import { readFileSync, existsSync } from "node:fs"

const version = process.argv[2]
const file = process.argv[3] ?? "CHANGELOG.md"

if (!version) {
  console.error("Uso: extract-changelog.mjs <versao> [caminho]")
  process.exit(1)
}

if (!existsSync(file)) {
  process.stdout.write("")
  process.exit(0)
}

const lines = readFileSync(file, "utf8").split(/\r?\n/)

// Changesets gera "## 1.2.3" para cada versão.
const heading = /^##\s+(.+?)\s*$/
const start = lines.findIndex((line) => {
  const match = line.match(heading)
  return match?.[1] === version
})

if (start === -1) {
  process.stdout.write("")
  process.exit(0)
}

const rest = lines.slice(start + 1)
const end = rest.findIndex((line) => heading.test(line))
const section = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim()

process.stdout.write(section)
