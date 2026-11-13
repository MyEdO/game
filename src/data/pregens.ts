/** EDOC 16 l.421 ; MSRC 19 l.498 ; ZI 14 l.55 ; PDTP 01 l.3 */
import type { Combatant } from '../engine/types';
import type { Money } from '../engine/money';
import type { DiceSpec, RNG } from '../engine/dice';
import { sommeTiree } from '../engine/possessionGrants';
import { buildInventory } from '../engine/items';
import type { ItemInstance } from '../engine/types';
import { heroDeFiche, type FicheDeHeros } from '../engine/heroDeFiche';
import type { FabriqueDId } from '../engine/fabriqueDId';
import type { IdDeHerosDuRoster } from '../lib/idDeHerosDuRoster';
import type { CountSpec, PregenDef } from './index';
import type { EntreeVivante } from './datasets';
import { pregens } from './index';

/** La dotation à quantité tirée aux dés (`count.roll`) : elle se tire à l'engagement, jamais sur la fiche. */
const estTiree = (t: PregenDef['trappings'][number]): t is Extract<PregenDef['trappings'][number], { id: string }> & { count: { roll: DiceSpec } } => !!t.count && 'roll' in t.count;

/** La quantité fixe imprimée d'une possession : `count.fixed`, 1 sans `count`. */
const quantite = (count: CountSpec | undefined): number => (count && 'fixed' in count ? count.fixed : 1);

/** L'id STABLE du héros du prétiré `id`. */
export const idDuPretire = (id: string): IdDeHerosDuRoster => `pretire-${id}` as IdDeHerosDuRoster;

/** La fiche de héros du prétiré `d` : ses possessions à compte fixe ou texte, sans dé (`possessionsTireesDuPretire` porte les autres). */
export function ficheDuPretire(d: EntreeVivante<PregenDef>): FicheDeHeros {
  return {
    speciesId: d.species.id,
    parcours: { carrieres: d.carrieres },
    id: idDuPretire(d.id),
    label: d.label,
    initiales: d.initiales,
    charAdvances: d.charAdvances,
    skills: Object.entries(d.skills).flatMap(([id, a]) => (typeof a === 'number' ? [{ id, advances: a }] : Object.entries(a).map(([spec, advances]) => ({ id, spec, advances })))),
    talents: d.talents.map(({ id, spec, times }) => ({ id, ...(spec ? { spec } : {}), times: times ?? 1 })),
    trappings: d.trappings.filter((t) => !estTiree(t)).map((t) => ('text' in t ? { text: t.text, qte: quantite(t.count) } : { id: t.id, ...(t.spec ? { spec: t.spec } : {}), qte: quantite(t.count) })),
    spells: d.spells,
    fate: d.fate,
    resilience: d.resilience,
    xp: d.xp,
    motivation: d.motivation,
    details: { age: d.age },
    apparence: { sex: d.sex },
  };
}

const heroDuPretire = (d: EntreeVivante<PregenDef>, idNeuf: FabriqueDId): Combatant => heroDeFiche(ficheDuPretire(d), idNeuf);

/** Le héros du prétiré `id` ; lève si `pregens.json` ne le porte pas. */
export function pretire(idNeuf: FabriqueDId, id: string): Combatant {
  const d = pregens.find((p) => p.id === id);
  if (!d) throw new Error(`Prétiré « ${id} » introuvable (pregens.json).`);
  return heroDuPretire(d, idNeuf);
}

/** Les héros de tous les prétirés, dans l'ordre de `pregens.json`. */
export function pretires(idNeuf: FabriqueDId): Combatant[] {
  return pregens.map((d) => heroDuPretire(d, idNeuf));
}

/** Les possessions du prétiré `d` imprimées à quantité aux dés, tirées sur `rng` (`buildInventory`). */
export function possessionsTireesDuPretire(d: EntreeVivante<PregenDef>, rng: RNG, idNeuf: FabriqueDId): ItemInstance[] {
  return buildInventory(d.trappings.filter(estTiree), rng, idNeuf);
}

/** La Richesse de départ imprimée du prétiré `d`, tirée sur `rng`. */
export function richesseDuPretire(d: EntreeVivante<PregenDef>, rng: RNG): Money {
  return sommeTiree(d.richesse, rng);
}

export const GROUPE_VITRINE = ['wanda-weltschmertz', 'harbull-piedvelu', 'malmir-giluviel', 'werner-murrmann'] as const;

/** Les héros de `GROUPE_VITRINE`, dans son ordre. */
export function groupeVitrine(idNeuf: FabriqueDId): Combatant[] {
  return GROUPE_VITRINE.map((id) => pretire(idNeuf, id));
}
