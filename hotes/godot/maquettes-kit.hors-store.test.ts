/**
 * LA MARQUE DES PRIMITIVES DES MAQUETTES (#4585, règle 2 de `docs/plans/2026-11-21-maquettes-en-donnees.md`) : seule
 * une primitive du kit écrit `data-primitive` (la racine qu'elle émet) ou `data-emplacement` (ce qu'elle laisse remplir),
 * que le relevé `brut` de `rendre.mjs` lit. Le kit : les fichiers de `cibles/propositions/sources/` où vivent les
 * primitives (`KIT`). Toute écriture de l'une de ces marques ailleurs sous `sources/` est refusée.
 */
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listerEntrees } from '../../scripts/guards/lib/lister.mjs';

const SOURCES = fileURLToPath(new URL('./cibles/propositions/sources/', import.meta.url));
/** Les fichiers des primitives, depuis `sources/`. */
const KIT = ['gestes.js', 'combat/jet.js', 'lieux-et-nuit/commun.js', 'outils/outils.js'];
/** Une marque écrite : en attribut, par `dataset` ou par `setAttribute`. */
const ECRITURE = /data-(?:primitive|emplacement)\s*=|dataset\.(?:primitive|emplacement)\s*=(?!=)|setAttribute\(\s*['"`]data-(?:primitive|emplacement)/;

/** Les lignes de `fichiers` (chemin depuis `sources/`, texte) hors du kit qui écrivent une marque, `chemin:ligne`. PURE. */
const ecrituresHorsDuKit = (fichiers: { chemin: string; texte: string }[]) => fichiers.filter(({ chemin }) => !KIT.includes(chemin))
  .flatMap(({ chemin, texte }) => texte.split('\n').flatMap((l, k) => (ECRITURE.test(l) ? [`${chemin}:${k + 1}`] : [])));

/** Les fichiers de code de `dossier`, récursivement. */
const fichiersDe = (dossier: string): string[] => listerEntrees(dossier).entrees.flatMap(({ nom, nature }) => (nature === 'directory'
  ? fichiersDe(join(dossier, nom))
  : /\.(?:js|mjs|ts|html|css)$/.test(nom) ? [join(dossier, nom)] : []));

describe('data-primitive', () => {
  it('ne s’écrit que dans le kit', () => {
    const fichiers = fichiersDe(SOURCES).map((f) => ({ chemin: relative(SOURCES, f).split('\\').join('/'), texte: readFileSync(f, 'utf8') }));
    expect(fichiers.filter(({ chemin }) => KIT.includes(chemin)).map(({ chemin }) => chemin).sort()).toEqual([...KIT].sort());
    expect(ecrituresHorsDuKit(fichiers)).toEqual([]);
  });

  it('refuse chaque forme d’écriture hors du kit, et la laisse au kit', () => {
    const texte = '<div data-primitive="x">\ne.dataset.emplacement = "y"\ne.setAttribute(\'data-primitive\', "z")\ne.matches("[data-primitive]")\ne.dataset.primitive === "x"';
    expect(ecrituresHorsDuKit([{ chemin: 'rendu.js', texte }, { chemin: 'gestes.js', texte }])).toEqual(['rendu.js:1', 'rendu.js:2', 'rendu.js:3']);
  });
});
