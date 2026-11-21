import { findTalentById, findTraitById } from '../data';
import { memeSpecialisation, type RefDesignee } from '../data/schemas/grammaire/ref';
import type { PassiveMod } from './ops';
import type { TraitInstance } from './statEntry';
import { sourceSuspended } from './suspension';
import type { ActiveEffect, CharKey, Combatant, TalentInstance } from './types';

/**
 * Valeur « base + bonus permanents de talents » pour une CharKey, SANS les modificateurs
 * de mutations/traumas/sorts/maladies. Utilisé par les lecteurs BRUTS hors-combat
 * (affichage de fiche, calcul PX) qui ont besoin du « vrai départ »
 * incluant les bonus passifs des Talents.
 * Lecture LOCALE des seuls passifs de talents : `passiveCharSum` (trauma.ts) somme les `charMod` additifs
 * de tous les porteurs.
 */
export function baseWithTalents(c: Pick<Combatant, 'characteristics'> & Partial<Pick<Combatant, 'talents'>>, key: CharKey): number {
  let val = c.characteristics[key] ?? 0;
  for (const t of c.talents ?? []) {
    for (const op of findTalentById(t.talentId)?.passive ?? []) {
      if (op.op === 'charMod' && op.characteristic === key) val += op.mod * (t.times ?? 1);
    }
  }
  return val;
}

/** Ce que lit la porte de possession `effectiveTalents` : les Talents acquis, les Traits portés (octrois)
 *  et les effets actifs (octrois, suspensions). `T` = la forme des Talents acquis du porteur. */
export interface PorteurDeTalents<T extends Pick<TalentInstance, 'talentId' | 'spec'> = TalentInstance> {
  talents?: readonly T[];
  traits?: readonly Pick<TraitInstance, 'id'>[];
  activeEffects?: readonly ActiveEffect[];
}

/** Talents STRUCTURELLEMENT possédés via un Trait porté (`TraitData.passive` `grantTalent`, ≠
 *  `grantCareerTalent`). MDG 07 l.250. Lu DIRECT sur
 *  `c.traits` (marche pour un PJ ou une créature, indépendant de `liveTraits`/spawn) — même lecture
 *  ciblée que `passiveCastPenalties` (magic.ts) pour un op STRUCTUREL, jamais un modificateur numérique
 *  foldé par `traitPassiveMods`/`passiveMods`. */
export function traitGrantedTalents(c: Pick<PorteurDeTalents, 'traits'>): RefDesignee[] {
  const out: RefDesignee[] = [];
  for (const tr of c.traits ?? []) {
    for (const op of findTraitById(tr.id)?.passive ?? []) {
      if (op.op !== 'grantTalent') continue;
      out.push({ id: op.talent.id, ...(op.talent.spec ? { spec: op.talent.spec } : {}) });
    }
  }
  return out;
}

/** Talents octroyés par un effet ACTIF porté (`ActiveEffect.grantedTalent`, op `grantTalent` à durée —
 *  Flambeau de Vertu : Sans peur ; Cœurs ardents : Cœur vaillant ; Chanceux d'un événement de bord).
 *  TEMPORAIRES par construction : ils vivent sur l'effet porteur et s'éteignent avec lui, sans jamais
 *  entrer dans `c.talents` (aucune acquisition, aucun coût en PX, rien à l'avancement). Un effet dont
 *  le compte de Rounds est épuisé ne compte plus (le retrait matériel se fait à la frontière de Round) ;
 *  les échelles `clock`/`adventure` sont purgées par leur horloge respective. */
function effectGrantedTalents(c: Pick<PorteurDeTalents, 'activeEffects'>): RefDesignee[] {
  const out: RefDesignee[] = [];
  for (const e of c.activeEffects ?? []) {
    if (!e.grantedTalent) continue;
    if (e.duration.scale === 'rounds' && e.duration.left <= 0) continue;
    out.push({ id: e.grantedTalent.talentId, ...(e.grantedTalent.spec ? { spec: e.grantedTalent.spec } : {}) });
  }
  return out;
}

/** Talents EFFECTIFS d'un combattant : `c.talents` (structurel) + ceux OCTROYÉS par un Trait porté
 *  (`traitGrantedTalents`, ex. Marque de Khorne → Savoir-vivre (Suivants de Khorne), MDG 07 l.250) + ceux
 *  octroyés par un effet ACTIF (`effectGrantedTalents`), MOINS ceux qu'un effet actif SUSPEND (op
 *  `suppressTalents`, source `talents` suspendue : `sourceSuspended`, LDB 40 l.80, l.82) —
 *  PORTE UNIQUE de la POSSESSION effective : tout lecteur qui demande « le porteur a-t-il ce Talent, à
 *  quel niveau ? » (capacités de combat, +DR, passifs, Groupes, Conditions `has`, fiche) passe par elle.
 *  `c.talents` brut reste la source d'ACQUISITION (achat PX, Maxi, avancement, création) : une
 *  suspension n'y touche pas, le Talent revient sans PX à l'échéance de l'effet. Dédoublonne par
 *  `(talentId, spec)` — un porteur qui possède AUSSI le talent en propre n'est compté qu'une fois
 *  (l'entrée structurelle, `times` réel, prime sur l'octroi). */
export function effectiveTalents<T extends Pick<TalentInstance, 'talentId' | 'spec'> = TalentInstance>(c: PorteurDeTalents<T>): (T | TalentInstance)[] {
  const own = c.talents ?? [];
  const granted: RefDesignee[] = [];
  for (const g of [...traitGrantedTalents(c), ...effectGrantedTalents(c)]) {
    const already = own.some((t) => t.talentId === g.id && memeSpecialisation(t.spec, g.spec))
      || granted.some((k) => k.id === g.id && memeSpecialisation(k.spec, g.spec));
    if (!already) granted.push(g);
  }
  return [...own, ...granted.map((g) => ({ talentId: g.id, spec: g.spec, times: 1 }))]
    .filter((t) => !sourceSuspended(c, { category: 'talents', id: t.talentId }));
}

/** Traits de créature que confèrent les Talents possédés de `c` (`TalentData.confereTrait`), la
 *  spécialisation de l'instance en argument : dérivés à la lecture, jamais posés. LDB 10 l.506, l.548 */
export function traitsConferes(c: Combatant): TraitInstance[] {
  return effectiveTalents(c).flatMap((t) => {
    const id = findTalentById(t.talentId)?.confereTrait?.id;
    if (!id) return [];
    return [t.spec ? { id, arg: t.spec } : { id }];
  });
}

/** Modificateurs PASSIFS continus des talents POSSÉDÉS (`TalentData.passive` : Coup puissant, Dur à cuire…)
 *  en `OpPassive[]`, émis kind `intrinseque` et RÉPÉTÉS par niveau (`t.times`).
 *  Lus par le collecteur `passiveMods` (trauma) EXACTEMENT comme `traitPassiveMods` pour les traits — le
 *  talent (instance = id seul) est résolu par `findTalentById`. Disjoint des traits → zéro double-comptage. */
export function talentPassiveMods(c: Combatant): PassiveMod[] {
  const out: PassiveMod[] = [];
  for (const t of effectiveTalents(c)) {
    const ops = findTalentById(t.talentId)?.passive;
    // `src` = LE talent émetteur : il NOMME la composante d'un détail de jet et ouvre sa fiche
    // (patron des traits/mutations) — jamais le repli de famille (`passivePartLine`).
    if (ops) for (let i = 0; i < (t.times ?? 1); i++) for (const op of ops) out.push({ op, kind: 'intrinseque', src: { category: 'talents', id: t.talentId } });
  }
  return out;
}
