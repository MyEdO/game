// Extraction TEXTE d'un PDF par pypdf (`pdf-extract.py`), lecteur des pages perdues :
// `empty-folios-stock.mjs`, `marker-pages.mjs`.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

export const PDF_EXTRACT_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'pdf-extract.py')

/** Texte des pages `indices` (0-based) de `pdfPath` : `Map(index -> texte)`, un seul process python. */
export function extractPages(pdfPath, indices) {
  if (!indices.length) return new Map()
  const dir = mkdtempSync(join(tmpdir(), 'pdf-extract-'))
  const outPath = join(dir, 'pages.json')
  try {
    execFileSync('python', [PDF_EXTRACT_SCRIPT, pdfPath, indices.join(','), outPath], { maxBuffer: 128 * 1024 * 1024 })
    const raw = JSON.parse(readFileSync(outPath, 'utf8'))
    const map = new Map()
    for (const [k, v] of Object.entries(raw)) map.set(Number(k), v)
    return map
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
