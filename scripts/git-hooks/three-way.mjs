// Fusion 3-voies d'un texte, déléguée à `git merge-file -p` (aucune réimplémentation du diff3). Consommée
// par les pilotes de fusion `merge-docs.mjs` et `merge-stocks.mjs`.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Fusion 3-voies de trois textes. Retourne `{ text, conflict }` ; `conflict` vrai = marqueurs présents
 *  dans `text`. */
export function threeWay(ours, base, theirs, labels = { ours: 'ours', base: 'base', theirs: 'theirs' }) {
  const dir = mkdtempSync(join(tmpdir(), 'three-way-'))
  try {
    const put = (name, content) => { const f = join(dir, name); writeFileSync(f, content); return f }
    const args = ['merge-file', '-p', '-L', labels.ours, '-L', labels.base, '-L', labels.theirs,
      put('ours', ours), put('base', base), put('theirs', theirs)]
    try {
      return { text: execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }), conflict: false }
    } catch (e) {
      // `git merge-file` sort le NOMBRE de conflits (>0), ou 255 sur erreur réelle.
      if (typeof e.status === 'number' && e.status > 0 && e.status < 255 && e.stdout != null) {
        return { text: String(e.stdout), conflict: true }
      }
      throw e
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
