import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRAVAIL, depotDe, listerImage } from '../scripts/guards/lib/gitPorte.mjs';
import { retoursDuRig } from '../scripts/guards/lib/retourDuRig.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * EN-TÊTE STRUCTURÉ de la garde.
 */
const GARDE = {
  question: 'Quel fichier du dépôt fait revenir le rig SVG des personnages ou son outillage ?',
  pourquoi:
    'Arbitrage utilisateur du 2026-10-30 : « Retirer dès maintenant le rig SVG et le rendu web des personnages ' +
    '(src/gameIso/rig, galeries, gardes, outils QC). » Garde ABSOLUE, sans stock : zéro fichier à la pose.',
  primitive:
    '`listerImage(…, TRAVAIL)` (`gitPorte.mjs`, `git ls-files`) pour l’ÉNUMÉRATION (fichiers suivis ET non suivis ' +
    'non ignorés, hors supprimés du disque), `retoursDuRig` pour les formes et `sitesDeModule` pour les imports littéraux.',
  perimetre:
    'Tout le dépôt, casse ignorée : `src/gameIso/rig/`, `scripts/rig/`, les skills `creer-une-creature` ' +
    '(`DOSSIERS_DU_RIG`), galeries hors icônes, familles de noms QC du rig, composants Rig*.tsx et imports gameIso/rig/.',
  ticket: '#3160',
  angleMort: [
    'Un rig recréé sous un AUTRE chemin passe : l’interdit vit dans `.claude/rules/rendu-du-monde.md`.',
    'Un fichier gitignoré n’est pas énuméré.',
    'Les imports calculés ne sont pas couverts.',
  ],
} as const;

const fichiersDuDepot = (): string[] => listerImage(depotDe(RACINE), TRAVAIL);

describe('le rig SVG ne revient pas', () => {
  it('en-tête : la garde se déclare — périmètre, primitive, angles morts, ticket', () => {
    expect(GARDE.primitive).toContain('git ls-files');
    expect(GARDE.angleMort.join(' | ')).toMatch(/AUTRE chemin/);
    expect(GARDE.ticket).toBe('#3160');
  });

  it('refuse les familles entières, casse ignorée, et épargne les voisins légitimes', () => {
    const retires = [
      'src/gameIso/rig/kinematics.ts',
      'src/gameIso/Rig/kinematics.ts',
      'SRC/GAMEISO/RIG/parts/types.ts',
      'scripts/rig/compile.mts',
      '.claude/skills/creer-une-creature/SKILL.md',
      '.agents/skills/creer-une-creature/SKILL.md',
      'scripts/gen-rig-gallery.mts',
      'scripts/gen-x-gallery.mts',
      'public/inconnu-gallery.html',
      'scripts/qc/render-creature.mts',
      'scripts/qc/nouveau-rig-check.mts',
      'scripts/qc/silhouette-inconnue.mts',
      'scripts/qc/quad-inconnu.mts',
      'scripts/qc/bras-inconnu.mts',
      'scripts/qc/aveugle-inconnu.mts',
      'scripts/qc/mesure-volume.mts',
      'src/ui/RigPortrait.tsx',
      'src/ui/rigportrait.tsx',
      'src/ui/compendium/RigInconnu.tsx',
    ];
    expect(
      retoursDuRig([
        ...retires,
        'src/gameIso/rigging.ts',
        'scripts/gen-x-gallery.mts.bak',
        'public/inconnu-gallery.html.bak',
        'scripts/qc/capture-jeu.mjs',
        'scripts/gen-icon-gallery.mts',
        'public/icon-gallery.html',
        'scripts/qc/render-furniture.mts',
        'scripts/qc/render-props-volumiques.mts',
        'scripts/qc/render-siege.mts',
        'scripts/qc/spell-support-census.mts',
        'scripts/qc/lib/pngDecode.mjs',
        'src/ui/compendium/triggerLabels.ts',
        'public/qc/baseline-affine/README.md',
        '.claude/rules/rendu-du-monde.md',
      ]),
    ).toEqual(retires);
  });

  it.each([
    'import x from "../gameIso/rig/x";',
    'import "../gameIso/rig/x";',
    'import type { X } from "../gameIso/rig/x";',
    'export { x } from "../gameIso/rig/x";',
    'export * from "../gameIso/rig/x";',
    'const x = import("../gameIso/rig/x");',
    'const x = require("../gameIso/rig/x");',
    'type X = import("../gameIso/rig/x").X;',
    'import x = require("../GAMEISO/RIG/x");',
  ])('refuse un import du rig dans un fichier au nom quelconque : %s', (texte) => {
    expect(retoursDuRig(['src/ui/Inconnu.tsx'], () => texte)).toEqual(['src/ui/Inconnu.tsx']);
  });

  it('distingue les imports des commentaires et des chaînes de test', () => {
    const texte = [
      '// import x from "../gameIso/rig/x";',
      'const exemple = \'import x from "../gameIso/rig/x";\';',
      'import x from "../gameIso/rigging/x";',
      'import y from "../autregameIso/rig/x";',
    ].join('\n');
    expect(retoursDuRig(['src/ui/Inconnu.tsx'], () => texte)).toEqual([]);
  });

  it('aucun fichier du dépôt ne fait revenir le rig', () => {
    expect(retoursDuRig(fichiersDuDepot(), (rel) => readFileSync(join(RACINE, rel), 'utf8')),
      'rig SVG retiré (#3160) : supprime ces fichiers ou imports.').toEqual([]);
  });
});
