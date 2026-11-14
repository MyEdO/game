/** Tests de scène hors combat : Test simple, Test étendu (LDB 12), enfoncer une porte (EDO Appendice 2). */
import { reprendreLaSuite, runFlow, cloturer } from './combatEffects';
import { fireOwnTestFailed } from './triggeredEffects';
import { battleRng } from './battleRng';
import { touchActors } from './combatOrParty';
import type { BuiltCascadeStep } from './stepBrand';
import { pousseSi, hostStep, idDansLaSequence, openSequence, resultLine } from './rollSeam';
import { evaluateTest, extendedTestStep } from '../engine/tests';
import { t } from '../i18n';
import { dissipateSpell } from '../engine/dispel';
import { curseurPose, sortirDeLHote } from './cascade';
import { tablesPosees, type FragmentDeTables } from './tablesPosees';
import { FLOWS, meetsRequiredSL, type CloturesDuJet } from './rollFlowSpecs';
import { armeDEnfoncement, bilanDuRound } from './enfoncerUnePorte';
import { refuserGeste } from './refusVisible';
import { craftTestDRAdjust, hasQuality, isUnbreakable } from '../engine/qualities/dispatch';
import { bus, EVT } from './bus';
import { actorIn, inBattleId } from './monde/combatants';
import { campGain } from './combat/advantagePool';
import { markActed } from './combatFlow';
import { reprendreTestSubi } from './combat/triggeredTest';
import { poursuivreLAccostage } from './seaVoyageFlow';
import { EMPTY_FLOW } from '../engine/flowCore';
import { garanti } from '../lib/garanti';
import { nomEnVue } from './visionDuGroupe';
import type { Cloture, PendingExtendedTest } from './pendings';
import type { Get, Set } from './flowTypes';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { CorpsDesReglages } from './reglagesDuJet';

/** Issue du Round COURANT d'un Test étendu de scène, `null` avant son jet : lue par le geste
 *  (`jetValider('testEtendu')`) et par la fenêtre. LDB 12 l.170-185 */
export function issueDuRound(p: PendingExtendedTest): ReturnType<typeof extendedTestStep> | null {
  const cur = p.rounds[p.rounds.length - 1];
  return cur?.result ? extendedTestStep(p.total, cur.result, p.drCible) : null;
}

export function creerActionsDesTestsDeScene(get: Get, set: Set) {
  return {
    ouvrirLeTestEtendu: ({ stake, ...donnee }) => {
      set({ pendingExtendedTest: { ...donnee, total: 0, rounds: [{ id: 'round-1', interactive: true, result: null }] } });
      // Par la PORTE (#1262 V2 L4). Le mint vérifie que `pendingExtendedTest` est posé — il vient de
      // l'être, ligne au-dessus. L'enjeu vit sur l'ÉTAPE, que `CascadeModal` lit (`cur.stake`, #1117).
      const steps: BuiltCascadeStep[] = [];
      pousseSi(steps, hostStep(get, { id: idDansLaSequence(get, 'ext-jet', 'test'), kind: 'jetEtendu', jet: 'testEtendu', actorId: donnee.actorId, ...(stake ? { stake } : {}) }));
      if (steps.length) openSequence(get, set, { title: donnee.label, icon: 'interface/cle', purpose: 'test', steps });
    },
    // Enfoncer une porte à plusieurs (EDO Appendice 2) : flux multi PARALLÈLE (objet BE/B).
    enfoncerLaPorte: (opts) => {
      set({ pendingForceDoor: { label: opts.label, doorBE: opts.doorBE, doorB: opts.doorB, doorBmax: opts.doorB, flag: opts.flag,
        ...(opts.suite ? { suite: opts.suite } : {}),
        participants: opts.heroIds.map((id) => ({ id, interactive: true, result: null })) } });
      // « Une situation = une modale » : l'enfoncement est hôté dans la cascade (rendu par CascadeModal
      // via l'étape `jet:'enfoncerLaPorte'`). `pendingForceDoor` reste le porteur des données/participants ;
      // ses résolveurs ferment LES DEUX quand la porte cède. `groupOwner` → l'arbitre coop met l'owner à
      // '*' (action de GROUPE : chacun pilote ses héros), faute d'acteur unique sur l'étape.
      // #1262 V2 L4 : par la PORTE (`hostStep`, forme de GROUPE) — l'étape n'est plus un littéral, et le
      // mint vérifie que `pendingForceDoor` est posé (il vient de l'être).
      const steps: BuiltCascadeStep[] = [];
      pousseSi(steps, hostStep(get, { id: 'forceDoor', kind: 'enfoncerLaPorte', jet: 'enfoncerLaPorte', groupOwner: true }));
      if (steps.length) openSequence(get, set, { title: t('store.forceDoorTitle'), icon: 'action/enfoncer', purpose: 'combat', steps });
    },
  } satisfies FabriqueDuNoyau;
}

/** Les réglages des Tests de scène (`CorpsDesReglages`) : `jetRegler` les joue, dans leur phase. */
export function reglagesDesTestsDeScene(get: Get, set: Set): Pick<CorpsDesReglages, 'enfoncerLaPorte' | 'test'> {
  return {
    enfoncerLaPorte: {
      /** L'arme de la rangée `heroId`, parmi `armesDEnfoncement`, ou ses mains nues (`null`). EDO 11 l.93 */
      arme: (armeUid, heroId) => {
        const p = get().pendingForceDoor;
        const part = p?.participants.find((x) => x.id === heroId);
        const actor = part ? actorIn(get(), part.id) : undefined;
        if (!p || !part || !actor || (armeUid && !armeDEnfoncement(actor, { armeUid }))) {
          refuserGeste(get, set, t('store.armeDEnfoncementIndisponible'));
          return;
        }
        const { armeUid: _ancienne, ...reste } = part;
        set({ pendingForceDoor: { ...p, participants: p.participants.map((x) => (x.id === part.id ? { ...reste, ...(armeUid ? { armeUid } : {}) } : x)) } });
      },
    },
    test: {
      /** Re-cible le Test sur le candidat `id` du groupe. */
      testeur: (id) => {
        const pt = get().pendingTest;
        if (!pt) return;
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
          pendingTest: { ...pt, actorId: cand.id, skillValue: cand.value, target: cand.target, clamped: cand.clamped, base: cand.base, mods: cand.mods, psychMod: cand.psychMod, psychDetail: cand.psychDetail, itemUid: cand.itemUid, support: cand.support },
          ...(etape ? { pendingCascade: etape } : {}),
        });
      },
    },
  };
}

/** Les genres d'étape que ce module produit SANS applier : l'hôte ou le jet les traite (`GenreHote`). */
export const GENRES_HOTES = ['jetEtendu', 'enfoncerLaPorte'] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  clotures: {
    /** SEAM `onOwnTestFailed` d'un Test RATÉ — verbe de CLÔTURE (#1508) : il APPLIQUE des ops (Crampes
     *  abdominales → Sonné/À Terre par paliers de DR, MSRC 16 l.152), donc il attend le dé comme le reste. */
    testRateDeLActeur: (get, set, c) => {
      const cascadeSet = !get().pendingCascade && !get().pendingTest ? set : undefined;
      const fired = fireOwnTestFailed(get, c.actorId, { sl: c.sl, rng: battleRng(), set: cascadeSet });
      if (fired.length) fired.forEach((l) => get().ecrireAuJournal(l));
      set({ ...touchActors(get()) });
    },
  },
} satisfies FragmentDeTables;

/** Les clôtures des Tests de scène (`CloturesDuJet`) : `jetValider` les joue, tant que le flux les ouvre. */
export function cloturesDesTestsDeScene(get: Get, set: Set) {
  return {
    testEtendu: () => {
      const p = get().pendingExtendedTest;
      if (!p) return;
      const issue = issueDuRound(p);
      if (!issue) return; // le Round courant doit avoir été lancé
      const { total, done } = issue;
      // BORNE d'essais (Commerce d'opportunité, MDG 15 l.274-286 : « ≤ 3 tentatives ») — cible non
      // atteinte à la DERNIÈRE tentative permise = une ISSUE (résolue par `outcome`), pas une boucle infinie.
      const exhausted = !done && p.tentativesMax != null && p.rounds.length >= p.tentativesMax;
      if (done || exhausted) {
        sortirDeLHote(get, set, { pendingExtendedTest: null }, () => { // ferme la cascade-hôte aussi
          get().ecrireAuJournal(t('store.extendedDone', { label: p.label, issue: t(done ? 'store.extendedOk' : 'store.extendedKo'), total, target: p.drCible }));
          if (done && p.dispel) {
            // DISSIPATION réussie (LDB 46 l.160) : retire tous les effets du Sort de tous ses porteurs.
            const b = get().battle;
            const n = b ? dissipateSpell(b.combatants, p.dispel.spellId, p.dispel.casterId) : 0;
            set(touchActors(get()));
            get().ecrireAuJournal(t('cs.dispelDone', { spell: p.dispel.label, extra: n > 1 ? t('cs.fragDispelFreed', { n }) : '' }));
          }
          if (done && p.flag) set({ flags: { ...get().flags, [p.flag]: true } }); // gate la suite (porte/serrure d'éditeur)
          // Issue de DOMAINE en donnée (kind-agnostique) : appliée qu'elle ait réussi ou buté sur `tentativesMax`.
          if (p.outcome) {
            const applier = tablesPosees().issuesDeTestEtendu[p.outcome.kind];
            const out = applier?.(get, set, p, total, done);
            const line = out?.consequences ? resultLine(out.consequences) : '';
            if (line) get().ecrireAuJournal(line);
          }
          reprendreLaSuite(get, set, p.suite);
        });
        return;
      }
      // Round suivant : la cascade-hôte (1 étape) reste, seul `pendingExtendedTest` gagne un Round (re-rendu).
      set({ pendingExtendedTest: { ...p, total, rounds: [...p.rounds, { id: `round-${p.rounds.length + 1}`, interactive: true, result: null }] } });
    },
    enfoncerLaPorte: () => {
      const p = get().pendingForceDoor;
      if (!p) return;
      const { degats: dmg, reste: doorB, cede } = bilanDuRound(p);
      if (cede) {
        sortirDeLHote(get, set, { pendingForceDoor: null }, () => { // la porte cède → ferme la situation (data + cascade hôte)
          get().ecrireAuJournal(t('store.doorYields', { label: p.label, n: dmg, s: dmg > 1 ? 's' : '' }));
          if (p.flag) set({ flags: { ...get().flags, [p.flag]: true } }); // ouverture en jeu (porte d'éditeur)
          reprendreLaSuite(get, set, p.suite);
        });
      } else {
        // La porte tient : un nouveau Round s'ouvre (chacun re-frappe — jets remis à zéro).
        set({ pendingForceDoor: { ...p, doorB, participants: p.participants.map((x) => ({ ...x, result: null, rerolled: false, forcee: false })) } });
        get().ecrireAuJournal(t('store.doorHolds', { label: p.label, n: dmg, s: dmg > 1 ? 's' : '', left: doorB, sB: doorB > 1 ? 's' : '' }));
      }
    },
    /** Acquitte un test de compétence : applique la branche réussite/échec. */
    test: () => {
      const pt = get().pendingTest;
      if (!pt) return;
      const lance = garanti(pt.roll, pt.actorId, 'jet du Test');
      // ACQUITTEMENT par le goulot (`FLOWS.test.apply`) : l'issue est déclarée AU FLUX (`spec.issue`),
      // journalisée là — ici on acquitte, avant de fermer (l'issue se lit sur le pending qui l'a produite).
      FLOWS.test.apply(get);
      // Le Test EST une étape-hôte de sa séquence (rendue par CascadeModal) : la sortie d'hôte la ferme avant la
      // branche (qui peut ouvrir d'autres pendings — combat, autre Test…), puis reprend la pile après la suite.
      sortirDeLHote(get, set, { pendingTest: null }, (fermee) => {
        const actor = get().party.find((c) => c.id === pt.actorId);
        const tool = pt.itemUid ? actor?.items?.find((i) => i.uid === pt.itemUid) : undefined;
        // Pratique/Peu Fiable : ±1 DR sur un Test RATÉ (LDB 60 l.22/58). Ne repêche qu'un échec qui a
        // réussi le d100 mais manqué le seuil requireSL (jamais un Test raté, `evaluateTest` → on ne crée pas de réussite).
        const drDelta = tool ? craftTestDRAdjust(tool, pt.success) : 0;
        const effSuccess = drDelta !== 0 ? evaluateTest(lance, pt.target).success && meetsRequiredSL(pt.requireSL, pt.sl + drDelta) : pt.success;
        // SEAM d'observation pure (recette navigateur, #514) — jamais lu par du code de règles.
        bus.emit(EVT.TEST_RESOLVED, { actorId: pt.actorId, success: effSuccess, sl: pt.sl, roll: lance, target: pt.target });
        // Bâclé : un outil Bâclé qui Maladresse (échec + double) se brise (LDB 60, généralisé hors combat).
        if (tool && pt.isDouble && !pt.success && hasQuality(tool, 'bacle') && !isUnbreakable(tool)) {
          tool.destroyed = true;
          set({ party: [...get().party] }); // persiste la casse + re-render
          get().ecrireAuJournal(t('store.toolBroken', { tool: tool.label, name: garanti(nomEnVue(get(), pt.actorId), pt.actorId, 'testeur') }));
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
        // Branche choisie PUIS continuation (suite du `sequence` parent d'un nœud `test`), jouées par le
        // marcheur qui parle LEUR vocabulaire — même aiguillage que `reprendreFlow`/`reprendreFlowDeCombat` :
        // un Test SUBI (`pt.subi`) parle `target`/`caster` et repart chez le marcheur d'ACTEUR ; un Test de
        // scène parle `party`/`hero` et reste chez `runFlow` (butin de Test → fenêtre d'attribution).
        const branch = effSuccess ? pt.onSuccess : pt.onFailure;
        const issue = pt.subi
          ? reprendreTestSubi(get, set, pt, effSuccess)
          : runFlow(get, set, { kind: 'sequence', etapes: [branch ?? EMPTY_FLOW, pt.after ?? EMPTY_FLOW] }, pt.label, pt.sl);
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
        // Le Test d'un événement d'escale se clôt par la sortie d'hôte, sans `dispatchCascadeDone` : l'accostage que portait la
        // séquence qu'elle a fermée suit la branche, avant la reprise de la pile. Une séquence qui continue l'accoste à son dénouement.
        if (fermee?.portArrival) poursuivreLAccostage(get, set, fermee.portArrival);
      });
    },
  } satisfies Partial<CloturesDuJet>;
}
