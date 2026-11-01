/**
 * CLI de la planche QC du mobilier volumique — écrit l'artefact et rien d'autre.
 * L'instrument lui-même (ses lois empruntées à la cuisson) vit dans `lib/plancheVolumique.ts`, qu'un
 * contrat IMPORTE pour le mesurer : un outil de QC enfermé dans un script ne se mesure pas.
 *   npx tsx scripts/qc/render-props-volumiques.mts → public/props-volumiques.html
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLONNES, RECETTES, construireHtml } from './lib/plancheVolumique';

export const OUT = fileURLToPath(new URL('../../public/props-volumiques.html', import.meta.url));

export function build(): string {
  const { html, vides } = construireHtml();
  if (vides.length) throw new Error(`VUES MONDE VIDES : ${vides.join(', ')}`);
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, build());
  console.log(`OK: public/props-volumiques.html — ${RECETTES.length} lignes × ${COLONNES.length} vues monde + vignette de palette`);
}
