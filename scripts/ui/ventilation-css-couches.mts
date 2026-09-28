/**
 * VENTILE la décrue du stock des couches CSS (#1806 D6″), en lecture seule :
 *   npx tsx scripts/ui/ventilation-css-couches.mts <ref> [--tete <ref>]
 *
 * Rend, de `<ref>` à l'arbre de travail (ou à `--tete <ref>`, lue sans disque), par volet, SORTI =
 * RECLASSÉ + PRIMITIVISÉ + DISPARU, APPARU et RETOURNÉ, puis les modules franchis avec leur prix
 * (`ventilationDeGit`, `scripts/guards/lib/cssImages.mjs`). Le stock se régénère ailleurs :
 * `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/cssCouchesAudit.ts`.
 */
import { fileURLToPath } from 'node:url';
import { ligneDeVentilation } from '../guards/lib/cssCouches.mjs';
import { ventilationDeGit } from '../guards/lib/cssImages.mjs';
import { TRAVAIL } from '../guards/lib/gitPorte.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const USAGE = 'Usage : npx tsx scripts/ui/ventilation-css-couches.mts <ref> [--tete <ref>]';

/** La ref de base et la tête (`null` : l'arbre de travail), ou `null` si la ligne est hors usage. */
function refsDeLaLigne(args: readonly string[]): { base: string; tete: string | null } | null {
  const positionnels: string[] = [];
  let tete: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--tete') {
      tete = args[++i] ?? null;
      if (tete === null || tete.startsWith('--')) return null;
      continue;
    }
    if (a.startsWith('--')) return null;
    positionnels.push(a);
  }
  return positionnels.length === 1 ? { base: positionnels[0], tete } : null;
}

const refs = refsDeLaLigne(process.argv.slice(2));
if (refs === null) {
  console.error(USAGE);
  process.exit(2);
}
const { base, tete } = refs;
const v = ventilationDeGit({ cwd: RACINE, base, tete: tete ?? TRAVAIL });
console.log([
  `ventilation ${base} → ${tete ?? 'arbre de travail'}`,
  ligneDeVentilation('identité', v.identite),
  ligneDeVentilation('espacement', v.espacement),
  `modules franchis : ${v.franchis.length}`,
  ...v.franchis.map((f) => `  RECLASSEMENT: ${f.module} +${f.n} (identité ${f.identite}, espacement ${f.espacement})`),
].join('\n'));
