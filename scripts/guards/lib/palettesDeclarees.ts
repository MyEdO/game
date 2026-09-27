/**
 * INVENTAIRE des palettes DÉCLARÉES que reçoit `buildTokenMap` (`src/gameIso/rig/palette.ts`), toutes
 * familles d'art (#1903 D3) — définition UNIQUE, lue par la porte de la donnée de palette
 * `src/gameIso/rig/palettes-declarees.test.ts`.
 *
 * Une palette est un objet dont TOUTES les valeurs sont des hex `#rrggbb`, rangé sous une clé
 * `palette`, `paletteF` ou `…DEFAULT` (`CLE_DE_PALETTE`), identifiée par identité d'objet. Espèces :
 * `RACES` (`races/index.ts`), lieu dans la donnée (`src/data/<file>`, `schemas/defs/raceAppearance.ts`).
 * Autres : chaque module `.ts` de `src/gameIso/rig` hors tests est marché ; le lieu est l'unique
 * candidat dont la clôture d'imports (`clotureDImports`, `importGraph.mjs`) ne contient aucun autre
 * candidat, sinon `throw` (même contrat que `registreDeDefs.ts`). Chaque palette porte les ENTRÉES que
 * le rig applique à sa couche : elle-même, et pour une espèce la peau greffée par chaque tête
 * (`coucheDEspece`, `TETES_A_PEAU`).
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { listerArbre } from './lister.mjs';
import { estFichierVitest } from './fichierVitest.mjs';
import { clotureDImports } from './importGraph.mjs';
import type { PaletteDeclaree } from '../../../src/gameIso/rig/palette';
import { RACES } from '../../../src/gameIso/rig/races';
import { coucheDEspece, TETES_A_PEAU } from '../../../src/gameIso/rig/parts/career';
import { file as FICHIER_D_ESPECES } from '../../../src/data/schemas/defs/raceAppearance';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RIG = resolve(RACINE, 'src/gameIso/rig');

const HEX = /^#[0-9a-f]{6}$/i;
export const CLE_DE_PALETTE = /^(palette|paletteF)$|DEFAULT$/;

/** Modules du rig parcourus par l'inventaire : chaque `.ts` hors tests et déclarations de types
 *  (chemins relatifs à `src/gameIso/rig`, triés). */
export const modulesDuRig = (): string[] =>
  listerArbre(RIG, { filtre: (rel: string) => rel.endsWith('.ts') && !estFichierVitest(rel) && !rel.endsWith('.d.ts') });

/** Une palette déclarée, l'endroit où elle est écrite (`<fichier>:<chemin>`) et les entrées que le rig
 *  applique à sa couche. */
export interface PaletteInventoriee {
  ou: string;
  palette: Readonly<Record<string, string>>;
  entrees: (p: PaletteDeclaree) => readonly PaletteDeclaree[];
}

const seule = (p: PaletteDeclaree): readonly PaletteDeclaree[] => [p];
const especes = (p: PaletteDeclaree): readonly PaletteDeclaree[] => [undefined, ...TETES_A_PEAU].map((t) => coucheDEspece(p, t));

const estPalette = (x: unknown): x is Record<string, string> =>
  !!x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length > 0 &&
  Object.values(x).every((v) => typeof v === 'string' && HEX.test(v));

const nomDe = (o: unknown): string | undefined =>
  o && typeof o === 'object' ? ((o as { id?: string }).id ?? (o as { slug?: string }).slug) : undefined;

/** Toutes les palettes déclarées : les espèces, puis celles des modules du rig, chacune à son déclarant. */
export async function palettesDeclarees(): Promise<PaletteInventoriee[]> {
  const out: PaletteInventoriee[] = [];
  const dEspece = new Set<unknown>();
  for (const [id, race] of Object.entries(RACES)) for (const cle of ['palette', 'paletteF'] as const) {
    const p = race[cle];
    if (p && !dEspece.has(p)) { dEspece.add(p); out.push({ ou: `src/data/${FICHIER_D_ESPECES}:${id}.${cle}`, palette: p, entrees: especes }); }
  }
  const candidats = new Map<Record<string, string>, Map<string, string>>();
  const marcher = (x: unknown, ou: string, fichier: string, prof: number, cle: string, vus: Set<unknown>): void => {
    if (!x || typeof x !== 'object' || prof > 9) return;
    if (estPalette(x) && CLE_DE_PALETTE.test(cle)) {
      if (dEspece.has(x)) return;
      const parFichier = candidats.get(x) ?? new Map<string, string>();
      if (!parFichier.has(fichier)) parFichier.set(fichier, ou);
      candidats.set(x, parFichier);
      return;
    }
    if (vus.has(x)) return;
    vus.add(x);
    for (const [k, v] of Object.entries(x)) marcher(v, `${ou}.${k}`, fichier, prof + 1, k, vus);
  };
  for (const rel of modulesDuRig()) {
    const mod = (await import(pathToFileURL(resolve(RIG, rel)).href)) as Record<string, unknown>;
    const fichier = `src/gameIso/rig/${rel}`;
    const vus = new Set<unknown>();
    for (const [exp, v] of Object.entries(mod)) {
      if (Array.isArray(v)) v.forEach((e, i) => marcher(e, `${fichier}:${exp}[${nomDe(e) ?? i}]`, fichier, 0, '', vus));
      else marcher(v, `${fichier}:${exp}`, fichier, 0, exp, vus);
    }
  }
  const cache = new Map<string, string[] | null>();
  const cloture = (fichier: string): Set<string> => new Set(
    [...clotureDImports([resolve(RACINE, fichier)], { retenir: (abs: string) => abs.includes('/src/'), cache, typesEffaces: true })]
      .map((r) => resolve(r)),
  );
  for (const [palette, parFichier] of candidats) {
    const fichiers = [...parFichier.keys()];
    const declarants = fichiers.filter((f) => {
      const c = cloture(f);
      return fichiers.every((g) => g === f || !c.has(resolve(RACINE, g)));
    });
    if (declarants.length !== 1) {
      throw new Error(`palettesDeclarees : ${declarants.length} déclarant(s) parmi les candidats ${[...parFichier.values()].join(', ')}`);
    }
    out.push({ ou: parFichier.get(declarants[0])!, palette, entrees: seule });
  }
  return out;
}
