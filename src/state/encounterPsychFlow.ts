/**
 * Psychologie À LA RENCONTRE, hors combat (couture C, LDB 21). À l'entrée d'une scène, chaque héros
 * porteur d'un Trait psy CIBLÉ dont la Cible est présente fait un Test de Calme — Test propre pour
 * Animosité/Haine/Préjugé/Amour/Camaraderie, bande du régime CAUSÉ pour la Phobie (Peur, LDB 21 l.87).
 * La Peur/Terreur d'une CRÉATURE croisée reste exclue hors combat (cf. `engine/encounterPsych`).
 *
 * « Une situation = une modale » (#1117 L1) : une BANDE par entrée de règle mise en jeu — une fenêtre
 * « Animosité (Elfes) », une « Terreur »… — dont la DÉCLARATION (type psy, source, cible, Indice) vit
 * sur l'ÉTAPE et dont les héros concernés sont les RANGÉES (`BatchParticipant`, jets INDÉPENDANTS
 * `aggregate:'none'`). Le jet est le Test de Calme GÉNÉRIQUE de la bande (`FLOWS.cascadeBatch` →
 * `rollTest(Calme)`, kind-agnostique) ; la CONSÉQUENCE (psychState, Brisé de Terreur dérivé du DR)
 * vit dans l'applier `'encounterPsych'`, appliquée RANGÉE PAR RANGÉE. La Détermination (immunité,
 * LDB 17 l.59) est offerte par la coquille via `cascadeBatchDetermine` sur la rangée.
 */
import type { PlayerText } from '../i18n/playerText';
import type { Get, Set } from './flowTypes';
import { Combatant } from '../engine/types';
import { Scene } from './scene';
import type { CascadeStep, BatchParticipant, CascadeRoll } from './pendings';
import { ficheDEntite } from './sceneNpc';
import { encounterPsych } from '../engine/encounterPsych';
import { estCibleType, cibleLabel, PsychType, failConditionAmount, psychResolution, psychBranchOps, psychBranchFlow, supersededLines, isPsychImmune, refreshAllDefendedPsych, endEncounterPsych } from '../engine/psychology';
import { skillBaseValue } from '../engine/skills';
import { DIFFICULTY_MODIFIERS } from '../engine/types';
import { refLabel, findPsychologyById, combatStakeRef } from '../data';
import { applyOps } from '../engine/ops';
import { t } from '../i18n';
import { registerCascadeApplier, startCascade } from './cascade';
import { describeEncounterPsych } from './flowOutcomes';
import { freeCons, resultLines, makeBandFactory, type Consequence } from './rollSeam';
import { actorIn } from './combatants';
import { dataLabel } from '../data';
import { stepDetail, stepPrecision, stepPsych } from './rollSeam';

/** Forme d'un Test de Psychologie de rencontre résolu — conservée pour `describeEncounterPsych`
 *  (l'applier en construit une à partir de l'étape de cascade). */
export interface PendingEncounterPsych {
  heroId: string;
  kind: PsychType;
  sourceId: string;
  sourceName: string;
  indice: number;
  cible?: string;
  result: { roll: number; success: boolean; brise?: number; target?: number; sl?: number } | null;
  rerolled?: boolean;
}

/** PNJ « personnage » présents dans la scène, dérivés en Combatant (groups/causesPeur/Terreur/size).
 *  Un embusqueur caché n'inspire pas la Peur avant le combat. */
export function sceneFearSources(scene: Scene): Combatant[] {
  return (scene.entities ?? [])
    .filter((e) => e.kind === 'personnage' && !e.combat?.hiddenUntilCombat)
    .map(ficheDEntite);
}

/** DÉCLARATION COMMUNE d'une bande — telle qu'elle vit sur l'ÉTAPE (`CascadeStep.encounterPsych`). */
type PsychBandDecl = NonNullable<CascadeStep['encounterPsych']>;

/** Un Test DÛ par un héros, avant regroupement : le héros, la déclaration de règle qui l'appelle, et
 *  la présentation qui en découle (icône/libellé — communes à toute la bande). */
interface PsychDue { hero: Combatant; decl: PsychBandDecl; icon: string; label: PlayerText }

/** RANGÉE d'une bande : le Test de CE héros. Paramètres EN DONNÉES (`psychology.json` `test`) —
 *  compétence (défaut Calme) + difficulté (défaut Intermédiaire), mêmes données que le combat
 *  (`psychStepFor`). */
function psychRow(hero: Combatant, kind: PsychType): BatchParticipant {
  const td = findPsychologyById(kind)?.test;
  const skill = td?.skill ?? { id: 'calme' };
  const difficulty = td?.difficulty ?? 'intermediaire';
  const base = skillBaseValue(hero, skill.id, skill.spec);
  return {
    id: hero.id, interactive: true, result: null,
    label: refLabel('skills', skill), skillId: skill.id,
    base, difficulty, target: base + DIFFICULTY_MODIFIERS[difficulty],
  };
}

/**
 * BANDES de Psychologie de rencontre (#1117 L1) — la CLÉ d'une bande EST l'entrée de règle mise en
 * jeu : type psy + source + cible + Indice font UNE fenêtre, dont la déclaration vit sur l'ÉTAPE et
 * dont les héros appelés sont les RANGÉES (jets INDÉPENDANTS, `aggregate:'none'`). L'ordre des bandes
 * est celui de leur première rencontre en parcourant le groupe.
 *
 * DÉCLARATION au socle (`makeBandFactory`, #1262 V2) : la POSSESSION est posée par le mint
 * (`bandStep`) — plusieurs héros appelés → `groupOwner`, un seul → SON `actorId`. Sans elle, l'arbitre
 * (`modalArbiter`) rendait la fenêtre à l'HÔTE SEUL et le siège qui tient le héros ne voyait jamais la
 * rangée où se joue SON Test de Calme (classe #1268).
 */
const psychBands = makeBandFactory<PsychDue>({
  cle: ({ decl: d }) => `${d.kind}|${d.sourceId}|${d.cible ?? ''}|${d.indice}`,
  rangee: (due) => psychRow(due.hero, due.decl.kind),
  situation: ({ decl: d, icon, label }, { index }) => ({
    id: `psych-${d.kind}-${index}`, kind: 'encounterPsych', icon, label,
    encounterPsych: d,
    stake: combatStakeRef('encounterPsych', { entryId: d.kind, values: { indice: d.indice } }),
    // Les DEUX issues, dérivées des ops que l'applier appliquera (`psychBranchOps`) : la surface
    // les rend en chips codex-liées avant le jet, et le verdict est le MÊME bloc filtré (#1117).
    meta: { onSuccess: psychBranchFlow(d, true), onFail: psychBranchFlow(d, false) },
  }),
});

/** Ouvre la CASCADE des Tests de Psychologie de rencontre dus (hors combat) — une BANDE par entrée de
 *  règle, une RANGÉE par héros concerné. No-op en combat, si une cascade est déjà ouverte, ou sans
 *  scène/PNJ. Auto-appelé à l'entrée de scène. */
export function openEncounterPsych(get: Get, set: Set): void {
  if (get().battle) return;
  // BORNE DE RENCONTRE (LDB 21 l.9) : entrer dans une scène CLÔT la rencontre précédente — les afflictions
  // NÉES D'UN TEST expirent (l'affliction subie comme le marqueur de Test réussi), donc la même source
  // re-croisée plus tard se re-teste. Survivent : les Traits POSSÉDÉS, les poses AUTHORÉES, et la Peur
  // héritée d'une Terreur (mémoire « déjà affrontée », l.54). En combat, la borne équivalente est déjà
  // tenue par `carryOverState` (qui ne reporte pas `psychState`).
  const party = get().party.map((h) => ({ ...h }));
  if (party.some(endEncounterPsych)) set({ party });
  const s = get();
  if (s.pendingCascade || !s.scene) return;
  const npcs = sceneFearSources(s.scene);
  if (!npcs.length) return;
  // …PUIS le verdict « tant que vous défendez les êtres aimés » (l.75) sur ce qui a SURVÉCU à la borne
  // (pose authorée d'un Amour, Peur héritée) : le roster de la rencontre est le groupe + les PNJ présents.
  // Ordre imposé : après la borne, sinon le refresh ne verrait que ce qu'elle vient d'effacer.
  const refreshed = get().party.map((h) => ({ ...h }));
  if (refreshAllDefendedPsych([...refreshed, ...npcs])) set({ party: refreshed });
  const dues: PsychDue[] = [];
  for (const hero of get().party) {
    if (hero.dead) continue;
    const trig = encounterPsych(hero, npcs);
    if (!trig) continue;
    const src = npcs.find((n) => n.id === trig.sourceId);
    if (!src) throw new Error(`[psychologie] la source « ${trig.sourceId} » du Test de ${hero.label} n'est pas un PNJ présent`);
    const cl = estCibleType(trig.kind) ? cibleLabel(trig.kind) : null;
    dues.push({
      hero,
      decl: { kind: trig.kind, sourceId: trig.sourceId, sourceName: src.label, indice: trig.indice, cible: trig.cible },
      icon: cl?.icon ?? (trig.kind === 'terreur' ? 'creature/scream' : 'flag/fear'),
      label: cl
        ? (trig.cible ? stepPrecision(dataLabel(cl.label), dataLabel(trig.cible)) : dataLabel(cl.label))
        : stepDetail(stepPsych(trig.kind, trig.indice), dataLabel(src?.label, '?')),
    });
  }
  const steps = psychBands(dues);
  if (!steps.length) return;
  startCascade(get, set, { title: 'Sang-froid', icon: 'flag/fear', purpose: 'test', steps });
}

/** Ouvre la bande des Tests de Calme pour une source de PEUR/TERREUR SCÉNIQUE (Effet d'auteur
 *  `inflictPsychology` — apparition, présage, vision d'horreur), sur la MÊME machinerie que
 *  `openEncounterPsych` (applier `'encounterPsych'` partagé) — `sceneFearSources`/`encounterPsych` restent
 *  réservés aux PNJ de la scène (Peur/Terreur EXCLUES hors combat par design, cf. `engine/encounterPsych` :
 *  cet Effet est le seul déclencheur volontaire de l'auteur, pas une ré-activation automatique). No-op en
 *  combat ou si une cascade est déjà ouverte. */
export function openScriptedPsych(get: Get, set: Set, kind: 'peur' | 'terreur', indice: number, label: string, heroes: Combatant[]): void {
  const s = get();
  if (s.battle || s.pendingCascade) return;
  const sourceId = `scripted:${label}`;
  const decl: PsychBandDecl = { kind, sourceId, sourceName: label, indice };
  const dues: PsychDue[] = [];
  for (const hero of heroes) {
    if (hero.dead || isPsychImmune(hero)) continue;
    dues.push({
      hero, decl,
      icon: kind === 'terreur' ? 'creature/scream' : 'flag/fear',
      label: stepDetail(stepPsych(kind, indice), dataLabel(label)),
    });
  }
  const steps = psychBands(dues);
  if (!steps.length) return;
  startCascade(get, set, { title: 'Sang-froid', icon: 'flag/fear', purpose: 'test', steps });
}

/**
 * Conséquence d'un Test de Calme de rencontre POUR UNE RANGÉE : applique les `GameOp` de la branche
 * réalisée (`psychBranchOps`, dérivées de `psychology.json`) — les MÊMES ops que la surface annonce.
 * La résolution kind-agnostique (`rollTest(Calme)`) est faite par `FLOWS.cascadeBatch` ; ici on ne
 * décide que de l'ISSUE et du cumul. SOURCE UNIQUE de la résolution par héros — l'applier de bande
 * l'appelle pour CHACUNE de ses rangées. Issue de modale = `describeEncounterPsych` (les lignes
 * génériques d'`applyOps` sont couvertes par ce verdict rédigé). PUR vis-à-vis du store (mute le
 * héros, ne lit rien d'autre) : la rangée porte tout son contexte.
 */
function resolvePsychRow(hero: Combatant, ep: PsychBandDecl, r: CascadeRoll, immune: boolean): Consequence[] {
  // DÉTERMINATION (LDB 17 l.59) : immunité TEMPORAIRE (« Demeurer immunisé à Psychologie jusqu'à la fin
  // du prochain Round »). Pour un Test de rencontre ONE-SHOT (pas de Test étendu), « immune » ≈ « inerte »
  // = même état final qu'un succès (la source ne se re-déclenche pas) : on applique les ops de la branche
  // de RÉUSSITE — avec une issue distincte au journal. Ce qui protège le porteur pendant la durée est le
  // marqueur d'immunité lui-même, jamais un Indice à 0 : la Peur héritée d'une Terreur se pose à PLEIN
  // Indice ici aussi (LDB 21 l.56), sans quoi l'immunité du Round vaudrait une Peur vaincue à jamais.
  if (immune) {
    applyOps(hero, psychBranchOps(ep, { success: true, calmeDR: ep.indice }), { source: { kind: 'psychology', id: ep.kind } });
    return freeCons([t('cf.psychImmune', { name: hero.label })]);
  }
  const res = psychResolution(ep.kind); // mode + conséquences en DONNÉES (psychology.json)
  const brise = r.success ? 0 : failConditionAmount(res.failAmount, ep.indice, r.sl);
  // Le DR du jet est versé au contexte : la quantité d'État de l'échec (`valuePerSL{onFailure}` de la
  // branche) s'y résout — même arithmétique que `failConditionAmount`, une seule fois.
  applyOps(hero, psychBranchOps(ep, { success: r.success, calmeDR: r.success ? ep.indice : 0 }), { sl: r.sl, source: { kind: 'psychology', id: ep.kind } });
  const pe: PendingEncounterPsych = {
    heroId: hero.id, kind: ep.kind, sourceId: ep.sourceId, sourceName: ep.sourceName, indice: ep.indice, cible: ep.cible,
    result: { roll: r.roll, success: r.success, brise, target: r.target, sl: r.sl },
  };
  // Immunités croisées (LDB 21) : un effet psy dominant (Peur/Terreur) annule l'Animosité/Préjugé.
  return freeCons([describeEncounterPsych(pe, hero.label), ...supersededLines(hero, hero.label)]);
}

/** Applier de BANDE : la déclaration de règle est celle de l'ÉTAPE, la conséquence se joue RANGÉE PAR
 *  RANGÉE (résultat + Détermination du porteur), et chaque verdict reste SUR SA rangée (le portrait
 *  attribue) — jamais un agrégat (`aggregate:'none'`). */
registerCascadeApplier('encounterPsych', (get, set, step) => {
  const ep = step.encounterPsych;
  if (!ep || !step.participants) return;
  for (const part of step.participants) {
    const hero = actorIn(get(), part.id);
    if (!hero || !part.result) { part.outcome = []; continue; }
    const lines = resultLines(resolvePsychRow(hero, ep, part.result, !!part.immune));
    part.outcome = lines;
    for (const l of lines) get().log(l.text);
  }
  set({ party: [...get().party] });
  return { consequences: [] };
});
