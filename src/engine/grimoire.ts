/**
 * Grimoire — apprentissage et mémorisation des sorts (LDB 46 « Mémoriser des
 * Sorts » l.16-20, 47 « Grimoires » l.19-21, et Talents de lanceur, LDB 10) :
 *
 *  - Magie mineure : « mémorise de façon permanente un nombre de Sorts égal à
 *    votre Bonus de Force Mentale » au Talent (LDB 10 l.714) → GRATUITS tant que
 *    le héros en connaît moins que BFM ; ensuite par bandes INCLUSIVES
 *    (« Jusqu'à Bonus FM ×1 : 50 PX », ×2 : 100…).
 *  - Magie des Arcanes (Domaine) : sorts du Domaine + Sorts d'Arcane communs,
 *    par bandes de Bonus d'Intelligence à 100/200/300… PX (mêmes bandes
 *    inclusives — aucun sort inclus au Talent, LDB 10 l.680-686).
 *  - Invocation (Culte) : « l'un des Miracles de son culte » au Talent (le 1er
 *    est inclus) ; suivants à 100 PX × Miracles connus.
 *  - Béni (Culte) : « reçoit les SIX Bénédictions de son culte » (LDB 41,
 *    Bénédictions par culte — table verbatim ci-dessous), aucun achat.
 *  - Magie du Chaos : chaque sort = reprise du Talent (100 PX + 1 Corruption).
 *
 * Objet grimoire (LDB 46 l.95-97, 47 l.19-21) : ÉLIGIBILITÉ seule (`canCastFromGrimoire`). Le NI de
 * lecture est calculé ailleurs — `effectiveSpellOf`/`GRIMOIRE_NI_MODS` (`src/state/combatFlow.ts`).
 */
import { Combatant } from './types';
import { bonus, effectiveChar } from './characteristics';
import { spells, blessingsOf, miraclesOf, chaosSpellsOf, findSpellById, type SpellData } from '../data'; // appartenance sort→dieu par IDS (dataset gods)
import { featuresOf } from './combatFeatures/dispatch';
import type { CastingKind } from './combatFeatures/types';
import { effectiveEntry } from './variants';
import { itemCapability } from './capabilities';

export interface CasterTalent {
  kind: CastingKind;
  /** Domaine (Feu, Ombres, Nécromancie…) ou Culte (Sigmar…), si spécialisé. */
  spec?: string;
}

/** Talents de lanceur du héros — lus du REGISTRE de talents (castingKind), specs = `ctx.spec`
 *  (« Invocation (Sigmar) » → 'Sigmar'), jamais un name-match : ajouter un Talent de lanceur = une def. */
export function casterTalents(c: Combatant): CasterTalent[] {
  const out: CasterTalent[] = [];
  for (const { def, ctx } of featuresOf(c)) {
    if (!def.castingKind) continue;
    // « (Au choix) » (libellé générique des carrières) = non encore spécialisé → joker.
    const spec = ctx.spec;
    out.push({ kind: def.castingKind, spec: spec && !/^au choix$/i.test(spec) ? spec : undefined });
  }
  return out;
}

/** Famille d'achat d'un sort (pour le comptage et l'éligibilité). */
function familyOf(spell: SpellData): CasterTalent['kind'] | null {
  return spell.family; // famille STABLE portée par la donnée, jamais déduite du libellé `type` (multilangue)
}

/** Nombre de sorts CONNUS de la famille (référence des bandes de coût). */
export function knownCount(c: Combatant, family: CasterTalent['kind']): number {
  let n = 0;
  for (const x of c.spells ?? []) {
    const sp = findSpellById(x); // `c.spells` = ids de sort (runtime)
    if (sp && familyOf(sp) === family) n++;
  }
  return n;
}

/** Nombre de Sorts connus d'un Domaine PRÉCIS (`SpellData.domainId`) — `VDM 02 l.190` (« appris au
 *  moins 8 Sorts s'y rapportant »/« du Domaine précédent »). */
export function domainSpellsKnown(c: Combatant, domainId: string): number {
  let n = 0;
  for (const x of c.spells ?? []) {
    if (findSpellById(x)?.domainId === domainId) n++;
  }
  return n;
}

/**
 * Domaines ADMIS par une entrée d'Arcane — LISTE, jamais un Domaine unique. Un Rituel imprime sa
 * rubrique **Type** (`VDM 02 l.381` : « Un lanceur de sorts qui ne pratique pas l'un des Domaines
 * listés ne peut pas y prendre part »), qui admet de UN à HUIT Domaines ; un Sort ordinaire n'en
 * porte qu'un (`domainId`). `null` = aucune restriction EXÉCUTABLE (Sort d'Arcane commun, ou Rituel
 * ouvert à tout Domaine — liste vide).
 */
export function arcaneDomainsOf(spell: SpellData): string[] | null {
  const listed = spell.ritual?.domains;
  if (listed) return listed.length ? listed : null;
  return spell.domainId != null ? [spell.domainId] : null;
}

/** Le héros a-t-il un Talent rendant CE sort apprenable ? */
export function eligibleTalent(c: Combatant, spell: SpellData): CasterTalent | undefined {
  const fam = familyOf(spell);
  const talents = casterTalents(c);
  if (fam === 'mineure') return talents.find((t) => t.kind === 'mineure');
  if (fam === 'arcane') {
    // Sans Domaine admis (Sort d'Arcane commun) : n'importe quel Domaine connu. Sinon le Talent d'UN
    // des Domaines admis (`t.spec` = id de domaine) ou un Talent non spécialisé.
    const allowed = arcaneDomainsOf(spell);
    return talents.find((t) => t.kind === 'arcane' && (allowed == null || t.spec == null || allowed.includes(t.spec)));
  }
  // Invocation/Béni/Chaos : la spec du Talent est un CULTE/Dieu (`gods.id`, id STABLE) ; l'appartenance
  // sort→dieu est portée en IDS par `gods.json` (miracles/blessings/chaosSpells) — JAMAIS par le `subType`
  // (libellé d'affichage). Spec absente (« Au choix » non assigné) = joker → tout sort de la famille.
  if (fam === 'invocation') return talents.find((t) => t.kind === 'invocation' && (t.spec == null || miraclesOf(t.spec).includes(spell.id)));
  if (fam === 'beni') return talents.find((t) => t.kind === 'beni' && (t.spec == null || blessingsOf(t.spec).includes(spell.id)));
  if (fam === 'chaos') return talents.find((t) => t.kind === 'chaos' && (t.spec == null || chaosSpellsOf(t.spec).includes(spell.id)));
  return undefined;
}

/** Valeur réduite d'un Rituel (`SpellData['ritual']['reduced']`) et la clause qui l'ouvre. */
export type RitualReduced = NonNullable<NonNullable<SpellData['ritual']>['reduced']>;

/**
 * DIFFICULTÉ RÉDUITE d'un Rituel pour CE lanceur (`VDM 02 l.398` : « **NI :** 50 (25) », `l.400` :
 * « **PX d'apprentissage :** 200 (100) » ; la rubrique **Type** du même Rituel nomme qui en
 * bénéficie). La clause vise les Domaines que le LANCEUR pratique — ses Talents, jamais le Domaine
 * du Rituel. `null` si le Rituel n'imprime pas de parenthèses ou si le lanceur n'y a pas droit.
 */
export function ritualReduction(c: Combatant, spell: { ritual?: { reduced?: RitualReduced } }): RitualReduced | null {
  const red = spell.ritual?.reduced;
  if (!red) return null;
  for (const t of casterTalents(c)) {
    if (t.kind === 'chaos' && red.chaosMagic) return red;
    if (t.kind === 'arcane' && t.spec != null && red.domains.includes(t.spec)) return red;
  }
  return null;
}

/** Verdict d'apprentissage de `spell` par `c` (LDB 46 l.14-20, LDB 10, #2312). */
export type VerdictApprentissage = 'deja-connu' | 'non-eligible' | 'ok';

export function verdictApprentissage(c: Combatant, spell: SpellData): VerdictApprentissage {
  if ((c.spells ?? []).some((x) => x === spell.id)) return 'deja-connu';
  return eligibleTalent(c, spell) ? 'ok' : 'non-eligible';
}

/**
 * Coût en PX pour APPRENDRE `spell` maintenant (LDB 10 — Talents de lanceur) ;
 * null si `verdictApprentissage` n'est pas `ok`.
 *  - Bénédictions : 0 (« reçoit les six Bénédictions de son culte »).
 *  - Rituels : les PX IMPRIMÉS par la rubrique **PX d'apprentissage** (`VDM 02 l.383` : « Un
 *    lanceur de sorts peut acquérir un Rituel en dépensant le nombre de PX indiqués »), réduits
 *    pour les lanceurs que la rubrique **Type** désigne (`ritualReduction`) — aucune bande.
 *  - Magie mineure : BFM sorts INCLUS au Talent (l.714 « vous mémorisez… un
 *    nombre de Sorts égal à votre Bonus de Force Mentale ») → 0 PX tant que
 *    connus < BFM ; ensuite 50 × bande (« Jusqu'à BFM ×N » — bande INCLUSIVE :
 *    à exactement BFM×N connus, le suivant est encore dans la bande N).
 *  - Arcanes : 100 × bande de BInt (mêmes bandes inclusives, rien d'inclus).
 *  - Invocation : le 1er Miracle est inclus au Talent (0), puis 100 × connus.
 *  - Chaos : 100 PX (et +1 Point de Corruption — appliqué par l'acheteur).
 */
export function spellCost(c: Combatant, spell: SpellData): number | null {
  if (verdictApprentissage(c, spell) !== 'ok') return null;
  if (spell.ritual) return ritualReduction(c, spell)?.xp ?? spell.ritual.xp;
  const fam = familyOf(spell)!;
  if (fam === 'beni') return 0;
  if (fam === 'chaos') return 100;
  const known = knownCount(c, fam);
  if (fam === 'mineure') {
    const band = Math.max(1, bonus(effectiveChar(c, 'force-mentale')));
    if (known < band) return 0; // inclus au Talent (LDB 10 l.714)
    return 50 * Math.ceil(known / band);
  }
  if (fam === 'arcane') {
    const band = Math.max(1, bonus(effectiveChar(c, 'intelligence')));
    return 100 * Math.max(1, Math.ceil(known / band));
  }
  // Invocation
  return known === 0 ? 0 : 100 * known;
}

/** Tous les sorts apprenables MAINTENANT par le héros, avec leur coût. */
export function learnableSpells(c: Combatant): { spell: SpellData; cost: number }[] {
  const out: { spell: SpellData; cost: number }[] = [];
  for (const s0 of spells) {
    // Énumération du catalogue : chaque entrée est ramenée à sa forme EFFECTIVE (`effectiveEntry`,
    // `src/engine/variants.ts`) — c'est l'ENTRÉE RENDUE qui en dépend (le NI affiché par
    // `src/ui/CharacterSheet.tsx:820`), `spellCost` ci-dessus ne lisant que `id`/`family`/`domainId`.
    const sp = effectiveEntry(s0);
    const cost = spellCost(c, sp);
    if (cost != null) out.push({ spell: sp, cost });
  }
  return out;
}

/** Un objet-grimoire dans le paquetage (LDB 47 l.19-21 — lecture à deux mains). Capacité par-OBJET
 *  `isGrimoire`, NON gatée sur le port (un grimoire dans le sac reste lisible) — lue PAR ID dans le
 *  catalogue (≠ nom — multilangue-safe). */
export function carriedGrimoire(c: Combatant): { label: string } | undefined {
  return (c.items ?? []).find((i) => itemCapability(i, 'isGrimoire') && !i.destroyed);
}

/** Sort lançable DEPUIS le grimoire porté (LDB 46 l.95-97, 47 l.19-21, `VDM 12 l.644-652`) : non
 *  mémorisé, du Domaine d'un Talent Magie des Arcanes du lanceur. Ne chiffre AUCUN NI. */
export function canCastFromGrimoire(c: Combatant, spell: SpellData): boolean {
  if ((c.spells ?? []).some((x) => x === spell.id)) return false; // mémorisé : pas besoin du livre
  if (!carriedGrimoire(c)) return false;
  if (spell.family !== 'arcane') return false; // un grimoire transcrit des Sorts d'Arcane (pas des Prières)
  return !!eligibleTalent(c, spell);
}