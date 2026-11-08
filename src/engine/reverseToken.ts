/**
 * Jeton d'INVERSION de Test CONSOMMABLE « pour votre prochaine aventure » (LDB 23 l.209 « Entraînement
 * au Combat » / l.218 « Observer une cible ») : posé par l'op `grantReverseToken` (`ActiveEffect.reverseToken`,
 * `duration:{scale:'adventure'}`) — MÊME canal que `statusMod` (Réputation, l.228-234), purgé s'il n'est
 * jamais consommé à l'ouverture de l'interlude suivant (`noyau/upkeep.purgeAdventureEffects`).
 *
 * « Inverser un Test » (LDB 12 l.42) = intervertir le chiffre des unités et des dizaines du d100
 * (`reverseRoll`, engine/tests.ts) — PAS une relance. Deux VOIES, deux gates RAW DISTINCTES (#508
 * réfutation) :
 *  - le Talent PERMANENT (`talentReverseFailed`, LDB 10 — Chat de gouttière/Lecture rapide/Noctambule/
 *    Pansement de fortune/Pharmacologie/Pilote/Sociable/Studieux ; Trait À sang-froid, LDB 85 l.13) : « inverser un Test RATÉ si cela
 *    entraîne un succès » — gate STRICTE (jet actuellement raté ET le renversé réussit).
 *  - le jeton d'Activité (LDB 23 l.209/218) : « vous pouvez inverser un Test [de la Compétence
 *    associée / concernant votre cible] » — AUCUNE restriction d'échec ni de conversion. Offert dès
 *    que le jeton matche le Test, réussi OU raté ; son application PERMUTE toujours, le choix
 *    appartenant au joueur (#558) — elle peut donc dégrader un succès existant, assumé par le clic.
 * `reverseAvailable` pilote l'offre du verbe (rangée d'influence, jamais un popup) ; `applyReverse`
 * l'exécute SEULEMENT sur clic, Talent d'abord (gratuit, illimité) PUIS jeton (consommé).
 *
 * Chaque source ne vaut que sur les Tests que son passage vise (LDB 12 l.42) : la Compétence ET le
 * contexte (`ReverseQuery.contexte`), lus par les deux voies. L'issue jugée (« si cela entraîne un
 * succès ») et annoncée est celle de la RANGÉE du flux (`EvaluationDeRangee` : ré-opposition, +DR), la
 * même que celle qu'elle écrit.
 */
import type { ActiveEffect, CharKey, Combatant, ContexteDeTest, JetonDInversion, ReverseQuery } from './types';
import { refCouvre } from '../data/schemas/grammaire/ref';
import { evaluateTest, reverseRoll } from './tests';
import { talentReverseFailed } from './combatFeatures/dispatch';
import { isColdBlooded } from './traits/dispatch';
import { effectiveSkillCharKey } from './skills';
import { removeActiveEffects } from './conditions';

/** Issue d'un dé pour une rangée : dé, DR, réussite. */
export interface IssueDuDe { roll: number; sl: number; success: boolean }

/** ÉVALUATION de la rangée d'un flux : ce qu'elle fait du Test naturel `tr` (ré-opposition au jet figé,
 *  +DR de Talent…). `null` = la rangée ne s'évalue pas. Absente : l'issue est celle du Test naturel. */
export type EvaluationDeRangee = (tr: IssueDuDe) => IssueDuDe | null;

const TEST_NATUREL: EvaluationDeRangee = (tr) => tr;

function naturel(roll: number, target: number): IssueDuDe {
  const e = evaluateTest(roll, target);
  return { roll: e.roll, sl: e.sl, success: e.success };
}

/** Caractéristique du Test `q` pour `c` : celle de sa Compétence, sinon la Caractéristique testée. */
function caracDuTest(c: Combatant, q: ReverseQuery): CharKey | undefined {
  return q.skill ? effectiveSkillCharKey(c, { skill: q.skill }) : q.characteristic;
}

/** Contexte PLUS LARGE qu'un contexte inclut : un amateur de théâtre est un amateur d'art (décision de
 *  règle ACE 12 l.60-62, 2026-11-03). */
const CONTEXTE_INCLUS_DANS: Partial<Record<ContexteDeTest, ContexteDeTest>> = { amateurDeTheatre: 'amateurDArt' };

/** Le contexte d'un jeton couvre-t-il celui du Test ? */
function contexteCouvre(jeton: ContexteDeTest, test: ContexteDeTest | undefined): boolean {
  return test != null && (jeton === test || CONTEXTE_INCLUS_DANS[test] === jeton);
}

/** Un jeton d'inversion couvre-t-il le Test `q` de `c` ? Aucun hors d'une aventure (LDB 23 l.209/218 :
 *  « pendant votre prochaine aventure »). Contexte d'abord (un jeton à contexte ne vaut que dans ce
 *  contexte, ADE II 09 l.33), puis Compétence : `skill` absent sur le jeton = tout Test (l.218) ; sinon
 *  match STRUCTURÉ par id (comme `talentReverseFailed`). */
function tokenMatches(c: Combatant, tok: JetonDInversion, q: ReverseQuery): boolean {
  if (q.horsAventure) return false;
  if (tok.contexte != null && !contexteCouvre(tok.contexte, q.contexte)) return false;
  if (tok.characteristic != null && tok.characteristic !== caracDuTest(c, q)) return false;
  if (tok.skill == null) return true;
  return refCouvre(tok.skill, q.skill ?? {});
}

/** Rang d'un jeton : l'illimité d'abord (rien ne se brûle), puis contexte, Compétence, Spécialisation. */
function specificite(tok: JetonDInversion): number {
  return (tok.illimite ? 8 : 0) + (tok.contexte != null ? 4 : 0) + (tok.skill != null || tok.characteristic != null ? 2 : 0) + (tok.skill?.spec != null ? 1 : 0);
}

/** Le jeton de `c` qui couvre `q` — le PLUS SPÉCIFIQUE : un jeton générique (« Observer une cible ») ne
 *  se brûle pas là où un jeton taillé pour ce Test s'applique. */
function jetonApplicable(c: Combatant, q: ReverseQuery): ActiveEffect | undefined {
  let best: ActiveEffect | undefined;
  for (const e of c.activeEffects ?? []) {
    if (!e.reverseToken || !tokenMatches(c, e.reverseToken, q)) continue;
    if (!best || specificite(e.reverseToken) > specificite(best.reverseToken!)) best = e;
  }
  return best;
}

/** Consomme le jeton d'inversion de `c` couvrant `q` (le plus spécifique), le retire de `c.activeEffects`
 *  sauf s'il est illimité, et renvoie `true` — `false` si aucun jeton ne correspond (rien de consommé). */
export function consumeReverseToken(c: Combatant, q: ReverseQuery): boolean {
  const jeton = jetonApplicable(c, q);
  if (!jeton) return false;
  if (!jeton.reverseToken!.illimite) removeActiveEffects(c, (e) => e === jeton);
  return true;
}

/** Capacité PERMANENTE d'inverser un Test RATÉ de `c` : un Talent (LDB 10), ou le Trait À sang-froid
 *  sur un Test de Force Mentale (LDB 85 l.13). Son plafond de DR éventuel, `null` si aucune. */
function capacitePermanente(c: Combatant, q: ReverseQuery): { capDR?: number } | null {
  return talentReverseFailed(c, q) ?? (isColdBlooded(c.traits) && caracDuTest(c, q) === 'force-mentale' ? {} : null);
}

/** Le Test naturel que la voie TALENT pose (dé renversé, DR plafonné), `null` si elle n'est pas offerte :
 *  gate STRICTE RAW (LDB 10 ; LDB 85 l.13) — la rangée est RATÉE et l'inversion la rend réussie. */
function voieTalent(c: Combatant, q: ReverseQuery, roll: number, target: number, evaluer: EvaluationDeRangee): IssueDuDe | null {
  const rf = capacitePermanente(c, q);
  if (!rf) return null;
  const actuel = evaluer(naturel(roll, target));
  if (!actuel || actuel.success) return null;
  const nat = naturel(reverseRoll(roll), target);
  const tr = rf.capDR != null ? { ...nat, sl: Math.min(nat.sl, rf.capDR) } : nat;
  return evaluer(tr)?.success ? tr : null;
}

/** Le Test naturel que l'inversion pose et sa voie, `null` si aucune n'est offerte. Le jeton est LIBRE
 *  (LDB 23 l.209/218 « vous pouvez inverser un Test », sans condition). */
function inversion(c: Combatant, q: ReverseQuery, roll: number, target: number, evaluer: EvaluationDeRangee): { tr: IssueDuDe; viaTalent: boolean } | null {
  const talent = voieTalent(c, q, roll, target, evaluer);
  if (talent) return { tr: talent, viaTalent: true };
  return jetonApplicable(c, q) ? { tr: naturel(reverseRoll(roll), target), viaTalent: false } : null;
}

/** Issue de la RANGÉE inversée par la seule voie TALENT, `null` si elle n'est pas offerte : la rangée
 *  qu'aucun joueur ne tient la prend d'office, gratuite et sans perte (LDB 10 ; LDB 85 l.13). */
export function inversionDeTalent(c: Combatant, q: ReverseQuery, roll: number, target: number, evaluer: EvaluationDeRangee = TEST_NATUREL): IssueDuDe | null {
  const tr = voieTalent(c, q, roll, target, evaluer);
  return tr ? evaluer(tr) : null;
}

/** `c` dispose-t-il d'une inversion OFFERTE (Talent OU jeton) pour ce jet ? Pure (aucune consommation) —
 *  pilote l'affichage du verbe « Inverser » dans la rangée d'influence (RollRow). */
export function reverseAvailable(c: Combatant, q: ReverseQuery, roll: number, target: number, evaluer: EvaluationDeRangee = TEST_NATUREL): boolean {
  return inversion(c, q, roll, target, evaluer) != null;
}

/** Issue de la RANGÉE après inversion (SANS consommer le jeton) — même sélection Talent/jeton
 *  qu'`applyReverse`. `null` si aucune voie n'est offerte. */
export function reversePreview(c: Combatant, q: ReverseQuery, roll: number, target: number, evaluer: EvaluationDeRangee = TEST_NATUREL): IssueDuDe | null {
  const inv = inversion(c, q, roll, target, evaluer);
  return inv ? evaluer(inv.tr) : null;
}

/** Applique RÉELLEMENT l'inversion (Talent d'abord — gratuit, illimité — puis jeton, consommé) : rend le
 *  Test naturel que la rangée évalue, `null` si aucune voie n'est offerte (0 gaspillage). Le jeton permute
 *  TOUJOURS une fois offert (choix du joueur, #558) : l'issue peut rester ratée ou dégrader un succès. */
export function applyReverse(c: Combatant, q: ReverseQuery, roll: number, target: number, evaluer: EvaluationDeRangee = TEST_NATUREL): IssueDuDe | null {
  const inv = inversion(c, q, roll, target, evaluer);
  if (!inv) return null;
  if (!inv.viaTalent) consumeReverseToken(c, q);
  return inv.tr;
}
