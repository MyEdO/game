/**
 * DÉCLARATIONS MORTES (#1903) : une clé déclarée dans la palette d'une TENUE, d'une ARME ou d'une
 * ARMURE est morte quand la remplacer par une sentinelle ne change aucun rendu. Pré-filtre textuel (la
 * clé sans jeton `@clé` dans l'art du def), puis preuve par rendu (vues dérivées comprises).
 * Exemptée : une base dont l'ombre ou la lumière est déclarée dans la même palette.
 * Corpus de rendu des tenues : toutes les espèces × sexe × 3 vues.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { sexeSchema } from '../../../../data/schemas/grammaire/valeurs';
import { resolveRig } from '../../composeRig';
import { bonesToSvg } from '../../renderBones';
import { asRigSpeciesId } from '../../appearance';
import { armourPart, equipDe, objetSansPorteur, pieceDeDessin, weaponPart, type FormeDArme } from '../equipment';
import { TENUE_DEFS } from './_registry.generated';
import { WEAPON_DEFS } from '../weapons/_registry.generated';
import { ARMOUR_DEFS } from '../armour/_registry.generated';
import type { ItemInstance } from '../../../../engine/types';
import type { PartArt } from '../types';
import { VIEWS } from '../../facing';
import { viewEntries } from '../../viewArt';
import { tokensOf } from '../../palette';
import { gammeDe } from '../../../../data/palette.types';

const ESPECES = (JSON.parse(readFileSync(resolve(__dirname, '../../../../data/raceAppearance.json'), 'utf8')) as { id: string }[]).map((r) => asRigSpeciesId(r.id));
const SENTINELLE = '#123457';
const LOCS = ['tete', 'corps', 'brasG', 'brasD', 'jambeG', 'jambeD'];
const vues = (a: PartArt | null) => viewEntries(a).map(([, s]) => s);

/** Clés candidates d'une palette : sans jeton `@clé` dans `art`, hors base dont un rôle est déclaré. */
const candidates = (palette: { [k: string]: string | undefined }, art: string): string[] => {
  const jetons = new Set(tokensOf(art));
  return Object.keys(palette).filter((k) =>
    !jetons.has(k) && palette[gammeDe(k, 'ombre')] == null && palette[gammeDe(k, 'lumiere')] == null);
};

/** Clés mortes d'une palette : la sentinelle ne change pas `rendu()`. */
function mortes(ou: string, palette: { [k: string]: string | undefined }, art: string, rendu: () => string): string[] {
  const cand = candidates(palette, art);
  if (!cand.length) return [];
  const ref = rendu();
  return cand.filter((k) => {
    const v = palette[k];
    palette[k] = SENTINELLE;
    const identique = rendu() === ref;
    palette[k] = v;
    return identique;
  }).map((k) => `${ou}:${k}`);
}

const texte = (x: unknown) => JSON.stringify(x);
/** Libellé qui route `armourMaterial` vers le matériau du def. */
const LIBELLE_DE_MATIERE: Record<string, string> = { rembourre: 'Gambison', cuir: 'Jaque de cuir', maille: 'Cotte de mailles', plaque: 'Plastron de plaque' };

describe('déclarations de palette mortes (#1903)', () => {
  it('aucune clé déclarée par une tenue, une arme ou une armure n’est peinte par aucun rendu', () => {
    const fautes: string[] = [];
    for (const d of TENUE_DEFS) if (d.palette)
      fautes.push(...mortes(`tenue:${d.id}`, d.palette, texte(d.set), () => ESPECES.flatMap((species) => sexeSchema.options.flatMap((sex) =>
        VIEWS.map((v) => bonesToSvg(resolveRig({ species, sex, build: 0.5, seed: 1 }, equipDe([], []), {}, d.id, v))))).join('\n')));
    for (const d of WEAPON_DEFS) if (d.palette) {
      const w: FormeDArme = { type: 'melee', forme: d.slug, skin: {} };
      fautes.push(...mortes(`arme:${d.slug}`, d.palette, texte(d.art), () => vues(objetSansPorteur(weaponPart(w))).join('\n')));
    }
    for (const d of ARMOUR_DEFS) if (d.palette) {
      const item = { uid: 'a', kind: 'armor', label: LIBELLE_DE_MATIERE[d.id] ?? d.id, locs: LOCS, equipped: true, qualities: [], enc: 0, pa: 0 } as unknown as ItemInstance;
      const slots = ['tete', 'torse', 'bras', 'jambes', 'pied', 'main', 'cou'] as const;
      fautes.push(...mortes(`armure:${d.id}`, d.palette, texte(d.set), () => slots.flatMap((s) => vues(armourPart(pieceDeDessin(item), s))).join('\n')));
    }
    expect(fautes).toEqual([]);
  });
});

