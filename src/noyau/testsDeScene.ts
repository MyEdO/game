/** Tests de scène hors combat : Test simple, Test étendu (LDB 12), enfoncer une porte (EDO Appendice 2). */
import { registerCloture, reprendreLaSuite, runFlow, cloturer } from './combatEffects';
import { fireOwnTestFailed } from './triggeredEffects';
import { battleRng } from './battleRng';
import { touchActors } from './combatOrParty';
import type { BuiltCascadeStep } from './stepBrand';
import { pousseSi, hostStep, idDansLaSequence, openSequence, resultLine } from './rollSeam';
import { extendedTestStep } from '../engine/tests';
import { rule } from '../engine/policy';
import { t } from '../i18n';
import { dissipateSpell } from '../engine/dispel';
import { extendedTestOutcomeAppliers, curseurPose } from './cascade';
import { FLOWS, meetsRequiredSL } from './rollFlowSpecs';
import { craftTestDRAdjust, hasQuality, isUnbreakable } from '../engine/qualities/dispatch';
import { bus, EVT } from './bus';
import { inBattleId } from './monde/combatants';
import { campGain } from './combat/advantagePool';
import { markActed } from './combatFlow';
import { reprendreTestSubi } from './combat/triggeredTest';
import { EMPTY_FLOW } from '../engine/flowCore';
import type { Cloture } from './pendings';
import type { Get, Set } from './flowTypes';
import type { ActionsDuNoyau } from './actionsDuNoyau';

/** SEAM `onOwnTestFailed` d'un Test RATÉ — verbe de CLÔTURE (#1508) : il APPLIQUE des ops (Crampes
 *  abdominales → Sonné/À Terre par paliers de DR, MSRC 16 l.152), donc il attend le dé comme le reste. */
registerCloture('testRateDeLActeur', (get, set, c) => {
  const cascadeSet = !get().pendingCascade && !get().pendingTest ? set : undefined;
  const fired = fireOwnTestFailed(get, c.actorId, { sl: c.sl, rng: battleRng(), set: cascadeSet });
  if (fired.length) fired.forEach((l) => get().log(l));
  set({ ...touchActors(get()) });
});

export function creerActionsDesTestsDeScene(get: Get, set: Set) {
  return {
    startExtendedTest: (opts) => {
      set({ pendingExtendedTest: { ...opts, total: 0, rounds: [{ id: 'round-1', interactive: true, result: null }] } });
      // Par la PORTE (#1262 V2 L4). Le mint vérifie que `pendingExtendedTest` est posé — il vient de
      // l'être, ligne au-dessus.
      const steps: BuiltCascadeStep[] = [];
      pousseSi(steps, hostStep(get, { id: idDansLaSequence(get, 'ext-jet', 'test'), kind: 'extendedJet', jet: 'extended', actorId: opts.actorId }));
      if (steps.length) openSequence(get, set, { title: opts.label, icon: 'ui/key', purpose: 'test', steps });
    },
    extendedTestNext: () => {
      const p = get().pendingExtendedTest;
      if (!p) return;
      const cur = p.rounds[p.rounds.length - 1];
      if (!cur?.result) return; // le Round courant doit avoir été lancé
      // Cumul LDB 12 mutualisé (`extendedTestStep`) : un Round réussi ajoute son DR, un raté le retire
      // (planché à 0) ; règle opt. l.208 « DR 0 = ±1 min » via `test-extended-min-sl`.
      const { total, done } = extendedTestStep(p.total, cur.result, p.targetDR, !!rule('test-extended-min-sl'));
      // BORNE d'essais (Commerce d'opportunité, MDG 15 l.274-286 : « ≤ 3 tentatives ») — cible non
      // atteinte à la DERNIÈRE tentative permise = une ISSUE (résolue par `outcome`), pas une boucle infinie.
      const exhausted = !done && p.maxAttempts != null && p.rounds.length >= p.maxAttempts;
      if (done || exhausted) {
        set({ pendingExtendedTest: null, pendingCascade: null }); // ferme la cascade-hôte aussi
        get().log(t('store.extendedDone', { label: p.label, issue: t(done ? 'store.extendedOk' : 'store.extendedKo'), total, target: p.targetDR }));
        if (done && p.dispel) {
          // DISSIPATION réussie (LDB 46 l.160) : retire tous les effets du Sort de tous ses porteurs.
          const b = get().battle;
          const n = b ? dissipateSpell(b.combatants, p.dispel.spellId, p.dispel.casterId) : 0;
          set(touchActors(get()));
          get().log(t('cs.dispelDone', { spell: p.dispel.label, extra: n > 1 ? t('cs.fragDispelFreed', { n }) : '' }));
        }
        if (done && p.flag) set({ flags: { ...get().flags, [p.flag]: true } }); // gate la suite (porte/serrure d'éditeur)
        // Issue de DOMAINE en donnée (kind-agnostique) : appliée qu'elle ait réussi ou buté sur `maxAttempts`.
        if (p.outcome) {
          const applier = extendedTestOutcomeAppliers[p.outcome.kind];
          const out = applier?.(get, set, p, total, done);
          const line = out?.consequences ? resultLine(out.consequences) : '';
          if (line) get().log(line);
        }
        reprendreLaSuite(get, set, p.suite);
        return;
      }
      // Round suivant : la cascade-hôte (1 étape) reste, seul `pendingExtendedTest` gagne un Round (re-rendu).
      set({ pendingExtendedTest: { ...p, total, rounds: [...p.rounds, { id: `round-${p.rounds.length + 1}`, interactive: true, result: null }] } });
    },
    // Renoncer CLÔT le Test (sans réussite) : la suite du Flow qui l'a ouvert se joue, comme après un Test raté.
    extendedTestCancel: () => {
      const suite = get().pendingExtendedTest?.suite;
      set({ pendingExtendedTest: null, pendingCascade: null });
      reprendreLaSuite(get, set, suite);
    },
    // Enfoncer une porte à plusieurs (EDO Appendice 2) : flux multi PARALLÈLE (objet BE/B).
    startForceDoor: (opts) => {
      set({ pendingForceDoor: { label: opts.label, doorBE: opts.doorBE, doorB: opts.doorB, doorBmax: opts.doorB, flag: opts.flag,
        ...(opts.suite ? { suite: opts.suite } : {}),
        participants: opts.heroIds.map((id) => ({ id, interactive: true, result: null })) } });
      // « Une situation = une modale » : l'enfoncement est hôté dans la cascade (rendu par CascadeModal
      // via l'étape `jet:'forceDoor'`). `pendingForceDoor` reste le porteur des données/participants ;
      // ses résolveurs ferment LES DEUX quand la porte cède. `groupOwner` → l'arbitre coop met l'owner à
      // '*' (action de GROUPE : chacun pilote ses héros), faute d'acteur unique sur l'étape.
      // #1262 V2 L4 : par la PORTE (`hostStep`, forme de GROUPE) — l'étape n'est plus un littéral, et le
      // mint vérifie que `pendingForceDoor` est posé (il vient de l'être).
      const steps: BuiltCascadeStep[] = [];
      pousseSi(steps, hostStep(get, { id: 'forceDoor', kind: 'forceDoorStep', jet: 'forceDoor', groupOwner: true }));
      if (steps.length) openSequence(get, set, { title: t('store.forceDoorTitle'), icon: 'action/force', purpose: 'combat', steps });
    },
    forceDoorConfirm: () => {
      const p = get().pendingForceDoor;
      if (!p) return;
      // Dégâts du Round = somme des coups (chacun déjà réduit par le BE à la résolution). Objets : pas de min 1.
      const dmg = p.participants.reduce((s, x) => s + (x.result?.damage ?? 0), 0);
      const doorB = p.doorB - dmg;
      if (doorB <= 0) {
        set({ pendingForceDoor: null, pendingCascade: null }); // la porte cède → ferme la situation (data + cascade hôte)
        get().log(t('store.doorYields', { label: p.label, n: dmg, s: dmg > 1 ? 's' : '' }));
        if (p.flag) set({ flags: { ...get().flags, [p.flag]: true } }); // ouverture en jeu (porte d'éditeur)
        reprendreLaSuite(get, set, p.suite);
      } else {
        // La porte tient : un nouveau Round s'ouvre (chacun re-frappe — jets remis à zéro).
        set({ pendingForceDoor: { ...p, doorB, participants: p.participants.map((x) => ({ ...x, result: null, rerolled: false, forced: false })) } });
        get().log(t('store.doorHolds', { label: p.label, n: dmg, s: dmg > 1 ? 's' : '', left: doorB, sB: doorB > 1 ? 's' : '' }));
      }
    },
    // Renoncer CLÔT l'enfoncement (la porte tient) : la suite du Flow qui l'a ouvert se joue.
    forceDoorCancel: () => {
      const suite = get().pendingForceDoor?.suite;
      set({ pendingForceDoor: null, pendingCascade: null });
      reprendreLaSuite(get, set, suite);
    },
    // Résilience « Je ne faillirai pas ! » (LDB 17 l.68) sur un Test de scène (hors combat) — cycle
    // UNIFIÉ par la fabrique rollFlow (les variantes combat attack/defense/cast vivent dans combatSlice).

    /** Choix du lanceur (avant le jet) : re-cible le Test sur le candidat `id` du groupe. */
    testSetActor: (id) => {
      const pt = get().pendingTest;
      if (!pt || pt.roll != null) return; // seulement AVANT le jet
      const cand = pt.candidates?.find((c) => c.id === id);
      if (!cand) return;
      // La cascade-hôte porte l'`actorId` de l'étape (gating coop « chacun ses jets ») : re-cibler le
      // lanceur le met à jour aussi, pour que la modale reste chez le bon propriétaire.
      // Le PORTEUR de l'étape change : le curseur se re-pose par la porte du pilote (`curseurPose`), qui
      // re-juge la surface du nouveau porteur — jamais un `cursor:` écrit à la main. Les DEUX porteurs
      // (Test et étape) se publient dans le MÊME `set` : entre deux `set`, un abonné rendrait un état où
      // la modale suit un porteur et l'étape l'autre.
      const pc = get().pendingCascade;
      const etape = pc ? curseurPose(get, { ...pc, participants: pc.participants.map((st, k) => (k === pc.cursor ? { ...st, actorId: cand.id } : st)) }, pc.cursor) : null;
      set({
        pendingTest: { ...pt, actorId: cand.id, actorName: cand.label, skillValue: cand.value, target: cand.target, clamped: cand.clamped, base: cand.base, mods: cand.mods, psychMod: cand.psychMod, psychDetail: cand.psychDetail, itemUid: cand.itemUid, support: cand.support },
        ...(etape ? { pendingCascade: etape } : {}),
      });
    },
    /** Acquitte un test de compétence : applique la branche réussite/échec. */
    resolveTest: () => {
      const pt = get().pendingTest;
      if (!pt || pt.roll == null) return; // pas d'acquittement avant le jet
      // ACQUITTEMENT par le goulot (`FLOWS.test.apply`) : l'issue est déclarée AU FLUX (`spec.issue`),
      // journalisée là — ici on acquitte, avant de fermer (l'issue se lit sur le pending qui l'a produite).
      FLOWS.test.apply(get);
      // Le Test EST une cascade-hôte à une étape (rendu par CascadeModal) : on ferme LES DEUX avant de
      // lancer la branche (qui peut ouvrir d'autres pendings — combat, autre Test…).
      set({ pendingTest: null, pendingCascade: null });
      const actor = get().party.find((c) => c.id === pt.actorId);
      const tool = pt.itemUid ? actor?.items?.find((i) => i.uid === pt.itemUid) : undefined;
      // Pratique/Peu Fiable : ±1 DR sur un Test RATÉ (LDB 60 l.22/58). Ne repêche qu'un échec qui a
      // réussi le d100 mais manqué le seuil requireSL (jamais un roll > cible → on ne crée pas de réussite).
      const drDelta = tool ? craftTestDRAdjust(tool, pt.success) : 0;
      const effSuccess = drDelta !== 0 ? pt.roll <= pt.target && meetsRequiredSL(pt.requireSL, pt.sl + drDelta) : pt.success;
      // SEAM d'observation pure (recette navigateur, #514) — jamais lu par du code de règles.
      bus.emit(EVT.TEST_RESOLVED, { actorId: pt.actorId, success: effSuccess, sl: pt.sl, roll: pt.roll, target: pt.target });
      // Bâclé : un outil Bâclé qui Maladresse (échec + double) se brise (LDB 60, généralisé hors combat).
      if (tool && pt.isDouble && !pt.success && hasQuality(tool, 'bacle') && !isUnbreakable(tool)) {
        tool.destroyed = true;
        set({ party: [...get().party] }); // persiste la casse + re-render
        get().log(t('store.toolBroken', { tool: tool.label, name: actor?.label ?? pt.actorName }));
      }
      // Action de combat « cumuler l'Avantage » (LDB 09 l.305-308) : sur réussite, +1 Avantage plafonné au
      // `cap` de la Compétence (via `gainAdvantage`, qui respecte aussi le plafond général) ; l'Action est
      // consommée qu'on réussisse ou non (on a « passé son tour » à s'observer/prier — LDB 09 l.308/419).
      const ca = pt.combatAdvantage;
      const battle = ca ? get().battle : null;
      if (ca && battle) {
        const c = inBattleId(battle, ca.combatantId);
        if (c && effSuccess && (c.advantage ?? 0) < ca.cap) campGain(get, c, 1);
        set({ battle: { ...markActed(get, set), action: null } });
      }
      // Branche choisie PUIS continuation (suite du `seq` parent d'un nœud `test`), jouées par le
      // marcheur qui parle LEUR vocabulaire — même aiguillage que `reprendreFlow`/`reprendreFlowDeCombat` :
      // un Test SUBI (`pt.subi`) parle `target`/`caster` et repart chez le marcheur d'ACTEUR ; un Test de
      // scène parle `party`/`hero` et reste chez `runFlow` (butin de Test → fenêtre d'attribution).
      const branch = effSuccess ? pt.onSuccess : pt.onFailure;
      const issue = pt.subi
        ? reprendreTestSubi(get, set, pt, effSuccess)
        : runFlow(get, set, { kind: 'seq', steps: [branch ?? EMPTY_FLOW, pt.after ?? EMPTY_FLOW] }, pt.label, pt.sl);
      // CLÔTURES du Test (#1508) — elles suivent la branche, et attendent son dé s'il y en a un :
      //  · SEAM `onOwnTestFailed` (chemin modal JOUEUR — convergence des Tests de scène/compétence/combat,
      //    réf memory « JAMAIS rollTest inline chemin joueur ») : un Test RATÉ émet le trigger (Crampes
      //    abdominales → Sonné/À Terre/Inconscient par paliers de DR, MSRC 16 l.152). Réussite forcée
      //    (Résilience) exclue. RÉ-ENTRANCE : ce Test EST le sous-Test d'un `onOwnTestFailed` (FM de
      //    palier 2) → il ne RÉ-ÉMET PAS.
      //  · avancée de dialogue différée (un `choice.flow` avait suspendu ICI).
      const clotures: Cloture[] = [];
      if (!effSuccess && !pt.noOwnTestFailed) clotures.push({ verbe: 'testRateDeLActeur', actorId: pt.actorId, sl: pt.sl });
      if (pt.dialogueNext) clotures.push({ verbe: 'dialogueSuivant', transition: pt.dialogueNext });
      cloturer(get, set, issue, clotures);
    },
  } satisfies Partial<ActionsDuNoyau>;
}
