/**
 * BANDES de la NUIT (#1117 L3) — fabrique UNIQUE des fenêtres de jets de nuit.
 *
 * « Une situation = une fenêtre » : les Tests de nuit qui répondent à la MÊME entrée de règle le MÊME
 * jour ne sont plus N étapes MONO qui défilent, mais UNE bande dont les héros appelés sont les RANGÉES
 * (`BatchParticipant`, jets INDÉPENDANTS `aggregate:'none'`) — calque exact des bandes de Psychologie
 * (L1/L2, `encounterPsychFlow`/`combatFlow`).
 *
 * CLÉ d'une bande = (entrée de RÈGLE, JOUR). Le jour EN FAIT PARTIE : `runDailyUpkeep` boucle sur les
 * journées franchies (`upkeep.ts`), donc un saut de 3 jours émet 3 Tests de Dessoûlage pour le MÊME
 * héros — trois rangées de même id dans une seule bande seraient INJOIGNABLES (les surfaces de rangée
 * keyent par id nu : `rollFlowFactory`, `CascadeModal`). Filet de dernier recours au même endroit :
 * une rangée dont l'id est DÉJÀ pris ouvre une bande de plus (deux Convalescences échéant le même jour
 * chez le même héros), jamais un doublon.
 *
 * EAGER partout comme avant, SAUF deux endroits où l'état lu doit être POSTÉRIEUR :
 *  - abri → Exposition (l'abri décide du nombre de jets, `restFlow`) ;
 *  - vague N → vague N+1 d'Exposition (`nextExposureWave`) : l'escalade cumulative (LDB 18 l.330/334)
 *    compte les échecs déjà subis, et un délestage de Possession lourde (l.332) en ANNULE un — une
 *    vague construite avant la résolution des délestages compterait des échecs annulés.
 */
import type { CascadeStep, BatchParticipant, CascadeRoll } from '../noyau/pendings';
import type { EchecSansJet } from '../engine/tests';
import type { Combatant } from '../engine/types';
import type { Get, Set } from './flowTypes';
import { isNightTestKind } from '../engine/types';
import { registerCascadeApplier } from '../noyau/cascade';
import { actorIn } from '../noyau/monde/combatants';
import { resultLines, bandStep, bandRowOfStep, bandCommonMeta, makeBandFactory, refusePorte, type Consequence, type BandSpec, type BuiltCascadeStep } from '../noyau/rollSeam';
import { sealskinDR, type ExposureKind } from '../engine/exposure';

/** Discriminant d'ENTRÉE DE RÈGLE d'une étape de nuit, lu dans son `meta` : la maladie et son symptôme
 *  (`diseaseTick`/`diseaseGangrene`/`diseasePersist`/`contagion` sont des entrées DIFFÉRENTES), le volet
 *  froid/chaleur de l'Exposition (LDB 18 l.330 vs l.334) et sa VAGUE. */
function bandEntry(step: CascadeStep): string {
  const m = step.meta ?? {};
  return [m.diseaseName, m.symptomId, m.kind, m.wave].map((v) => (v === undefined ? '' : String(v))).join('|');
}

/** CLÉ de bande d'une étape de nuit : (`kind`, entrée de règle, JOUR). */
export function nightBandKey(step: CascadeStep): string {
  return `${step.kind}|${bandEntry(step)}|${step.meta?.day ?? ''}`;
}

/** Une étape MONO peut-elle rejoindre une bande ? Test de nuit à JET porté par un acteur — un CHOIX
 *  (`exposure-heat-drop`) reste MONO (`stepReady` exige `result` sur les rangées d'une bande, et le
 *  choix se pose au niveau ÉTAPE : `setCascadeChoice`), et une étape déjà en bande passe telle quelle. */
function bandable(step: CascadeStep): boolean {
  return isNightTestKind(step.kind) && !step.participants && !step.options
    && typeof step.actorId === 'string' && step.target != null;
}

/**
 * FABRIQUE : regroupe des étapes MONO de nuit en BANDES, dans l'ordre de leur PREMIÈRE émission. Les
 * étapes hors périmètre (kind hors vocabulaire de nuit, choix, bande déjà formée) traversent INTACTES,
 * à leur place. Ajouter un `kind` de nuit ne coûte rien ici : la clé se dérive de l'étape.
 *
 * DÉCLARATION au socle (`makeBandFactory`, #1262 V2) : la Map keyée, le dédoublement de clé
 * (`bandStepId` — deux jets de MÊME entrée le MÊME jour chez le MÊME héros, deux Convalescences
 * échéant ensemble, ouvrent une bande de PLUS), la place réservée et le mint (`bandStep`, qui pose la
 * POSSESSION : plusieurs dormeurs → `groupOwner`, un seul → SON `actorId`) sont ceux du socle. Le
 * `meta` COMMUN (l'entrée de règle mise en jeu, que porte la clé d'enjeu de l'étape) remonte par
 * `bandCommonMeta` ; ce qui DIVERGE d'un héros à l'autre (Bonus d'Endurance de la Gangrène, siège
 * d'une Convalescence) reste sur la rangée.
 *
 * ENTRE et SORT en étapes MINTÉES (#1262 V2) : ce qu'elle regroupe repasse par `bandStep`, ce qu'elle
 * laisse passer garde la marque de son propre mint — la fabrique n'est donc pas une porte dérobée par
 * où une étape manuscrite rejoindrait une séquence.
 */
export const nightBands = makeBandFactory<BuiltCascadeStep>({
  passe: (step) => (bandable(step) ? null : step),
  cle: nightBandKey,
  rangee: bandRowOfStep,
  situation: (step, { rang }) => ({
    // L'id de bande porte les DEUX discriminants de sa clé, dans des ESPACES DE NOMS SÉPARÉS (#1277) :
    //  - le JOUR (préfixé `j`), car deux insertions issues du MÊME `step.id` à des jours différents —
    //    la gueule de bois de deux Dessoûlages, `dessoulageHangover-<héros>` — viennent de DEUX appels
    //    distincts à la fabrique, qui ne peut pas les dédoublonner entre eux ;
    //  - le RANG de dédoublement, car deux bandes séparées sous la MÊME clé (deux Convalescences du
    //    même héros) sortiraient sinon avec le même id.
    // Le préfixe est ce qui les sépare : sans lui, un rang `2` et un jour `2` se confondent (une étape
    // de nuit peut n'avoir aucun jour — la file de fin de combat en porte). Le seul lookup-par-id de
    // prod (`meta.nextWaveOf`) et les coordonnées de rangée (`nightRowId`) viseraient la mauvaise
    // fenêtre. Ids RUNTIME-ONLY : aucune sauvegarde ne les rejoue (elle restaure la séquence telle
    // quelle).
    id: step.meta?.day !== undefined ? `bande-${step.id}-j${step.meta.day}${rang > 1 ? `#${rang}` : ''}` : `bande-${step.id}-${rang}`,
    kind: step.kind,
    ...(step.label !== undefined ? { label: step.label } : {}),
    ...(step.icon ? { icon: step.icon } : {}),
    ...(step.stake ? { stake: step.stake } : {}),
    ...(step.menace ? { menace: step.menace } : {}),
  }),
  meta: (steps) => bandCommonMeta(steps.map((s) => s.meta)),
});

/** Conséquence d'UNE RANGÉE de bande de nuit — calque de `CascadeApplier`, joué par porteur : `row`
 *  porte le jet ET la charge utile propre au héros (`row.meta`), la bande porte l'entrée de règle. */
export type NightRowApplier = (
  get: Get,
  set: Set,
  band: CascadeStep,
  row: BatchParticipant,
  hero: Combatant,
  ctx: { steps: CascadeStep[]; index: number },
) => { consequences?: Consequence[]; insert?: readonly BuiltCascadeStep[] } | void;

/** DÉNOUEMENT de BANDE : décide de la liste FINALE d'étapes insérées, à partir de ce que les rangées
 *  ont demandé. Un `kind` qui n'en fournit pas fait passer les insertions par la fabrique (défaut).
 *  Seule l'Exposition en a besoin : ses délestages restent MONO et sa vague suivante ne se construit
 *  qu'APRÈS eux. */
export type NightBandApplier = (
  get: Get,
  set: Set,
  band: CascadeStep,
  ctx: { steps: CascadeStep[]; index: number },
  rowInserts: readonly BuiltCascadeStep[],
) => BuiltCascadeStep[];

/**
 * Enregistre la conséquence d'un `kind` de nuit SOUS FORME DE BANDE : la boucle par rangée (verdict sur
 * SA rangée, portrait attributeur) est écrite ICI une fois pour toutes, et les étapes INSÉRÉES par les
 * rangées repassent par la fabrique — c'est ainsi que le second Test du dessoûlage (LDB 09 l.485) fait
 * UNE bande de gueule de bois et non N étapes. Une étape sans rangées RENONCE (fail-closed) : plus
 * aucun `kind` de nuit ne s'applique en MONO depuis L3.
 */
export function registerNightBandApplier(kind: string, rowFn: NightRowApplier, bandFn?: NightBandApplier): void {
  registerCascadeApplier(kind, (get, set, step, _hero, ctx) => {
    if (!step.participants) return;
    const insert: BuiltCascadeStep[] = [];
    for (const row of step.participants) {
      const hero = actorIn(get(), row.id);
      if (!hero || !row.result) { row.outcome = []; continue; }
      const out = rowFn(get, set, step, row, hero, ctx);
      const lines = out?.consequences ? resultLines(out.consequences) : [];
      row.outcome = lines;
      for (const l of lines) get().log(l.text);
      if (out?.insert?.length) insert.push(...out.insert);
    }
    set({ party: [...get().party] });
    return { consequences: [], insert: bandFn ? bandFn(get, set, step, ctx, insert) : nightBands(insert) };
  });
}

/** DÉCLARATION d'une bande DÉJÀ MONTÉE, relue pour la RE-FABRIQUER (scission, vague suivante) : les
 *  champs de la déclaration, jamais ceux du jeu (`result`, `committed`, `outcome`, `chosen` — une
 *  bande re-fabriquée est une bande NEUVE). C'est ce que le mint (`bandStep`) attend, et c'est lui qui
 *  re-DÉRIVE la possession sur les rangées données. */
function bandSpecOf(band: CascadeStep): BandSpec {
  return {
    id: String(band.id), kind: band.kind,
    ...(band.label !== undefined ? { label: band.label } : {}),
    ...(band.icon ? { icon: band.icon } : {}),
    ...(band.aggregate ? { aggregate: band.aggregate } : {}),
    ...(band.stake ? { stake: band.stake } : {}),
    ...(band.menace ? { menace: band.menace } : {}),
    ...(band.combatPsych ? { combatPsych: band.combatPsych } : {}),
    ...(band.meta ? { meta: band.meta } : {}),
  };
}

/**
 * SCINDE une bande en deux selon un prédicat sur le PORTEUR de chaque rangée — la fenêtre reste UNE
 * par entrée de règle, mais ses rangées peuvent relever de DEUX pilotes (fin de combat : un héros
 * piloté-humain-manuel joue son jet, un témoin est résolu d'office). Chaque moitié est une bande
 * ENTIÈRE, jamais une rangée `interactive:false` glissée dans la bande interactive : le pilote
 * interactif n'auto-roule pas les témoins (`rollBatchParticipants` n'est appelé que par
 * `resolveRemainingCascade`/`runCascadeImmediate`) et la conséquence d'un témoin y serait perdue.
 *
 * Chaque moitié est RE-MINTÉE (`bandStep`, #1262 murage) au lieu d'être recopiée : la possession se
 * re-dérive de SES rangées — une moitié à un seul porteur le NOMME (`actorId`) au lieu de garder le
 * `groupOwner` de la bande d'origine.
 *
 * L'étampe de TRACE (`meta.autoResolved`, #1281) ne se pose PAS ici : mesuré sur `src/state`, les
 * rangées de la moitié `others` naissent TOUTES non roulées (33/33) — c'est `runCascadeImmediate` qui
 * les jette, et c'est donc lui qui les étampe (`cascade.rollBatchParticipants`).
 */
export function splitBandRows(band: CascadeStep, keep: (rowId: string) => boolean): { kept?: BuiltCascadeStep; others?: BuiltCascadeStep } {
  const rows = band.participants ?? [];
  const spec = bandSpecOf(band);
  const kept = bandStep(spec, rows.filter((r) => keep(r.id)));
  const others = bandStep({ ...spec, id: `${spec.id}#auto` }, rows.filter((r) => !keep(r.id)));
  return { ...(kept ? { kept } : {}), ...(others ? { others } : {}) };
}

/** Clé d'une RANGÉE dans la cascade (bande + porteur) — coordonnée que porte le délestage qui ANNULE
 *  son échec (`meta.cancelsRowId`) : l'adjacence `steps[idx+1]` d'avant les bandes ne peut plus dire
 *  QUELLE rangée un choix tranche. */
export function nightRowId(band: CascadeStep, row: BatchParticipant): string {
  return `${band.id}:${row.id}`;
}

/** Les `kind` de BANDE d'EXPOSITION (LDB 18 l.326-334) — MÊME règle, MÊME applier, DEUX routes qui la
 *  posent : la nuit de camp / l'effet de scène (`exposure`) et l'entretien de MER (`sea-exposition`,
 *  seul couvert par les ORDRES d'une traversée, cf. `voyageCadence.KINDS_SOUS_ORDRES`). L'escalade
 *  cumulative les compte ENSEMBLE : un héros ne recommence pas à zéro en changeant de route. */
export const EXPOSURE_BAND_KINDS: readonly string[] = ['exposure', 'sea-exposition'];

/** Échec GENUINE d'Exposition : la peau de phoque (MDG 14 l.277) retient AU FROID un échec de justesse
 *  (+1 DR) — il ne compte alors ni comme conséquence ni dans l'escalade. */
export function genuineExposureFail(hero: Combatant, kind: ExposureKind, r: CascadeRoll | EchecSansJet | null | undefined): boolean {
  if (!r || r.success) return false;
  const skin = kind === 'froid' ? sealskinDR(hero) : 0;
  return !(skin > 0 && r.sl + skin >= 1);
}

/** Échecs d'Exposition DÉJÀ subis par un héros pour CE volet (LDB 18 l.330/334, escalade cumulative),
 *  hors ceux ANNULÉS par un délestage de Possession lourde (l.332) : parcourt les bandes d'Exposition
 *  DÉJÀ jouées et les choix `exposure-heat-drop` qui les tranchent (`meta.cancelsRowId`). */
export function exposurePriorFails(steps: CascadeStep[], hero: Combatant, kind: ExposureKind): number {
  const cancelled = new Set<string>();
  for (const s of steps) {
    if (s.kind !== 'exposure-heat-drop' || s.chosen !== 'jeter') continue;
    const id = s.meta?.cancelsRowId;
    if (typeof id === 'string') cancelled.add(id);
  }
  let n = 0;
  for (const s of steps) {
    if (!EXPOSURE_BAND_KINDS.includes(s.kind) || !s.participants) continue;
    if (((s.meta?.kind as ExposureKind) ?? 'froid') !== kind) continue;
    for (const row of s.participants) {
      if (row.id !== hero.id || cancelled.has(nightRowId(s, row))) continue;
      if (genuineExposureFail(hero, kind, row.result)) n++;
    }
  }
  return n;
}

/**
 * VAGUE SUIVANTE d'Exposition (LDB 18 l.326-334) — matérialisée seulement quand la précédente est
 * TRANCHÉE (délestages compris) : les rangées sont celles de la vague courante (même ligne de jet, les
 * campeurs ne changent pas), remises à zéro et RE-DOTÉES de leur escalade (`meta.priorFails`) lue sur
 * les étapes déjà jouées. `[]` quand la dernière vague vient d'être jouée. SOURCE UNIQUE des TROIS
 * producteurs d'Exposition (nuit de repos, effet de scène `exposureNight`, entretien de mer).
 *
 * La vague est une bande NEUVE, donc RE-MINTÉE (`bandStep`, #1262 murage) : ni le jeu de la vague
 * précédente (`committed`/`result`/`outcome`) ni sa possession ne se recopient — les deux se
 * re-dérivent de ses rangées.
 */
export function nextExposureWave(get: Get, band: CascadeStep, steps: CascadeStep[]): BuiltCascadeStep[] {
  const wave = Number(band.meta?.wave ?? 0) + 1;
  if (wave >= Number(band.meta?.waves ?? 1)) return [];
  const kind = (band.meta?.kind as ExposureKind) ?? 'froid';
  const rows = (band.participants ?? []).map((row) => {
    const hero = actorIn(get(), row.id);
    const meta = { ...row.meta, priorFails: hero ? exposurePriorFails(steps, hero, kind) : 0 };
    return { ...row, result: null, outcome: undefined, rerolled: undefined, forced: undefined, immune: undefined, fixed: undefined, meta };
  });
  const suivante = bandStep({
    ...bandSpecOf(band),
    id: `${String(band.id).split('#w')[0]}#w${wave}`,
    meta: { ...band.meta, wave },
  }, rows);
  return suivante ? [suivante] : [];
}

/** Bande d'Exposition d'une PREMIÈRE vague, à partir des étapes MONO d'un producteur : chaque rangée
 *  entre à escalade NULLE (aucun Test d'Exposition n'a encore été subi dans cette séquence) et la bande
 *  porte le nombre TOTAL de vagues, que `nextExposureWave` déroule. `[]` sans campeur ni vague.
 *
 *  La bande sort RE-MINTÉE avec son `meta` de vague (#1262 murage). Une étape que la fabrique n'a PAS
 *  bandée n'est pas un jet d'Exposition jouable (ni cible, ni porteur, ni `kind` de nuit) : elle est
 *  REFUSÉE, comme toute déclaration qu'un mint ne peut pas monter — jamais glissée telle quelle dans
 *  une vague dont l'applier de bande ne saurait rien faire. */
export function exposureWaveBand(monoSteps: readonly BuiltCascadeStep[], kind: ExposureKind, waves: number): BuiltCascadeStep[] {
  if (!monoSteps.length || waves <= 0) return [];
  const seeded = monoSteps.map((s) => ({ ...s, meta: { ...s.meta, kind, priorFails: 0 } }));
  return nightBands(seeded).flatMap((b) => {
    if (!b.participants?.length) {
      refusePorte(`Exposition « ${b.id} » (${b.kind}) : étape non bandable — ni rangée, ni vague à dérouler. Étape écartée.`);
      return [];
    }
    const band = bandStep({ ...bandSpecOf(b), meta: { ...b.meta, kind, wave: 0, waves } }, b.participants);
    return band ? [band] : [];
  });
}
