/**
 * Icônes & résumé des États (malus) et buffs (`activeEffects`) — couche AFFICHAGE partagée
 * (pion sur le terrain, panneau Perso, ordre de bataille, fiche express au survol).
 * Aucune règle ici : on lit `conditions[]` et `activeEffects[]` déjà gérés par le moteur.
 */
import { CHAR_LABELS, CATEGORY_BY_SOURCE_KIND, type ConditionInstance, type ActiveEffect, type CharKey, type Combatant, type EffectSource } from '../engine/types';
import type { IconId } from '../ui/icons';
import {
  conditionLabel, findConditionById, findPsychologyById, findSpellById, refLabel,
  creatures, maladies, maneuvers, mutations, qualities, regles, symptoms, talents, findTrappingById, traits,
} from '../data';
import { ACTIVITIES } from '../engine/activities';
import { MISCAST_TABLES } from '../engine/miscast';
import { slugId } from '../data/slug';
import { isFrenzied } from '../engine/psychology';
import { NARRATIVE_MARKERS, conditionSeverity } from '../engine/conditions';
import { roundsLabel } from '../engine/duration';

/** Clés STABLES des états-drapeaux (`EffectFlags`) — vocabulaire d'identité partagé par `flagChips`
 *  (production) et `chipCodex` (routage Codex). `calmeApproche` est produit hors `combatantFlags` :
 *  la donnée vit sur `battle` (`fearGate`), pas sur le Combatant. */
export type FlagId = 'frenzied' | 'defensiveStance' | 'aiming' | 'focusDr' | 'hunger' | 'fear' | 'calmeApproche';

export interface EffectChip {
  key: string;
  /** Id d'icône du registre `src/ui/icons/` — rendu par `<Icon>` (HTML) ou `<IconG>` (SVG). */
  icon: IconId;
  label: string;
  /** malus = État négatif ; buff = effet temporisé (activeEffects) ; state = état-drapeau (Frénésie…). */
  kind: 'malus' | 'buff' | 'state';
  /** id STABLE de l'État (malus) pour la résolution Codex par id — `ConditionInstance.name` (slug
   *  d'etats.json). Absent sur buff/état-drapeau (hors catalogue États). */
  condId?: string;
  /** id STABLE du sort/prière SOURCE d'un buff (`ActiveEffect.sourceSpellId`) — résolution Codex Sorts. */
  sourceSpellId?: string;
  /** id STABLE de l'effet lui-même (`ActiveEffect.effectId`) — 2ᵉ ancrage de règle d'un buff, quand il
   *  n'est pas issu d'un lancement (ivresse, exposition, chanson de marin…). */
  effectId?: string;
  /** Entité SOURCE de l'effet (`ActiveEffect.source`) — ancrage de règle GÉNÉRAL, tous types confondus. */
  source?: EffectSource;
  /** Libellé de l'entité qui PORTE cet État (`ConditionInstance.derivedFrom.src`, une `CodexTarget` de
   *  n'importe quelle famille) — résolu par `refLabel`, jamais une chaîne par famille. Absent sur un
   *  État natif. Dit par `chipNom` : le nom accessible et l'infobulle nomment la source. */
  sourceLabel?: string;
  /** id STABLE de l'état-drapeau (clé d'`EffectFlags`) — SEUL moyen d'identifier un drapeau en aval
   *  (routage Codex de `chipCodex`) : le `label` est de l'affichage, jamais une clé de logique. */
  flagId?: FlagId;
  severity: number;
  /** Empilement (n>1) — ex. Hémorragique ×3. Sur un groupe d'effets, n'est posé que si le groupe est
   *  HOMOGÈNE (même carac, même bonus) : un `×N` sur des caracs différentes se lirait comme un cumul
   *  sur UNE carac (#1117). */
  count?: number;
  /** Nombre de CARACTÉRISTIQUES touchées par un groupe hétérogène à bonus uniforme (Exposition,
   *  Ivresse) — remplace la carac unique, qui serait celle du premier effet seulement. */
  charCount?: number;
  /** CHIFFRE porté par la pastille elle-même (rack d'alvéoles de `StateChips`) : pions de l'État
   *  (`ConditionInstance.value`), DR de Focalisation, Indice de la Peur, ou nombre d'effets d'un
   *  groupe homogène. Absent = la pastille n'a aucun chiffre à dire (Frénésie, En joue…). AFFICHAGE
   *  seul : aucune règle ne le lit. */
  indice?: number;
  /** Rounds restants (buffs temporisés). */
  rounds?: number;
  /** Bonus du buff (ex. +10). */
  bonus?: number;
  char?: CharKey;
}

interface CondMeta { icon: IconId; severity: number; important: boolean; }

/** Icône + sévérité d'AFFICHAGE d'un État — icône lue en DONNÉE (`etats.json`) ou sur un marqueur
 *  narratif (registre UNIQUE `NARRATIVE_MARKERS`, engine ; repli `journal/info`) ; sévérité déléguée
 *  à `conditionSeverity` (même registre). `important` =
 *  sévérité ≥ 50 (incapacitant, créneau unique de l'ordre de bataille). Clé SLUGIFIÉE → tolère un
 *  libellé ('Pétrifié' → 'petrifie'). */
export function conditionMeta(name: string): CondMeta {
  const id = slugId(name);
  const icon = ((findConditionById(id)?.icon ?? NARRATIVE_MARKERS[id]?.icon) as IconId | undefined) ?? 'journal/info';
  const severity = conditionSeverity(name);
  return { icon, severity, important: severity >= 50 };
}

const BUFF_CHAR_ICON: Partial<Record<CharKey, IconId>> = {
  'capacite-de-combat': 'char/cc', 'capacite-de-tir': 'char/ct', force: 'char/f', endurance: 'char/e', agilite: 'char/ag', intelligence: 'char/int', 'force-mentale': 'char/fm', sociabilite: 'char/soc',
};

/** Icône d'une CARACTÉRISTIQUE — source UNIQUE (registre `char/*`), keyée par id. Consommée par les
 *  pastilles d'effet ET par les alvéoles d'Avantage de la console (une Compétence porte le glyphe de
 *  son axe). Les axes sans glyphe au registre (Dextérité, Initiative) retombent sur `repli`. */
export function charIcon(char: CharKey | undefined, repli: IconId = 'action/aim'): IconId {
  return (char && BUFF_CHAR_ICON[char]) || repli;
}
function buffIcon(e: ActiveEffect): IconId {
  return charIcon(e.char, 'action/cast'); // buff sans carac = effet de sort/bénédiction
}

function malusChips(conditions: ConditionInstance[]): EffectChip[] {
  return conditions
    .map((c): EffectChip => {
      const m = conditionMeta(c.id);
      const src = c.derivedFrom?.src;
      return { key: `c-${c.id}`, condId: c.id, icon: m.icon, label: conditionLabel(c.id), kind: 'malus', severity: m.severity, count: c.value > 1 ? c.value : undefined, indice: c.value, ...(src ? { sourceLabel: refLabel(src.category, { id: src.id }) } : {}) };
    })
    .sort((a, b) => b.severity - a.severity);
}

/**
 * Un effet posé PAR CARACTÉRISTIQUE (Exposition au froid : −10 CT/Agilité/Dextérité au 1ᵉʳ échec, puis
 * toutes les autres au 2ᵉ — LDB 18 l.334 ; Ivresse : malus multi-caracs marqués `effectId:'ivresse'`)
 * vit en PLUSIEURS `ActiveEffect` qui partagent leur `effectId`. Ils se rendent en UNE pastille — sans
 * quoi la même identité se répétait jusqu'à 10 fois (clés React dupliquées, recette #1117).
 *
 * Ce que la pastille groupée AFFICHE ne dit QUE des faits (arbitrage #1117) :
 *  - groupe HOMOGÈNE (même Caractéristique, même bonus) → le bonus, sa carac, et `×N` : N fois le
 *    même malus sur la même carac, c'est vrai ;
 *  - groupe HÉTÉROGÈNE (caracs différentes, bonus uniforme) → le bonus et le NOMBRE de Caractéristiques
 *    touchées (`charCount`), JAMAIS la carac du premier effet ni un `×N` (« −10 Capacité de Tir ×10 »
 *    se lisait −100 CT : un mensonge) ;
 *  - bonus NON uniforme → l'identité de l'État seule, aucun chiffre. Le détail vit au clic (fiche).
 */
function buffChips(effects: ActiveEffect[]): EffectChip[] {
  const groups = new Map<string, ActiveEffect[]>();
  effects.forEach((e, i) => {
    const key = `b-${e.effectId ?? e.source?.id ?? i}`;
    const g = groups.get(key);
    if (g) g.push(e);
    else groups.set(key, [e]);
  });
  return [...groups].map(([key, list]): EffectChip => {
    const e = list[0];
    const n = list.length;
    const sameChar = list.every((x) => x.char === e.char);
    const sameBonus = list.every((x) => x.bonus === e.bonus);
    // Faits affichables du GROUPE (cf. en-tête) — au-delà, rien n'est chiffré.
    const detail = n === 1 || (sameChar && sameBonus) ? { bonus: e.bonus, char: e.char, ...(n > 1 ? { count: n, indice: n } : {}) }
      : sameBonus ? { bonus: e.bonus, charCount: n }
        : {};
    return {
      key,
      ...detail,
      icon: buffIcon(e),
      label: e.label,
      kind: 'buff',
      severity: 50,
      rounds: e.duration.scale === 'rounds' ? e.duration.left : undefined,
      sourceSpellId: e.sourceSpellId,
      effectId: e.effectId,
      source: e.source,
    };
  });
}

/** Détail PARAMÉTRÉ d'une pastille (bonus + carac, Rounds restants, empilement) — la part variable
 *  que le catalogue ne porte pas. Vide quand la pastille n'a que son libellé. Pur. */
export function chipDetail(c: EffectChip): string {
  const parts: string[] = [];
  // Le bonus se dit AVEC sa portée RÉELLE : sa carac (effet unique/groupe homogène), ou le NOMBRE de
  // Caractéristiques touchées (groupe hétérogène) — jamais la carac du premier effet d'un groupe.
  if (c.bonus) {
    const portee = c.char ? ` ${CHAR_LABELS[c.char]}` : c.charCount ? ` sur ${c.charCount} Caractéristiques` : '';
    parts.push(`${c.bonus > 0 ? '+' : ''}${c.bonus}${portee}`);
  }
  if (c.rounds != null) parts.push(`${roundsLabel(c.rounds)} restant${c.rounds > 1 ? 's' : ''}`);
  if ((c.count ?? 1) > 1) parts.push(`×${c.count}`);
  return parts.join(' · ');
}

/**
 * NOM d'une pastille : son libellé, la SOURCE qui la porte quand l'État est dérivé, puis son détail
 * paramétré. SOURCE UNIQUE du texte qui NOMME une pastille — le nom accessible d'une alvéole (rack du
 * portrait, chips de la fiche : une alvéole ne rend qu'un glyphe et son chiffre, règle stricte 4) et le
 * titre d'instance de son popover (`chipCodex`) sont le MÊME texte : une seule forme pour toutes les
 * vues. Pur.
 */
export function chipNom(c: EffectChip): string {
  const base = c.sourceLabel ? `${c.label} — ${c.sourceLabel}` : c.label;
  const detail = chipDetail(c);
  return detail ? `${base} — ${detail}` : base;
}

/** Cible d'information d'une pastille d'effet, IDENTIQUE pour toute la famille (`EffectChips`,
 *  `StateChips`, section « Effets actifs ») : un seul mécanisme, `CodexRef` — État vers le catalogue
 *  États, buff vers son sort source, et à défaut un popover de secours portant le détail. Jamais
 *  d'infobulle native (`title`), qui concurrencerait le popover. Pur. */
export interface ChipCodex {
  category: string;
  /** id STABLE de l'entrée catalogue — toujours présent : sans lui il n'y a pas de cible. */
  id: string;
  label: string;
  /** Libellé paramétré (détail inclus) — en tête du popover, le libellé catalogue en sous-titre. */
  instance?: string;
}

/** Existence d'une entrée par id STABLE, par catégorie Codex — une cible ne se PRÉSUME pas.
 *  Arbitrage user 2026-07-18 : « une chips de ce genre n'a de sens que si elle est reliée à une règle ». */
const byId = (list: readonly { id: string }[]) => (id: string) => list.some((e) => e.id === id);
const CATALOGUE_HAS: Record<string, (id: string) => boolean> = {
  etats: (id) => !!findConditionById(id),
  spells: (id) => !!findSpellById(id),
  psychologies: (id) => !!findPsychologyById(id),
  regles: byId(regles),
  talents: byId(talents),
  traits: byId(traits),
  trappings: (id) => findTrappingById(id) !== undefined,
  qualities: byId(qualities),
  maladies: byId(maladies),
  symptoms: byId(symptoms),
  mutations: byId(mutations),
  maneuvers: byId(maneuvers),
  creatures: byId(creatures),
  activities: byId(ACTIVITIES),
  // Rangées des tableaux d'Incantation Imparfaite / de Colère des dieux, sous la catégorie que CHAQUE
  // table déclare en donnée (`MiscastTableDef.codexCategory`) : une table de plus n'ajoute aucune ligne
  // ici, et une table sans catégorie n'en ouvre aucune (ses lignes n'ont pas de fiche à viser).
  ...Object.fromEntries(MISCAST_TABLES.flatMap((t) => (t.codexCategory ? [[t.codexCategory, byId(t.entries)] as const] : []))),
};

/** Catégories fouillées pour un `ActiveEffect.effectId` (ivresse, exposition, chanson de marin…), dans
 *  cet ordre — l'effet n'étant pas issu d'un lancement, sa règle vit hors du catalogue Sorts. */
const EFFECT_ID_CATEGORIES = ['regles', 'etats', 'psychologies'] as const;

/** Entrée CATALOGUE d'un état-drapeau — routage par id STABLE (`FlagId`), jamais par libellé. La table
 *  est TOTALE : un état affiché sans règle derrière lui serait un défaut d'affichage, pas une donnée
 *  manquante (arbitrage user 2026-07-18). */
const FLAG_CODEX: Record<FlagId, { category: string; id: string }> = {
  frenzied: { category: 'psychologies', id: 'frenesie' },
  fear: { category: 'psychologies', id: 'peur' },
  focusDr: { category: 'regles', id: 'focalisation-etendue' },
  defensiveStance: { category: 'regles', id: 'sur-la-defensive' },
  hunger: { category: 'regles', id: 'faim-et-soif' },
  aiming: { category: 'regles', id: 'viser' },
  calmeApproche: { category: 'regles', id: 'calme-d-approche' },
};

/** Règle ADOSSÉE à une pastille, ou `null` quand la pastille n'en a aucune. Priorité, toujours par id
 *  STABLE : drapeau (table totale) → État par `condId` → ENTITÉ SOURCE de l'effet (`source` : sort,
 *  talent, trait, objet, maladie…) → sort source (`sourceSpellId`) → `effectId`. `null` = pastille
 *  NON RÉSOLUE : elle reste affichée (masquer un état
 *  mécanique actif serait pire) mais SANS aucune affordance d'information — pas de `CodexRef`, pas de
 *  popover, pas de `title`. Aucun repli : une pastille est reliée à une règle, ou elle ne promet rien
 *  (arbitrage user 2026-07-18, « j'aime pas ta fallback »). Pur. */
export function chipCodex(c: EffectChip): ChipCodex | null {
  const nom = chipNom(c);
  const at = (category: string, id: string | undefined, instance: string | undefined): ChipCodex | null =>
    id && CATALOGUE_HAS[category]?.(id) ? { category, id, label: c.label, instance } : null;
  const withDetail = nom !== c.label ? nom : undefined;

  const flag = c.flagId ? FLAG_CODEX[c.flagId] : undefined;
  if (flag) return at(flag.category, flag.id, withDetail ?? c.label);
  if (c.kind !== 'buff') return at('etats', c.condId, withDetail);
  const bySource = c.source ? at(CATEGORY_BY_SOURCE_KIND[c.source.kind], c.source.id, withDetail) : null;
  if (bySource) return bySource;
  const bySpell = at('spells', c.sourceSpellId, withDetail);
  if (bySpell) return bySpell;
  for (const cat of EFFECT_ID_CATEGORIES) {
    const byEffect = at(cat, c.effectId, withDetail);
    if (byEffect) return byEffect;
  }
  return null;
}

/** États-drapeaux (hors `conditions[]`) : postures/actions vivant sur le Combatant. */
export interface EffectFlags {
  frenzied?: boolean;
  defensiveStance?: boolean;
  aiming?: boolean;
  /** DR de Focalisation cumulé (undefined = pas de Focalisation en cours). */
  focusDr?: number;
  /** Faim (#T2, LDB 18 l.337-343) : jours sans manger + échecs (malus de caracs actifs). */
  hunger?: { days: number; failures: number };
  /** Sous l'emprise de la PEUR (LDB 21 l.27) : Indice le plus élevé des sources non surmontées
   *  (calmeDR < Indice). Undefined = aucune Peur active. */
  fear?: number;
}

/** Extrait les états-drapeaux affichables d'un Combatant (source unique pour tous les affichages). */
export function combatantFlags(c: Combatant): EffectFlags {
  const fears = (c.psychState ?? []).filter((p) => p.type === 'peur' && (p.calmeDR ?? 0) < (p.indice ?? 1));
  return {
    frenzied: isFrenzied(c), defensiveStance: c.defensiveStance, aiming: c.aiming, focusDr: c.focus?.dr,
    hunger: (c.hunger?.days ?? 0) >= 1 ? { days: c.hunger!.days, failures: c.hunger!.failures } : undefined,
    fear: fears.length ? Math.max(...fears.map((p) => p.indice ?? 1)) : undefined,
  };
}

function flagChips(flags?: EffectFlags): EffectChip[] {
  const out: EffectChip[] = [];
  if (flags?.frenzied) out.push({ key: 'f-frenzied', flagId: 'frenzied', icon: 'flag/frenzy', label: 'Frénésie', kind: 'state', severity: 68 });
  if (flags?.defensiveStance) out.push({ key: 'f-def', flagId: 'defensiveStance', icon: 'flag/defensive', label: 'Sur la défensive (+20 en défense)', kind: 'state', severity: 60 });
  if (flags?.aiming) out.push({ key: 'f-aim', flagId: 'aiming', icon: 'action/aim', label: 'En joue (+20 au prochain tir)', kind: 'state', severity: 55 });
  if (flags?.focusDr != null) out.push({ key: 'f-focus', flagId: 'focusDr', icon: 'flag/focus', label: `Focalisation (DR ${flags.focusDr})`, kind: 'state', severity: 50, count: flags.focusDr, indice: flags.focusDr });
  if (flags?.hunger) {
    const h = flags.hunger;
    out.push({
      key: 'f-hunger', flagId: 'hunger', icon: 'flag/hungry', kind: 'state', severity: 62,
      label: `Affamé (${h.days} j sans manger${h.failures >= 2 ? ' — −10 à toutes les Caractéristiques' : h.failures === 1 ? ' — −10 Force/Endurance' : ''}) : pas de récupération naturelle`,
    });
  }
  if (flags?.fear != null) {
    out.push({
      key: 'f-fear', flagId: 'fear', icon: 'flag/fear', kind: 'state', severity: 66, indice: flags.fear,
      label: `Peur (Indice ${flags.fear}) — −1 DR contre la source ; approcher exige un Test de Calme (+0) ; Test étendu de Calme en fin de Round pour la vaincre`,
    });
  }
  return out;
}

export interface EffectSummary { visible: EffectChip[]; moreCount: number; }

/** Liste compacte des effets : malus (triés par sévérité) → états-drapeaux → buffs,
 *  tronquée à `maxVisible` ; le surplus est reporté dans `moreCount` (« +N »). */
export function summarizeEffects(
  conditions: ConditionInstance[] = [],
  effects: ActiveEffect[] = [],
  maxVisible = Infinity,
  flags?: EffectFlags,
): EffectSummary {
  const all = [...malusChips(conditions), ...flagChips(flags), ...buffChips(effects)];
  if (all.length <= maxVisible) return { visible: all, moreCount: 0 };
  return { visible: all.slice(0, maxVisible), moreCount: all.length - maxVisible };
}

/** L'État important le plus grave présent (créneau unique de l'ordre de bataille), ou null. */
export function topImportantCondition(conditions: ConditionInstance[] = []): EffectChip | null {
  // « important » = sévérité ≥ 50 (cf. conditionMeta) — lu directement sur le chip (label déjà résolu).
  const imp = malusChips(conditions).filter((c) => c.severity >= 50);
  return imp[0] ?? null;
}
