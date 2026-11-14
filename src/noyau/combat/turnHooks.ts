/**
 * Hooks de DÉBUT DE TOUR ENNEMI (`turnStart`), déclarés dans la table `crochetsDeCombat` (`TABLES`,
 * lue par `combatHooks`) : la séquence de début de tour de l'IA vit ICI, chaque étape étant un hook ordonné par `order`. N'importe RIEN de combatFlow → pas de cycle (les
 * fonctions déplacées ne dépendent que des modules feuilles `engine/*`, `combatLog`, `combatGeometry`,
 * `lineOfSight`, `battleRng`, `cascade`, `rollSeam` — ce dernier porte la PORTE d'ouverture de jet
 * (`surfaceOf`, `pushMono`, `choiceStep`, #1262).
 *
 * Ordre encodé par `order` : Rage (20) → tentative de Frénésie IA (30). La psychologie de combat se joue aux
 * passes de Round (`openRoundStartPsych`, `openRoundEndCascade`, LDB 21 l.9, l.25), pas ici. Le golden
 * `turnStart.golden.hors-store.test.ts` fige l'ordre + les tirages RNG byte-pour-byte.
 *
 * Ces hooks ne tournent que pour l'ENNEMI actif (`runEnemyAI` est enemy-only) ; les fonctions ont en
 * plus leurs propres gardes `kind`/capacité internes (no-op pour un héros), comportement conservé.
 */
import { nomDe } from '../../engine/nom';
import { freeCons, rollSansPilote, surfaceOf, choiceStep, pushMono } from '../rollSeam';
import { battleRng } from '../battleRng';
import { ev } from '../combatLog';
import { isOutOfAction, combatTestPenalty, peutEntrerEnFrenesie } from '../../engine/conditions';
import { rawCombatTestBase, testValue } from '../../engine/skills';
import { traceLineOf, testTraceLabel } from '../../engine/traceLine';
import { CHAR_LABELS, CATEGORY_BY_SOURCE_KIND } from '../../engine/types';
import { garanti } from '../../lib/garanti';
import { reconcileAdvantageToPool, creditOpposingAdvantage, campSpend } from './advantagePool';
import { mountMovement } from '../mount';
import { isFrenzied, resolveFrenzyEntry, sourceCombattant, vise } from '../../engine/psychology';
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

/** La Cible de la Haine de Rage : le Groupe relatif des adversaires Engagés. LDB 85 l.282 ; Q12 B, #3045 */
const HAINE_DE_RAGE = ciblePsy.groupe('adversaires-engages');

/** Effets « début de tour » authorés du combattant qui DEVIENT actif (`onTurnStart`) — point unique
 *  appelé par `advanceTurn` (tour suivant du Round) ET `lancerLeRound` (1ᵉʳ combattant du Round),
 *  pour ne pas dupliquer le déclenchement. Inerte tant qu'aucune donnée ne porte un effet `onTurnStart`.
 *  Journalisé en `detail` (kind agnostique — l'IA comme le héros). No-op si hors d'action. */
export function fireTurnStartTriggers(get: Get, set: SetFn, c: Combatant | undefined): void {
  fireTurnEdgeTriggers(get, set, c, 'onTurnStart');
  // Mode « Avantage de groupe » : un octroi d'Avantage par OP au début du tour (Redoutable, ZI : complète
  // jusqu'à l'Indice — op `topUpAdvantage`) écrit sur la projection ; on relève la réserve du camp (adverse
  // pour une créature) en conséquence. No-op hors mode groupe.
  if (c) reconcileAdvantageToPool(get, c);
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
  for (const line of fireTriggers(get, c, trigger, { rng: battleRng(), set, onOpposingAdvantage })) battle.log.push(ev('detail', line, c.id));
}

// ============================================================================================
// GATE D'ACTION PAR ROUND (op `testDAgir` — Racine de mandragore, LDB 71 l.35 : « Les utilisateurs
// doivent réussir un Test de Force Mentale à chaque Round pour effectuer une Action ou un Mouvement
// (un au choix) »). Résolu au DÉBUT du tour du porteur, cadence-aware :
//  - porteur SURFACÉ (`surfaceOf` : un siège humain QUELCONQUE le tient, cadence manuelle) → étape de
//    cascade `testDAgir` INFLUENÇABLE ; sur un échec, l'applier INSÈRE une étape
//    de CHOIX `choixDAgir` (garder l'Action ou le Mouvement) dont l'issue est appliquée directement
//    sur la battle COURANTE (le tour vient de commencer) ;
//  - IA / cadence auto → jet inline ; échec = l'Action est GARDÉE (défaut rationnel), le Mouvement est
//    perdu — FOLDÉ par l'appelant (advanceTurn/lancerLeRound) dans le budget du tour.
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
    const res = rollSansPilote(get, c, rawCombatTestBase(c, { characteristic: char }), 'intermediaire', battleRng(), combatTestPenalty(c));
    out.lines.push(traceLineOf({ who: nomDe(c), label: testTraceLabel(`${CHAR_LABELS[char]} (${label})`, 'intermediaire'), ...res }));
    if (!res.success) { out.loseMovement = true; out.lines.push(t('turn.testDAgirGardeLAction', { name: c.label })); }
  }
  return out;
}

// ============================================================================================
// Fonctions de cycle de tour ennemi. Elles journalisent ELLES-MÊMES (kinds `frenzy`/`fear` via `ev`) —
// le `sink` du ctx n'est pas requis ici (contrairement à roundHooks).
// ============================================================================================

/** L'IA tente d'entrer en Frénésie au début de son tour (LDB 21 l.31) : combattant capable, pas déjà
 *  frénétique ni immunisé à la Psychologie, avec un adversaire vivant en Ligne de Vue → Test de Force
 *  Mentale ; sur un succès, il entre en Frénésie (état psy `frenesie` posé en `psychState`). La SORTIE est
 *  un effet déclenché `onTurnStart` en DONNÉES (`psychology.json`), jamais un hook `end-frenzy` par-nom. */
export function aiMaybeFrenzy(get: Get, set: SetFn, enemy: Combatant): void {
  if (!aiDriven(get(), enemy) || enemy.psychImmune || isOutOfAction(enemy) || !peutEntrerEnFrenesie(enemy)) return;
  if (!hasFoeInLoS(get, enemy)) return; // adversaire vivant en Ligne de Vue (primitive partagée, sens acteur→foe)
  // RAW : l'entrée en Frénésie est un CHOIX (psychologie.md l.170) → l'IA la DIFFÈRE tant que sa meilleure
  // action est de PRÉPARER un sort (buff/invocation/dégâts). L'Unicité les retire un à un ; quand il ne reste
  // que charger, la Frénésie passe au tour suivant. Peek déterministe, sans RNG (avant le test FM) → aucune
  // perturbation du flux `battleRng` quand on diffère, golden RNG préservé sinon.
  if (aiJetteraitUnSort(get, enemy.id)) return;
  if (resolveFrenzyEntry(testValue(enemy, { characteristic: 'force-mentale' }), battleRng()).success) {
    (enemy.psychState ??= []).push({ type: 'frenesie' });
    set({ battle: { ...get().battle!, log: [...get().battle!.log, ev('frenesie', t('turn.frenzyEnter', { name: enemy.label }), enemy.id)] } });
  }
}

// ============================================================================================
// Hooks `turnStart` : la séquence RAW de début de tour ennemi, migrée ISO-COMPORTEMENT depuis la tête
// de `runEnemyAI`. Les `order` encodent la dépendance d'ordre.
// Chaque `run()` appelle au RUNTIME la fonction/le bloc correspondant (pas de souci de cycle à l'import).
// ============================================================================================

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = ['testDAgir', 'choixDAgir'] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    // Étape `testDAgir` (héros manuel) : succès → rien à restreindre ; échec → étape de CHOIX insérée.
    testDAgir: (_get, _set, step, hero) => {
      if (!hero || !step.result) return;
      if (step.result.success) return { consequences: freeCons([t('turn.testDAgirReussi', { name: hero.label })]) };
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
        consequences: freeCons([t('turn.testDAgirRate', { name: hero.label })]),
        ...(choix ? { insert: [choix] } : {}),
      };
    },
    // Étape `choixDAgir` : applique l'issue sur la battle COURANTE (le tour du héros vient de démarrer).
    choixDAgir: (get, set, step, hero) => {
      if (!hero) return;
      const battle = get().battle;
      if (!battle || battle.order[battle.turn] !== hero.id) return; // plus son tour → sans objet
      if (step.chosen === 'mouvement') {
        set({ battle: { ...battle, acted: true } });
        return { consequences: freeCons([t('op.actionPerdue', { name: hero.label })]) };
      }
      set({ battle: { ...battle, movementUsed: mountMovement(battle, hero) } });
      return { consequences: freeCons([t('op.mouvementPerdu', { name: hero.label })]) };
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
          (enemy.psychState ??= []).push({ type: 'frenesie' });
          battle.log.push(ev('frenesie', t('turn.rageEnter', { name: enemy.label }), enemy.id));
          set({ battle: { ...battle } });
          return;
        }
        if (adv < 1) return;
        if ((enemy.psychState ?? []).some((p) => p.type === 'haine' && p.active === true && p.cible === HAINE_DE_RAGE)) return;
        if (!battle.combatants.some((f) => !isOutOfAction(f) && vise(HAINE_DE_RAGE, sourceCombattant(f), 'appartenance', enemy))) return;
        campSpend(get, enemy, adv); // LDB 85 l.282 ; AA 11 l.30-38
        (enemy.psychState ??= []).push({ type: 'haine', cible: HAINE_DE_RAGE, active: true, lastTestRound: battle.round });
        battle.log.push(ev('peur', t('turn.rageHate', { name: enemy.label, groupe: libelleDeCible(HAINE_DE_RAGE) }), enemy.id));
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
