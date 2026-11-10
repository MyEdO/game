/** EDOC 16 l.421 ; MSRC 19 l.498 ; ZI 14 l.55 ; PDTC 01 l.3 */
import type { CharKey, Characteristics, Combatant } from '../engine/types';
import { enPieces, type Money } from '../engine/money';
import { rollDice, type DiceSpec, type RNG } from '../engine/dice';
import { heroDeFiche, type FicheDeHeros } from '../engine/heroDeFiche';
import type { FabriqueDId } from '../engine/fabriqueDId';
import type { IdDeHerosDuRoster } from '../lib/idDeHerosDuRoster';
import type { DescRef, Sexe, SourceRef } from './schemas/grammaire/valeurs';
import type { CountSpec, TalentRef, TrappingRef } from './index';
import { pregens } from './index';

/** Une entrée de `pregens.json` : la fiche imprimée d'un prétiré officiel. */
export interface PregenDef {
  id: string;
  type: 'pregens';
  label: string;
  descRef: DescRef;
  source: SourceRef;
  species: { id: string };
  carrieres: Record<string, number>;
  initiales: Characteristics;
  charAdvances: Partial<Record<CharKey, number>>;
  /** Augmentations par Compétence : un nombre, ou un nombre par spécialisation. */
  skills: Record<string, number | Record<string, number>>;
  talents: TalentRef[];
  trappings: Extract<TrappingRef, { id: string; type?: never } | { text: string }>[];
  spells: string[];
  fate: number;
  resilience: number;
  xp: number;
  motivation: string;
  age: number;
  sex: Sexe;
  richesse: DiceSpec;
  monnaie: keyof Money;
}

/** La quantité imprimée d'une possession : `count` fixe, 1 sans `count`. */
function quantite(d: PregenDef, count: CountSpec | undefined): number {
  if (!count) return 1;
  if ('fixed' in count) return count.fixed;
  throw new Error(`Prétiré « ${d.id} » : quantité tirée (${count.roll.n}d${count.roll.sides}) — une fiche imprimée ne tire rien.`);
}

/** L'id STABLE du héros du prétiré `id`. */
export const idDuPretire = (id: string): IdDeHerosDuRoster => `pretire-${id}` as IdDeHerosDuRoster;

/** La fiche de héros du prétiré `d`. */
export function ficheDuPretire(d: PregenDef): FicheDeHeros {
  return {
    speciesId: d.species.id,
    parcours: { carrieres: d.carrieres },
    id: idDuPretire(d.id),
    label: d.label,
    initiales: d.initiales,
    charAdvances: d.charAdvances,
    skills: Object.entries(d.skills).flatMap(([id, a]) => (typeof a === 'number' ? [{ id, advances: a }] : Object.entries(a).map(([spec, advances]) => ({ id, spec, advances })))),
    talents: d.talents.map(({ id, spec, times }) => ({ id, ...(spec ? { spec } : {}), times: times ?? 1 })),
    trappings: d.trappings.map((t) => ('text' in t ? { text: t.text, qte: quantite(d, t.count) } : { id: t.id, ...(t.spec ? { spec: t.spec } : {}), qte: quantite(d, t.count) })),
    spells: d.spells,
    fate: d.fate,
    resilience: d.resilience,
    xp: d.xp,
    motivation: d.motivation,
    details: { age: d.age },
    apparence: { sex: d.sex },
  };
}

const heroDuPretire = (d: PregenDef, idNeuf: FabriqueDId): Combatant => heroDeFiche(ficheDuPretire(d), idNeuf);

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

/** La Richesse de départ imprimée du prétiré `d`, tirée sur `rng`. */
export function richesseDuPretire(d: PregenDef, rng: RNG): Money {
  return enPieces(d.monnaie, rollDice(d.richesse, rng));
}

export const GROUPE_VITRINE = ['wanda-weltschmertz', 'harbull-piedvelu', 'malmir-giluviel', 'werner-murrmann'] as const;

/** Les héros de `GROUPE_VITRINE`, dans son ordre. */
export function groupeVitrine(idNeuf: FabriqueDId): Combatant[] {
  return GROUPE_VITRINE.map((id) => pretire(idNeuf, id));
}
