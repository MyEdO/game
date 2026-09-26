/**
 * Corruption & mutations — flux store (LDB 19, moteur pur : engine/corruption).
 *
 *  - `gainCorruption` : ajoute des Points, puis applique le SEUIL (l.80) — au-delà
 *    de BFM+BE (+ niveau d'Âme pure, LDB 10), Test de Résistance Intermédiaire en MODALE
 *    différée (pendingCorruption kind 'seuil' — Lancer/Chance/Pacte ; repli auto-résolu +
 *    révélation pour les PNJ seuls) ; échec → MUTATION (−BFM Points, d100
 *    corps/esprit par espèce, tirage sur le Tableau physique/mentale) ; puis LIMITES (l.87)
 *    → damné (hors-jeu définitif). Le slot est UNIQUE : les seuils dus EN RAFALE (une bande de fin
 *    de combat qui fait déborder deux héros) prennent rang dans `corruptionQueue`, vidée un à un
 *    par `releaseCorruptionSlot` — jamais un Test roulé en silence faute de fenêtre libre.
 *  - « Je te renie ! » (LDB 17 l.67) : un HÉROS avec de la Résilience peut REFUSER la mutation
 *    (1 Point de Résilience ; « comme vous ne mutez pas, vous ne perdez aucun Point de
 *    Corruption ») → choix par modale (`pendingRenounce`), la mutation est suspendue.
 *  - Sombre Pacte (l.17) : +1 Point volontaire pour RELANCER un Test — branché dans les
 *    modales de jet (ChanceButtons).
 *  - Effets d'éditeur : `corruptionExposure` (Test différé par modale) ; gain direct
 *    via l'Effet générique `ops` (op `corruption` + champ `align` optionnel).
 */
import type { GameState } from './store';
import type { Get, Set } from './flowTypes';
import type { Combatant } from '../engine/types';
import { battleRng } from './battleRng';
import { zoneCovers } from './zones';
import { bonus, effectiveChar, refreshWounds } from '../engine/characteristics';
import { recomputeLoadout } from '../engine/items';
import {
  corruptionThresholdExceeded,
  corruptionGain,
  mutationNatureRowsFor,
  mutationLimitExceeded,
  attachMutation,
  type ChaosAlign,
  type Mutation,
} from '../engine/corruption';
import {
  mutationTableIds, mutationAt, mutationOfRow, mutationSubTableFor, mutationTablePlayerLabel, mutationTableRows,
} from '../data/mutations';
import { species, mutationBodyMaxForSpecies, combatStakeRef } from '../data';
import { findTableEntry } from '../engine/tables';
import { registerCascadeApplier, registerTableStepFamily, pushStep, type TableStepDef } from './cascade';
import { memoParVersion } from '../data/versionDataset';
import { touchActors } from './combatOrParty';
import { actorIn } from './combatants';
import type { PendingCascade, PendingCorruption, PendingMutationStep } from './pendings';
import { rule } from '../engine/policy';
import { rollTest } from '../engine/tests';
import { testValue } from '../engine/skills';
import { pushReveal } from './combatFlow';
import { checkPartyWiped } from './partyWipe';
import { journaliser } from './combatLog';
import { tenuParUnHumain } from './netOwnership';
import { followsCharacterRules } from '../engine/relations';
import { resultLine, freeCons, tableStep, type BuiltCascadeStep } from './rollSeam';
import { t } from '../i18n';
import { stepDetail } from './rollSeam';
import { TESTS_DE_CORRUPTION, type TestDeCorruption } from '../data/schemas/grammaire/valeurs';

/** SEULE couture entre la référence portée par l'op/l'effet et le slot `pendingCorruption`. PURE.
 *  Absente = indéterminée, le joueur tranche dans la modale (défaut affiché : Résistance,
 *  `LDB 19 l.23-75`). PRÉSENTE, elle est déjà bornée à `TESTS_DE_CORRUPTION` par les deux portes de
 *  document (`refTestDeCorruption`) : la fonction est TOTALE, elle ne rabote rien. */
export function testDeCorruption(skill?: { id: string }): TestDeCorruption {
  if (skill == null) return TESTS_DE_CORRUPTION[0];
  const trouve = TESTS_DE_CORRUPTION.find((x) => x === skill.id);
  if (!trouve) throw new Error(`testDeCorruption : « ${skill.id} » hors de TESTS_DE_CORRUPTION (LDB 19 l.23-75) — la porte de document aurait dû le refuser.`);
  return trouve;
}

/**
 * LA PORTE du slot `pendingCorruption` (#1282) — SOURCE UNIQUE de sa pose, quel que soit le
 * producteur : Test de SEUIL (`gainCorruption`), Test d'EXPOSITION d'un effet de scène
 * (`combatEffects.corruptionExposure`) ou d'une Activité d'interlude (`interludeFlow`).
 *
 * Le slot est UNIQUE, et deux fenêtres de Corruption peuvent se réclamer d'affilée (une bande de fin
 * de combat fait déborder N héros ; une Exposition s'ouvre pendant qu'un seuil est affiché) : la
 * seconde PREND SON RANG dans `corruptionQueue` (LDB 19 l.70) au lieu d'ÉCRASER la fenêtre en place —
 * ce qui supprimerait un Test dû. `releaseCorruptionSlot` reste la couture de sortie unique.
 *
 * Un « Je te renie ! » en attente (`pendingRenounce`) tient le slot tout autant : sa décision est la
 * suite d'un Test déjà joué.
 */
export function poseCorruptionPending(get: Get, set: Set, pending: PendingCorruption): void {
  if (get().pendingCorruption || get().pendingRenounce) set({ corruptionQueue: [...get().corruptionQueue, pending] });
  else set({ pendingCorruption: pending });
}

/**
 * Ajoute `n` Points de Corruption à `hero`, applique seuil → mutation → limites.
 * Mute le héros EN PLACE (l'appelant pousse le patch de re-rendu) et renvoie les
 * lignes de journal. La révélation (dés du Test/de la table) est poussée en étape d'AFFICHAGE de
 * la séquence en cours (`pushReveal` — jet SUBI, montré puis acquitté).
 */
export function gainCorruption(get: Get, set: Set, hero: Combatant, n: number, align?: ChaosAlign): string[] {
  const rng = battleRng();
  const lines: string[] = [];
  // Protection de Phâ (LDB 48 l.393) : un occupant d'une Zone `noCorruption` ne gagne aucune Corruption.
  if (n > 0 && hero.pos && (get().battle?.zones ?? []).some((z) => z.noCorruption && zoneCovers(z, hero.pos!))) {
    return [t('cor.phaWard', { name: hero.label })];
  }
  hero.corruption = (hero.corruption ?? 0) + n;
  lines.push(t('cor.gain', { name: hero.label, n, s: n > 1 ? 's' : '', total: hero.corruption }));

  // Seuil « Corrompu » (l.80) : à CHAQUE gain au-delà de BFM+BE (+ Âme pure), Test de Résistance
  // Intermédiaire (+0) ; succès = contenu « pour cette fois », échec = mutation.
  if (!corruptionThresholdExceeded(hero)) return lines;
  // « Un jet = une modale » : dès qu'un siège humain TIENT le porteur (`tenuParUnHumain`, #1426 — la
  // SURFACE, pas l'affordance locale : le héros d'un AUTRE siège tient sa propre fenêtre), le Test du
  // seuil est un VRAI jet différé — modale de Corruption (kind 'seuil', cycle Lancer→Chance→Pacte),
  // résolu dans `resolveCorruptionPending` (succès = contenu ; échec = « Je te renie ! »/mutation —
  // les DEUX fenêtres partent de là).
  if (tenuParUnHumain(get(), hero.id)) {
    lines.push(t('cor.threshold', { name: hero.label }));
    // `menace: 'mutation'` : l'échec du Test de seuil fait MUTER (l.82) → c'est le Test qui « résiste
    // à la Mutation » du talent Résistance (Menace), LDB 10 l.1016-1020.
    const seuil: PendingCorruption = { heroId: hero.id, kind: 'seuil', skill: 'resistance', skillLocked: true, align, menace: 'mutation' };
    poseCorruptionPending(get, set, seuil);
    return lines;
  }
  // REPLI AUTO-RÉSOLU — atteint SEULEMENT quand AUCUN siège humain ne tient le porteur (le `return`
  // ci-dessus a déjà emporté tous les autres) : l'automate ne tient aucune modale, ni de seuil, ni de
  // renoncement. Le Test est donc jeté ici et la mutation appliquée d'office.
  const tst = rollTest(testValue(hero, 'resistance'), 'intermediaire', rng);
  if (tst.success) {
    lines.push(resultLine(freeCons([t('cor.contained', { name: hero.label })])));
    return lines;
  }
  lines.push(...applyMutation(get, set, hero, { roll: tst.roll, target: tst.target }, align));
  return lines;
}

// ---------------------------------------------------------------------------
// Les TROIS tirages de la mutation en étapes à TABLE (#942 L5) — LDB 19 l.73-83 :
// nature (corps ou esprit) → Tableau de Corruption → sous-table éventuelle.
// ---------------------------------------------------------------------------

/** Préfixe des tables d'étape « corps ou esprit » — une par SEUIL d100 d'espèce (la donnée porte les
 *  seuils, `SpeciesData.mutationBodyMax` : Elfe 0, Nain 5, Halfling 10, Ogre 10, Humain 50 par défaut). */
const NATURE_TABLE_PREFIX = 'mutation-nature-';

/** Table « corps ou esprit » de l'ESPÈCE d'un personnage (LDB 19 l.76-81). */
export function mutationNatureTableId(species: string | undefined): string {
  return `${NATURE_TABLE_PREFIX}${mutationBodyMaxForSpecies(species)}`;
}

// Une table par SEUIL présent en donnée (+ le défaut 50) : les lignes viennent du moteur
// (`mutationNatureRowsFor`, PAR RÉFÉRENCE — mémoïsées par seuil), et l'id de la ligne tirée EST la
// nature ('physique'/'mentale'). Le moteur expose le MÊME lookup sur les MÊMES lignes
// (`mutationKindFor`), qui sert d'oracle d'équivalence au test — jamais un second chemin de décision.
// FAMILLE (#1692) : le jeu de seuils est celui de `species` À CET INSTANT — une espèce dont le seuil
// est édité au Codex a sa table, là où un jeu figé à l'import faisait lever `lireEnTable`.
const tablesDeNature = memoParVersion('species', () => {
  const tables = new Map<string, TableStepDef>();
  for (const max of new Set([50, ...species.map((s) => s.mutationBodyMax ?? 50)])) {
    const rows = mutationNatureRowsFor(max);
    tables.set(`${NATURE_TABLE_PREFIX}${max}`, {
      label: t('cor.natureTable'),
      die: 100,
      rows,
      lines: (die) => [findTableEntry(rows, die).label],
      // La ligne tirée EST l'id du Tableau de Corruption qui suivra : sa fiche Codex est le foyer de
      // l'enjeu une fois le dé tombé (`stakeAtTableRow`).
      entryCategory: 'mutationTables',
    });
  }
  return tables;
});

registerTableStepFamily(tablesDeNature);

// Une entrée par table RÉELLE de `mutationTables.json` (LDB physique/mentale, tables EDOC par
// Puissance, sous-tables « Tête bestiale ») : fourchettes et ids de mutation PROJETÉS depuis la
// donnée (`mutationTableRows`, par référence) ; le lookup mécanique reste `mutationAt`. Le `label`
// est celui rendu au JOUEUR (rangée de tirage) → `mutationTablePlayerLabel`, sans marque de livre
// (`docs/charte-ui.md`) ; le libellé d'authoring reste intact en donnée.
// FAMILLE (#1692), même patron que les tables de nature ci-dessus : le jeu de Tableaux est celui de
// `mutationTables` À CET INSTANT — une table ajoutée au Codex est tirable, une table retirée quitte
// le registre, là où une boucle jouée à l'import figeait les deux à vie.
const tablesDeMutation = memoParVersion(['mutationTables', 'mutations'], () => {
  const tables = new Map<string, TableStepDef>();
  for (const id of mutationTableIds()) {
    const rows = mutationTableRows(id);
    tables.set(id, {
      label: mutationTablePlayerLabel(id),
      die: 100,
      rows,
      lines: (die) => [mutationAt(id, die).label],
      entryCategory: 'mutations', // la ligne tirée EST la mutation : sa fiche est le foyer de l'enjeu
    });
  }
  return tables;
});

registerTableStepFamily(tablesDeMutation);

/** Table de Corruption d'une nature de mutation : l'alignement de la SOURCE (posé par l'éditeur de
 *  niveau) PRIME ; sinon la règle globale `corruption-tables-edoc` ('ldb' → Tableaux du Livre de base ;
 *  sinon table EDOC alignée par Puissance). SOURCE UNIQUE nature+alignement → id de table. */
export function mutationTableIdFor(kind: 'physique' | 'mentale', align?: ChaosAlign): string {
  const mode = String(rule('corruption-tables-edoc'));
  const a = align ?? (mode === 'ldb' ? null : mode);
  return a ? `edoc-${kind === 'physique' ? 'phys' : 'mental'}-${a}` : kind;
}

/** La séquence des tirages s'ouvre dans la cascade de COMBAT quand un combat tourne (append à celle en
 *  cours), en séquence autonome sinon — doctrine du slot (#942 L1) : jamais d'écrasement. */
const mutationPurpose = (get: Get): PendingCascade['purpose'] => (get().battle ? 'combat' : 'test');

function natureStep(hero: Combatant, align: ChaosAlign | undefined, index: number): BuiltCascadeStep | undefined {
  return tableStep({
    id: `mutation-nature-${hero.id}-${index}`,
    kind: 'mutationNature', actorId: hero.id, icon: 'nav/mutation',
    label: t('step.dissolution'),
    table: { tableId: mutationNatureTableId(hero.species), spec: { n: 1, sides: 100 } },
    mutation: { heroId: hero.id, align },
    stake: combatStakeRef('mutationNature'),
  });
}

function mutationTableStep(hero: Combatant, tableId: string, ctx: PendingMutationStep): BuiltCascadeStep | undefined {
  return tableStep({
    id: `mutation-table-${tableId}-${hero.id}`,
    kind: 'mutationTable', actorId: hero.id, icon: 'nav/mutation',
    label: stepDetail(t('step.mutation'), mutationTablePlayerLabel(tableId)),
    table: { tableId, spec: { n: 1, sides: 100 } },
    mutation: { ...ctx, tableId },
    stake: combatStakeRef('mutationTable'),
  });
}

/** ÉTAPE 1 : la LIGNE tirée (`result.id`, l'autorité — jamais un re-lookup sur le dé) donne la nature,
 *  qui désigne la table de Corruption → l'étape 2 est INSÉRÉE juste après. */
registerCascadeApplier('mutationNature', (_get, _set, step, hero) => {
  const ctx = step.mutation;
  const rolled = step.table?.result;
  if (!ctx || !rolled || !hero) return;
  const kind = rolled.id as 'physique' | 'mentale';
  const suivante = mutationTableStep(hero, mutationTableIdFor(kind, ctx.align), { ...ctx, kind, natureRoll: rolled.roll });
  return suivante ? { insert: [suivante] } : undefined;
});

/** ÉTAPES 2 et N : la LIGNE tirée (`result.id`) EST la mutation. Ligne à SOUS-TABLE → une étape de plus
 *  est INSÉRÉE (descente pilotée niveau par niveau) ; sinon la mutation est appliquée. */
registerCascadeApplier('mutationTable', (get, set, step, hero) => {
  const ctx = step.mutation;
  const rolled = step.table?.result;
  if (!ctx?.tableId || !rolled || !hero) return;
  const m = mutationOfRow(rolled.id, rolled.roll);
  const sub = mutationSubTableFor(ctx.tableId, m);
  if (sub) {
    const suivante = mutationTableStep(hero, sub, ctx);
    return suivante ? { insert: [suivante] } : undefined;
  }
  const lines = finishMutation(get, set, hero, m, ctx.kind ?? 'physique', ctx.natureRoll ?? 0);
  set({ ...touchActors(get()) });
  return { consequences: freeCons(lines) };
});

/** Applique la MUTATION (l.82-91) : −BFM Points, d100 corps/esprit par espèce, tirage sur le
 *  Tableau de Corruption physique/mentale, effets dérivés, puis LIMITES (l.87) → damné. */
export function applyMutation(get: Get, set: Set, hero: Combatant, _test?: { roll: number; target: number }, align?: ChaosAlign): string[] {
  // LDB 19 l.76, dans CET ordre : « D'abord, vous perdez autant de Points de Corruption que la valeur
  // de votre Bonus de Force Mentale […] Ensuite, effectuez un lancer de pourcentage ». Le débit est
  // donc À L'ENTRÉE, avant la première étape : pendant la séquence des dés, un nouveau gain relit
  // `corruptionThresholdExceeded` sur la Corruption DÉJÀ débitée — sinon il rouvrirait un Test de seuil
  // (et une 2ᵉ mutation) que la séquence en cours exclut.
  hero.corruption = Math.max(0, (hero.corruption ?? 0) - bonus(effectiveChar(hero, 'force-mentale')));
  // Les dés de la mutation sont des étapes à TABLE CHAÎNÉES, poussées NON RÉSOLUES (#1426) : chaque
  // ligne tirée insère la suivante (appliers `mutationNature`/`mutationTable`), et AUCUNE mutation
  // n'est attachée avant que le DERNIER dé ne tombe (parité avec l'offre de Déviation). Ce qu'il
  // advient de chaque étape appartient au socle (`cascade.poserLeCurseur`) : fenêtre pour le siège
  // qui tient la victime, résolution d'office si nul siège ne la tient — l'option « Dés fixés » n'y
  // ajoute que la POSE. Les dés tombent au RANG de leur étape, jamais tous à l'appel.
  pushStep(set, (index) => natureStep(hero, align, index), mutationPurpose(get));
  return [];
}

/** DÉNOUEMENT de la dernière étape à table (applier `mutationTable`) : attache de la
 *  mutation + effets dérivés, journal & révélation, puis LIMITES (l.87) → damné. Les Points sont
 *  déjà débités par `applyMutation` (l.76, « D'abord… »). */
function finishMutation(
  get: Get, set: Set, hero: Combatant, m: Mutation, kind: 'physique' | 'mentale', kindRoll: number,
): string[] {
  const rng = battleRng();
  const lines: string[] = [];
  attachMutation(hero, m, rng);
  // Effets dérivés immédiats : PA naturels (loadout) + Blessures max si F/E/FM permanents.
  if (hero.items?.length) recomputeLoadout(hero);
  refreshWounds(hero);
  // Le dé de table (`m.roll`) est DÉJÀ affiché par la rangée `TableRollLine` (dice: m.roll, révélation
  // ci-dessous) — pas de re-print (#295 Lot 4). Le jet de Résistance du seuil est lui aussi
  // déjà affiché par SA propre rangée (Corruption/Renounce) en amont — jamais réimprimé ici (#295 Lot 5).
  lines.push(resultLine(freeCons([
    t('cor.mutates', { name: hero.label, label: m.label, kind: kind === 'physique' ? t('cor.kindPhysique') : t('cor.kindMentale'), roll: kindRoll, what: kind === 'physique' ? t('cor.body') : t('cor.mind') }),
  ])));
  if (m.note) lines.push(t('cor.mutationNote', { label: m.label, note: m.note }));

  // Limites de Corruption (l.87) : plus de mutations physiques que BE ou mentales que
  // BFM → l'âme appartient aux Dieux Sombres. Hors-jeu définitif (traité comme mort).
  if (mutationLimitExceeded(hero)) {
    hero.damned = true;
    hero.dead = true;
    lines.push(t('cor.damned', { name: hero.label }));
  }
  if (tenuParUnHumain(get(), hero.id))
    pushReveal(set, { kind: 'mutation', title: t('cor.revealTitle', { label: m.label }), dice: m.roll, lines: [...lines], subjectId: hero.id, severity: 'grave' });
  checkPartyWiped(get, set); // damnation du dernier héros hors combat → défaite (no-op en combat)
  return lines;
}

/** Résolution du choix « Je te renie ! » (LDB 17 l.67) : `renounce` → −1 Résilience, pas de
 *  mutation NI de perte de Points de Corruption ; sinon la mutation s'applique. */
export function resolveRenounce(get: Get, set: Set, renounce: boolean): void {
  const pr = get().pendingRenounce;
  if (!pr) return;
  set({ pendingRenounce: null });
  const hero = corruptionTarget(get(), pr.heroId);
  if (!hero) { releaseCorruptionSlot(get, set); return; }
  const lines: string[] = [];
  if (renounce && (hero.resilience ?? 0) > 0) {
    hero.resilience = (hero.resilience ?? 0) - 1;
    lines.push(t('cor.renounced', { name: hero.label }));
    pushReveal(set, { kind: 'mutation', title: t('cor.renounceTitle'), lines: [...lines], subjectId: hero.id, severity: 'minor' });
  } else {
    lines.push(...applyMutation(get, set, hero, { roll: pr.testRoll, target: pr.testTarget }, pr.align));
  }
  journaliser(get, set, lines, 'info', { actorId: hero.id });
  releaseCorruptionSlot(get, set);
}

/**
 * REND le slot `pendingCorruption` au Test de SEUIL SUIVANT en attente (`corruptionQueue`, LDB 19 l.70).
 * Appelé à CHAQUE sortie des deux résolutions qui libèrent une fenêtre de Corruption
 * (`resolveCorruptionPending`, `resolveRenounce`) — jamais ailleurs : c'est la seule couture où la file
 * avance. Ne prend le slot que s'il est LIBRE et qu'aucun « Je te renie ! » n'attend une décision (deux
 * fenêtres de Corruption ouvertes en même temps se recouvriraient).
 */
export function releaseCorruptionSlot(get: Get, set: Set): void {
  const q = get().corruptionQueue;
  if (!q.length || get().pendingCorruption || get().pendingRenounce) return;
  set({ pendingCorruption: q[0], corruptionQueue: q.slice(1) });
}

/**
 * DÉNOUEMENT d'une fenêtre de Corruption ACQUITTÉE (`pendingCorruption` déjà retiré du slot par
 * l'appelant) — Test d'EXPOSITION (Points selon niveau + DR, puis seuil) OU Test du SEUIL
 * (kind 'seuil', LDB 19 l.70) : succès = Corruption contenue « pour cette fois » ; échec =
 * « Je te renie ! » (Résilience) ou mutation. Vit ICI, avec `gainCorruption`/`applyMutation` dont il
 * est la suite — le store ne fait que déléguer et rendre le slot au suivant.
 */
export function resolveCorruptionPending(get: Get, set: Set, pc: PendingCorruption): void {
  const hero = actorIn(get(), pc.heroId);
  if (!hero || pc.roll == null) return;
  if (pc.kind === 'seuil') {
    // Le jet (roll/target) est DÉJÀ affiché par la rangée de la modale de Corruption — pas de
    // re-print au journal (#295 Lot 4).
    if (pc.success) {
      get().log(resultLine(freeCons([t('cor.contained', { name: hero.label })])));
    } else if ((hero.resilience ?? 0) > 0) {
      get().log(resultLine(freeCons([t('cor.thresholdFail', { name: hero.label })])));
      set({ pendingRenounce: { heroId: hero.id, testRoll: pc.roll, testTarget: pc.target ?? 0, align: pc.align } });
    } else {
      for (const l of applyMutation(get, set, hero, { roll: pc.roll, target: pc.target ?? 0 }, pc.align)) get().log(l);
    }
    set({ ...touchActors(get()) });
    return;
  }
  const gain = corruptionGain(pc.level ?? 'mineure', !!pc.success, pc.sl ?? 0);
  if (gain <= 0) {
    // Le jet est DÉJÀ affiché par la rangée de la modale de Corruption — pas de re-print (#295 Lot 5).
    get().log(resultLine(freeCons([t('cor.repelled', { name: hero.label })])));
    return;
  }
  for (const l of gainCorruption(get, set, hero, gain, pc.align)) get().log(l);
  set({ ...touchActors(get()) });
}

/** Cible d'un effet de Corruption : héros désigné, sinon le premier vivant. #152 (suite #143) : le pool
 *  en combat est celui des PERSONNAGES (`followsCharacterRules`, PAS un proxy `kind==='hero'`) — un PNJ
 *  humain hostile MODÉLISÉ (statbloc d'éditeur ou bestiaire rétro-flagué) y est éligible comme un héros. */
export function corruptionTarget(s: GameState, heroId?: string): Combatant | undefined {
  const pool = s.battle?.combatants.filter((c) => followsCharacterRules(c)) ?? s.party;
  return (heroId ? pool.find((h) => h.id === heroId) : undefined) ?? pool.find((h) => !h.dead && !h.outOfRencontre);
}
