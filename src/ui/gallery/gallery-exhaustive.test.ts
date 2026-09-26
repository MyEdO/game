import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GALLERY_SPECIMENS } from './registry';

/**
 * Garde structurelle (#412, extension utilisateur 2026-07-14 verbatim : « Faudrait forcer à ce que
 * la galerie ait toutes les primitives ») — `src/data/primitives.manifest.json` est la source de
 * vérité des primitives RENDUES (champ `fichier` en `src/ui/**.tsx` ; le pur état/moteur `.ts`
 * — `findTableEntry`, `actorIn`, `GameOp`, `passiveMods`, `fireTriggers`, `cascade`… — est hors radar
 * par construction : seule une forme RENDUE entre dans ce périmètre). Chaque chemin `src/ui/*.tsx`
 * déclaré DOIT avoir une entrée dans `registry.tsx` (`GALLERY_SPECIMENS`, comparaison de chaîne
 * STRICTE, pas d'heuristique) — sinon la CI échoue avec la liste nominative des manquantes. Sens
 * inverse : toute entrée du registre doit pointer un fichier RÉEL (dead entry = échec aussi).
 */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)); // racine du repo

const MANIFESTE: { fichier: string }[] = JSON.parse(
  readFileSync(new URL('../../data/primitives.manifest.json', import.meta.url), 'utf8'),
);

/** Chemins `src/ui/**.tsx` déclarés au manifeste — auto-exclut la galerie elle-même
 *  (self-référence : elle ne peut pas exiger un spécimen d'elle-même). */
function requiredFiles(): Set<string> {
  const files = new Set<string>();
  for (const p of MANIFESTE) {
    if (!/^src\/ui\/.+\.tsx$/.test(p.fichier)) continue;
    if (p.fichier === 'src/ui/gallery/DesignGallery.tsx') continue;
    files.add(p.fichier);
  }
  return files;
}

describe('#412 — galerie design system : couverture exhaustive des primitives rendues', () => {
  it('chaque primitive `src/ui/*.tsx` du manifeste a un spécimen dans le registre', () => {
    const required = requiredFiles();
    const covered = new Set(GALLERY_SPECIMENS.map((s) => s.file));
    const missing = [...required].filter((f) => !covered.has(f)).sort();
    expect(missing, `Primitives SANS spécimen (ajouter une entrée à GALLERY_SPECIMENS, registry.ts) :\n${missing.join('\n')}`).toEqual([]);
  });

  it('aucune entrée du registre ne pointe un fichier inexistant', () => {
    const dead = GALLERY_SPECIMENS.filter((s) => !existsSync(`${ROOT}${s.file}`)).map((s) => `${s.label} → ${s.file}`);
    expect(dead, `Entrée(s) de GALLERY_SPECIMENS pointant un fichier absent :\n${dead.join('\n')}`).toEqual([]);
  });

  it('chaque entrée EXPOSE un rendu (function) et un nom/fichier non vides', () => {
    const bad = GALLERY_SPECIMENS.filter((s) => !s.label || !s.file || typeof s.render !== 'function').map((s) => s.label || s.file || '(entrée invalide)');
    expect(bad, `Entrée(s) de GALLERY_SPECIMENS malformées :\n${bad.join('\n')}`).toEqual([]);
  });
});
