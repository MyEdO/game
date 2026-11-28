/**
 * DÉBUT ET FIN DE TOUR : les effets de bord de tour authorés (`fireTurnStartTriggers`, `fireTurnEndTriggers`), le gate
 * d'action par Round (`resolveActGates`) et les crochets `onTurnStart` de la table `crochetsDeCombat` (`TABLES`, lue par
 * `combatHooks`), ordonnés par `order` : Rage (20), entrée en Frénésie de l'IA (30). Le golden
 * `turnStart.golden.hors-store.test.ts` fige l'ordre et les tirages des crochets. La psychologie de combat se joue aux
 * passes de Round (`openRoundStartPsych`, `openRoundEndCascade`, LDB 21 l.9, l.25).
 *
 * Les crochets tournent pour tout combattant que l'IA conduit (`runEnemyAI`, `aiDriven` : héros en Auto-combat
 * compris) ; chacun porte ses gardes de capacité (`hasRage`, `aiMaybeFrenzy`). `aiJetteraitUnSort` vient de combatFlow,
 * lu à l'appel seulement.
 */
import { nomDe } from '../../engine/nom';
import { rollSansPilote, surfaceOf, choiceStep, pushMono } from '../rollSeam';
import { battleRng } from '../battleRng';
import { ev } from '../combatLog';
import { isOutOfAction, combatTestPenalty, peutEntrerEnFrenesie } from '../../engine/conditions';
import { rawCombatTestBase, testValue, type TestDesigne } from '../../engine/skills';
import { traceLineOf, testTraceLabel } from '../../engine/traceLine';
import { CHAR_LABELS, CATEGORY_BY_SOURCE_KIND } from '../../engine/types';
import { garanti } from '../../lib/garanti';
import { reconcileAdvantageToPool, creditOpposingAdvantage, campSpend } from './advantagePool';
import { mountMovement } from '../mount';
import { materialiserLaBarre } from '../dispositionConsole';
import { objetDuNarratif } from '../monde/resolveursDuNarratif';
import { isFrenzied, PSY, resolveFrenzyEntry, sourceCombattant, vise } from '../../engine/psychology';
import { ciblePsy, libelleDeCible } from '../../engine/psych/ciblage';
import { combatStakeRef } from '../../data';
import { hasRage } from '../../engine/traits/dispatch';
import { fireTriggers, hasFoeInLoS } from '../triggeredEffects';
import { aiDriven } from '../netOwnership';
import { aiJetteraitUnSort } from '../combatFlow';
import { t } from '../../i18n';
import type { Combatant } from '../../engine/types';
import type { Get, Set as SetFn } from '../flowTypes';
import type { FragmentDeTables, PartDeTable } from '../tablesPosees';
import { ligneDeTexte } from '../../engine/journal';

/** La Cible de la Haine de Rage : le Groupe relatif des adversaires Engagés. LDB 85 l.282 ; Q12 B, #3045 */
const HAINE_DE_RAGE = ciblePsy.groupe('adversaires-engages');

/** Effets « début de tour » authorés du combattant qui DEVIENT actif (`onTurnStart`), joués par l'ouverture de tour
 *  unique (`ouvrirLeTour`, combatFlow). Inerte tant qu'aucune donnée ne porte un effet `onTurnStart`.
 *  Journalisé en `detail` (kind agnostique — l'IA comme le héros). No-op si hors d'action. Il matérialise d'abord la
 *  barre du combattant (`materialiserLaBarre`), avant tout rendu de son tour. */
export function fireTurnStartTriggers(get: Get, set: SetFn, c: Combatant): void {
  if (!isOutOfAction(c)) {
    const { barre } = materialiserLaBarre(c, objetDuNarratif(get().campaignNarratif));
    if (barre !== c.barre) c.barre = barre;
  }
  fireTurnEdgeTriggers(get, set, c, 'onTurnStart');
  // Mode « Avantage de groupe » : l'op `topUpAdvantage` (Redoutable) écrit sur la projection, la réserve du camp
  // se relève d'elle. AA 11 l.30-38
  reconcileAdvantageToPool(get, c);
}

/** Effets « fin de tour » authorés du combattant qui CESSE d'être actif (`onTurnEnd`) — appelé par
 *  `advanceTurn` au passage au combattant suivant. Même canal/garde que `onTurnStart`. */
export function fireTurnEndTriggers(get: Get, set: SetFn, c: Combatant | undefined): void {
  fireTurnEdgeTriggers(get, set, c, 'onTurnEnd');
}

/** Point UNIQUE de déclenchement des effets de bord de tour (début/fin) — kind agnostique, journalisé
 *  en `detail`, no-op hors d'action. Inerte tant qu'aucune donnée ne porte l'effet correspondant.
 *  `onTurnStart` seul fournit `onOpposingAdvantage` (Redoutable AA, `MDG 16 l.13`) : l'op `topUpAdvantage`
 *  du porteur y appelle `creditOpposingAdvantage`, self-gardée `groupAdvantage()`. */
function fireTurnEdgeTriggers(get: Get, set: SetFn, c: Combatant | undefined, trigger: 'onTurnStart' | 'onTurnEnd'): void {
  if (!c || isOutOfAction(c)) return;
  const battle = get().battle;
  if (!battle) return;
  const onOpposingAdvantage = trigger === 'onTurnStart' ? (n: number) => creditOpposingAdvantage(get, c, n) : undefined;
  for (const entree of fireTriggers(get, c, trigger, { rng: battleRng(), set, onOpposingAdvantage })) battle.log.push(ev('detail', entree, c.id));
}

// ============================================================================================
// GATE D'ACTION PAR ROUND (op `testDAgir`, Racine de mandragore, LDB 71 l.35), résolu au début du tour du
// porteur, cadence-aware :
//  - porteur SURFACÉ (`surfaceOf`) → étape de cascade `testDAgir` INFLUENÇABLE ; sur un échec, l'applier INSÈRE
//    l'étape de CHOIX `choixDAgir`, dont l'issue s'applique sur la battle COURANTE (le tour vient de commencer) ;
//  - personne ne le tient → jet inline ; sur un échec, l'Action est gardée (choix de l'IA), le Mouvement perdu,
//    replié par `ouvrirLeTour` dans le budget du tour.
// ============================================================================================

export interface ActGateOutcome { loseMovement: boolean; lines: string[] }

/** Résout les gates d'action du combattant qui DEVIENT actif. UN Test par Caractéristique gatée et par
 *  Round (LDB 71). */
export function resolveActGates(get: Get, set: SetFn, c: Combatant): ActGateOutcome {
  const out: ActGateOutcome = { loseMovement: false, lines: [] };
  if (isOutOfAction(c) || !get().battle) return out;
  const gates = (c.activeEffects ?? []).filter((e) => e.testDAgir);
  const chars = [...new Set(gates.map((e) => e.testDAgir!.characteristic))];
  for (const char of chars) {
    const gate = garanti(gates.find((e) => e.testDAgir!.characteristic === char), char, 'gate d’action');
    const label = gate.label;
    if (surfaceOf(get, c.id)) {
      // ENJEU (#1117) : le gabarit dit la mécanique du gate ; le RENVOI descend à l'ENTITÉ qui l'exige
      // (`ActiveEffect.source`, estampillée génériquement par `applyOps`) — la Racine de mandragore
      // ouvre SA fiche d'objet, jamais une fiche de règle générique. La catégorie vient de la table
      // TOTALE `CATEGORY_BY_SOURCE_KIND` : aucun `if` par nature de source ici.
      const src = gate?.source;
      pushMono(set, {
        id: `testDAgir-${c.id}-${char}`, kind: 'testDAgir', icon: 'objet/consommable', rollLabel: CHAR_LABELS[char],
        actor: c,
        ligne: { test: { characteristic: char }, combat: { kind: 'test' } },
        difficulty: 'intermediaire',
        label: t('turn.testDAgir', { label }),
        stake: combatStakeRef('agir-malgre-effet', src ? { entryId: src.id, entryCategory: CATEGORY_BY_SOURCE_KIND[src.kind] } : {}),
      });
      continue;
    }
    const teste = { characteristic: char } as const;
    const res = rollSansPilote(get, c, teste, rawCombatTestBase(c, teste), 'intermediaire', battleRng(), combatTestPenalty(c));
    out.lines.push(traceLineOf({ who: nomDe(c), label: testTraceLabel(`${CHAR_LABELS[char]} (${label})`, 'intermediaire'), ...res }));
    if (!res.success) { out.loseMovement = true; out.lines.push(t('turn.testDAgirGardeLAction', { name: nomDe(c) })); }
  }
  return out;
}

// ============================================================================================
// Crochets de début de tour de l'IA. Ils journalisent eux-mêmes (`ev`), sans le `sink` du ctx.
// ============================================================================================

const FORCE_MENTALE: TestDesigne = { characteristic: 'force-mentale' };

/** L'IA tente d'entrer en Frénésie au début de son tour : combattant capable (`peutEntrerEnFrenesie`), sans immunité
 *  psychologique, un adversaire vivant en Ligne de Vue. La sortie est un effet `onTurnStart` en donnée
 *  (`psychology.json`). LDB 21 l.31, l.35 */
export function aiMaybeFrenzy(get: Get, set: SetFn, enemy: Combatant): void {
  if (!aiDriven(get(), enemy) || enemy.psychImmune || isOutOfAction(enemy) || !peutEntrerEnFrenesie(enemy)) return;
  if (!hasFoeInLoS(get, enemy)) return;
  // L'IA diffère ce choix tant que sa meilleure action est de préparer un sort (`aiJetteraitUnSort`, sans RNG).
  // LDB 21 l.31
  if (aiJetteraitUnSort(get, enemy.id)) return;
  if (resolveFrenzyEntry({ porteur: enemy.id, teste: FORCE_MENTALE }, testValue(enemy, FORCE_MENTALE), battleRng()).success) {
    (enemy.psychState ??= []).push({ type: PSY.frenesie });
    set({ battle: { ...get().battle!, log: [...get().battle!.log, ev('frenesie', t('turn.frenzyEnter', { name: nomDe(enemy) }), enemy.id)] } });
  }
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = ['testDAgir', 'choixDAgir'] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    // Étape `testDAgir` (porteur surfacé) : succès → rien à restreindre ; échec → étape de CHOIX insérée.
    testDAgir: (_get, _set, step, hero) => {
      if (!hero || !step.result) return;
      if (step.result.success) return { applique: { lignes: [ligneDeTexte(t('turn.testDAgirReussi', { name: nomDe(hero) }))], faits: [] } };
      const choix = choiceStep({
        id: `choixDAgir-${hero.id}`, kind: 'choixDAgir', actorId: hero.id, icon: 'objet/consommable',
        label: t('turn.choixDAgir'),
        options: [
          { key: 'action', label: t('turn.testDAgirOptionAction') },
          { key: 'mouvement', label: t('turn.testDAgirOptionMouvement') },
        ],
        defaultChoice: 'action',
      });
      return {
        // LDB 71
        applique: { lignes: [ligneDeTexte(t('turn.testDAgirRate', { name: nomDe(hero) }))], faits: [] },
        ...(choix ? { insert: [choix] } : {}),
      };
    },
    // Étape `choixDAgir` : applique l'issue sur la battle COURANTE (le tour du porteur vient de démarrer).
    choixDAgir: (get, set, step, hero) => {
      if (!hero) return;
      const battle = get().battle;
      if (!battle || battle.order[battle.turn] !== hero.id) return; // plus son tour → sans objet
      if (step.chosen === 'mouvement') {
        set({ battle: { ...battle, acted: true } });
        return { applique: { lignes: [ligneDeTexte(t('op.actionPerdue', { name: nomDe(hero) }))], faits: [] } };
      }
      set({ battle: { ...battle, movementUsed: mountMovement(battle, hero) } });
      return { applique: { lignes: [ligneDeTexte(t('op.mouvementPerdu', { name: nomDe(hero) }))], faits: [] } };
    },
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
  crochetsDeCombat: [
    {
      // Rage : LDB 85 l.282 ; Q12 B, #3045.
      id: 'rage',
      phase: 'onTurnStart',
      order: 20,
      run: ({ get, set, battle, self }) => {
        const enemy = self;
        if (!enemy || !hasRage(enemy.traits) || isFrenzied(enemy)) return;
        const adv = enemy.advantage ?? 0;
        if (adv >= 3) {
          campSpend(get, enemy, adv); // dépense TOUS ses Avantages (LDB 85 l.282) — réserve du camp en mode groupe (AA 11 l.30-38)
          (enemy.psychState ??= []).push({ type: PSY.frenesie });
          battle.log.push(ev('frenesie', t('turn.rageEnter', { name: nomDe(enemy) }), enemy.id));
          set({ battle: { ...battle } });
          return;
        }
        if (adv < 1) return;
        if ((enemy.psychState ?? []).some((p) => p.type === PSY.haine && p.active === true && p.cible === HAINE_DE_RAGE)) return;
        if (!battle.combatants.some((f) => !isOutOfAction(f) && vise(HAINE_DE_RAGE, sourceCombattant(f), 'appartenance', enemy))) return;
        campSpend(get, enemy, adv); // LDB 85 l.282 ; AA 11 l.30-38
        (enemy.psychState ??= []).push({ type: PSY.haine, cible: HAINE_DE_RAGE, active: true, lastTestRound: battle.round });
        battle.log.push(ev('peur', t('turn.rageHate', { name: nomDe(enemy), groupe: libelleDeCible(HAINE_DE_RAGE) }), enemy.id));
        set({ battle: { ...battle } });
      },
    },
    {
      id: 'ai-maybe-frenzy', // LDB 21 l.31
      phase: 'onTurnStart',
      order: 30,
      run: ({ get, set, self }) => { if (self) aiMaybeFrenzy(get, set, self); },
    },
  ],
} satisfies FragmentDeTables;
