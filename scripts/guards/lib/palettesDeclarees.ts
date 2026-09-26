/**
 * INVENTAIRE des palettes DÉCLARÉES que reçoit `buildTokenMap` (`src/gameIso/rig/palette.ts`), toutes
 * familles d'art (#1903 D3) — définition UNIQUE, lue par la garde d'ordre des gammes
 * `src/gameIso/rig/parts/tenues/palette-luminance.test.ts`.
 *
 * Sources : chaque module `.ts` de `src/gameIso/rig` hors tests (registres générés compris, parcourus
 * par `listerArbre`), dédupliqués par identité d'objet, et les espèces (`raceAppearance.json`,
 * `palette` et `paletteF`) que `races/` ne porte pas déjà à l'identique. Une palette est un objet dont TOUTES les valeurs sont des hex `#rrggbb`,
 * rangé sous une clé `palette`, `paletteF` ou `…DEFAULT` (`CLE_DE_PALETTE`).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { listerArbre } from './lister.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RIG = resolve(RACINE, 'src/gameIso/rig');

const HEX = /^#[0-9a-f]{6}$/i;
export const CLE_DE_PALETTE = /^(palette|paletteF)$|DEFAULT$/;

/** Modules du rig parcourus par l'inventaire : chaque `.ts` hors tests et déclarations de types
 *  (chemins relatifs à `src/gameIso/rig`, triés). */
export const modulesDuRig = (): string[] =>
  listerArbre(RIG, { filtre: (rel: string) => rel.endsWith('.ts') && !/\.(test|d)\.ts$/.test(rel) });

/** Une palette déclarée et l'endroit où elle vit (`<famille>:<id>` ou `raceAppearance:<id>.<clé>`). */
export interface PaletteInventoriee { ou: string; palette: Readonly<Record<string, string>> }

const estPalette = (x: unknown): x is Record<string, string> =>
  !!x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length > 0 &&
  Object.values(x).every((v) => typeof v === 'string' && HEX.test(v));

const nomDe = (o: unknown): string | undefined =>
  o && typeof o === 'object' ? ((o as { id?: string }).id ?? (o as { slug?: string }).slug) : undefined;

/** Toutes les palettes déclarées, dans l'ordre des modules (triés), puis des espèces. */
export async function palettesDeclarees(): Promise<PaletteInventoriee[]> {
  const out: PaletteInventoriee[] = [];
  const vus = new Set<unknown>();
  const marcher = (x: unknown, ou: string, prof: number, cle: string): void => {
    if (!x || typeof x !== 'object' || prof > 9) return;
    if (estPalette(x) && CLE_DE_PALETTE.test(cle)) {
      if (!vus.has(x)) { vus.add(x); out.push({ ou, palette: x }); }
      return;
    }
    if (vus.has(x)) return;
    vus.add(x);
    for (const [k, v] of Object.entries(x)) marcher(v, `${ou}.${k}`, prof + 1, k);
  };
  const module = async (chemin: string, famille: string): Promise<void> => {
    const mod = (await import(pathToFileURL(chemin).href)) as Record<string, unknown>;
    for (const [exp, v] of Object.entries(mod)) {
      if (Array.isArray(v)) v.forEach((e, i) => marcher(e, `${famille}:${nomDe(e) ?? i}`, 0, ''));
      else marcher(v, `${famille}:${exp}`, 0, exp);
    }
  };
  for (const rel of modulesDuRig()) await module(resolve(RIG, rel), rel.replace(/\/?(_registry\.generated)?\.ts$/, ''));
  const especes = JSON.parse(readFileSync(resolve(RACINE, 'src/data/raceAppearance.json'), 'utf8')) as { id: string; palette?: Record<string, string>; paletteF?: Record<string, string> }[];
  const signature = (p: Readonly<Record<string, string>>) => JSON.stringify(Object.entries(p).sort());
  const parRaces = new Set(out.filter(({ ou }) => ou.startsWith('races/')).map(({ palette }) => signature(palette)));
  for (const e of especes) for (const cle of ['palette', 'paletteF'] as const) {
    const p = e[cle];
    if (p && !parRaces.has(signature(p))) out.push({ ou: `raceAppearance:${e.id}.${cle}`, palette: p });
  }
  return out;
}
