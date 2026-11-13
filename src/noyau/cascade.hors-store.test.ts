import { idsDeTest } from '../engine/idsDeTest.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { combatStakeRef } from '../data';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { startCascade, type CascadeApplier, stepInteraction, stepReady, runCascadeImmediate, pushStep, stepOpposedFreeze, advanceCascade, resolveRemainingCascade, resumeSuspendedCascade, setClotureDeCascade, compteurDeSequence } from './cascade';
import { buildSeaPlan } from './seaVoyageFlow';
import { freeCons, monoStep, displayStep, buildBand } from './rollSeam';
import { type BuiltCascadeStep } from './stepBrand';
import { spyApplier } from './cascade.testkit';
import { fermeturesDeLaFenetre, fermeturesDuFlux } from './verbesOuverts';
import { fenetreDuJeu, TOUT_RESOUDRE } from './combatAuto';
import { cleDuGeste } from './modalArbiter';
import type { FermetureDuJet } from './rollFlowFactory';
import { avecLesTables, cleDeFixture } from './noyau.testkit';
import { journaliser } from './combatLog';
import { jouerLesClotures } from './combatEffects';
import type { CascadeStep, BatchParticipant } from './pendings';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * CASCADE séquentielle influençable (jets de NUIT / VOYAGE) — cœur générique. 3ᵉ consommateur de la
 * fabrique UNIQUE de jet, SÉQUENTIEL comme le Test Étendu mais avec une conséquence PROPRE par étape
 * (table des appliers, posée par `avecLesTables`) et insertion dynamique d'étapes (dépendance abri → Exposition).
 */
describe('Cascade séquentielle influençable', () => {
  const applied: { kind: string; success: boolean }[] = [];
  /** Les genres SYNTHÉTIQUES de la suite, posés par `avecLesTables` ; un test y ajoute les siens. */
  let appliers: Record<string, CascadeApplier>;
  beforeEach(() => {
    applied.length = 0;
    banc.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    // Conséquence synthétique : note l'étape validée + une ligne de journal.
    appliers = {};
    avecLesTables({ appliers });
    appliers.tally = spyApplier(applied, (step) => ({ kind: step.kind, success: !!step.result?.success }), (step) => ({ consequences: freeCons([`${step.label} → ${step.result?.success ? 'réussi' : 'raté'}`]) }));
  });

  function hero() {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brawn', seed: 1 });
    h.fortune = 2; h.resilience = 1;
    banc.setState({ party: [h] });
    return h;
  }
  const step = (id: string, actorId: string, target = 55): CascadeStep =>
    ({ id, kind: cleDeFixture('tally'), actorId, label: fixtureText(id), rollLabel: 'Résistance', base: target, target, result: null});

  it('présente une étape à la fois, applique chaque conséquence dans l’ordre, puis finalise', () => {
    banc.getState().ensemencerLeTirage(3);
    const h = hero();
    startCascade(banc.getState, banc.setState, {
      title: 'Nuit', purpose: 'test', steps: [step('s1', h.id), step('s2', h.id)],
    });
    // Étape 1 : seule l'étape COURANTE (cursor) est active.
    expect(banc.getState().pendingCascade!.cursor).toBe(0);
    banc.getState().jetLancer('cascade', 's1');
    expect(banc.getState().pendingCascade!.participants[0].result).toBeTruthy();
    banc.getState().jetValider('cascade'); // valide s1 → conséquence appliquée, avance sur s2
    expect(applied).toHaveLength(1);
    expect(banc.getState().pendingCascade!.cursor).toBe(1);
    // Étape 2 → fin de cascade.
    banc.getState().jetLancer('cascade', 's2');
    banc.getState().jetValider('cascade');
    expect(applied).toHaveLength(2);
    expect(banc.getState().pendingCascade).toBeNull(); // finalisée
    expect(banc.getState().journal.some((l) => l.startsWith('s1'))).toBe(true); // journal des conséquences
  });

  it('« Étape suivante » est un no-op tant que l’étape courante n’est pas lancée', () => {
    const h = hero();
    startCascade(banc.getState, banc.setState, { title: 'Nuit', purpose: 'test', steps: [step('s1', h.id)] });
    banc.getState().jetValider('cascade'); // pas encore lancé → rien ne se passe
    expect(applied).toHaveLength(0);
    expect(banc.getState().pendingCascade!.cursor).toBe(0);
  });

  it('une conséquence peut INSÉRER des étapes suivantes (dépendance abri → Exposition)', () => {
    banc.getState().ensemencerLeTirage(5);
    const h = hero();
    appliers['abri-de-fortune'] = spyApplier(applied, (step) => ({ kind: step.kind, success: !!step.result?.success }), (step) => ({ insert: step.result?.success ? [] : [step1Insert(h, 'expo-a'), step1Insert(h, 'expo-b')] }));
    // Une étape insérée passe par un mint de la porte (`insert` n'accepte aucun littéral) : valeur
    // FOURNIE (40) à Intermédiaire (+0) — base 40, cible 40, comme le montage à la main d'avant.
    function step1Insert(actor: Combatant, id: string): BuiltCascadeStep {
      return monoStep({ id, kind: cleDeFixture('tally'), actor, label: fixtureText(id), rollLabel: 'Résistance', difficulty: 'intermediaire', stake: combatStakeRef('combat-fatigue'), ligne: { valeur: 40, valeurEtrangere: true } })!;
    }
    // Abri FORCÉ raté (dé 99) → insère 2 étapes d'Exposition.
    const shelter: CascadeStep = { id: 'abri', kind: 'abri-de-fortune', actorId: h.id, label: fixtureText('Abri'), rollLabel: 'Survie', base: 40, target: 40, result: { roll: 99, target: 40, sl: -5, success: false }};
    startCascade(banc.getState, banc.setState, { title: 'Camp', purpose: 'test', steps: [shelter] });
    expect(banc.getState().pendingCascade!.participants).toHaveLength(1);
    banc.getState().jetValider('cascade'); // valide l'abri raté → +2 étapes
    expect(banc.getState().pendingCascade!.participants).toHaveLength(3); // abri + 2 Exposition
    expect(banc.getState().pendingCascade!.cursor).toBe(1); // on enchaîne sur la 1ʳᵉ insérée
  });

  it('« Tout lancer » résout d’office les étapes restantes puis montre le BILAN avant fermeture', () => {
    banc.getState().ensemencerLeTirage(9);
    const h = hero();
    startCascade(banc.getState, banc.setState, {
      title: 'Nuit', purpose: 'test', steps: [step('s1', h.id), step('s2', h.id), step('s3', h.id)],
    });
    banc.getState().jetLancer('cascade'); // auto-résout s1..s3
    expect(applied).toHaveLength(3); // toutes les conséquences se sont appliquées
    // BILAN : la modale reste ouverte (curseur EN FIN) pour voir les conséquences, avant fermeture explicite.
    expect(banc.getState().pendingCascade!.cursor).toBe(3);
    banc.getState().fenetreFermer('cascade'); // « Terminer » ferme
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('mêmes verbes d’influence : la Chance relance une étape propre ratée', () => {
    const h = hero();
    const failed: CascadeStep = { id: 's1', kind: cleDeFixture('tally'), actorId: h.id, label: fixtureText('s1'), rollLabel: 'Résistance', base: 30, target: 30, result: { roll: 88, target: 30, sl: -5, success: false }, rerolled: false};
    startCascade(banc.getState, banc.setState, { title: 'Nuit', purpose: 'test', steps: [failed] });
    banc.getState().jetRelancer('cascade', 's1');
    expect(banc.getState().party[0].fortune).toBe(1); // 1 Point de Chance dépensé
    // Résilience : étape garantie réussie.
    banc.getState().jetForcerLaReussite('cascade', 's1');
    expect(banc.getState().pendingCascade!.participants[0].result!.success).toBe(true);
    expect(banc.getState().party[0].resilience).toBe(0);
  });

  it('stepInteraction / stepReady : type d’interaction inféré des champs', () => {
    const jet: CascadeStep = { id: 'j', kind: cleDeFixture('tally'), actorId: 'x', rollLabel: 'R', base: 30, target: 30, result: null};
    const choix: CascadeStep = { id: 'c', kind: cleDeFixture('pick'), actorId: 'x', options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }]};
    const aff: CascadeStep = { id: 'd', kind: cleDeFixture('note'), actorId: 'x'};
    expect(stepInteraction(jet)).toBe('jet');
    expect(stepInteraction(choix)).toBe('choix');
    expect(stepInteraction(aff)).toBe('affichage');
    expect(stepReady(jet, banc.getState())).toBe(false);
    expect(stepReady({ ...jet, result: { roll: 10, target: 30, sl: 2, success: true } }, banc.getState())).toBe(true);
    expect(stepReady(choix, banc.getState())).toBe(false);
    expect(stepReady({ ...choix, chosen: 'a' }, banc.getState())).toBe(true);
    expect(stepReady(aff, banc.getState())).toBe(true);
    // Étape HÔTE (#1765) : prête une fois sa fenêtre validée (`committed`) ou son slot rendu.
    const hote: CascadeStep = { id: 'h', kind: 'jetDeDefense', jet: 'defense', actorId: 'x' };
    const vivante = { pendingDefense: {} } as unknown as Parameters<typeof stepReady>[1];
    expect(stepInteraction(hote)).toBe('affichage');
    expect(stepReady(hote, vivante), 'la défense attend sa fenêtre').toBe(false);
    expect(stepReady({ ...hote, committed: true }, vivante), 'validée : le slot vivant est celui de la frappe suivante').toBe(true);
    expect(stepReady(hote, { pendingDefense: null }), 'slot rendu').toBe(true);
  });

  it('étape « choix » : no-op sans choix, puis l’option pilote la conséquence + insertion', () => {
    const h = hero();
    appliers.pick = spyApplier(applied, (step) => ({ kind: step.kind, success: step.chosen === 'devier' }), (step) => (step.chosen === 'devier' ? { insert: [displayStep({ id: 'suite', kind: cleDeFixture('note'), actorId: h.id, label: fixtureText('Suite')})] } : {}));
    appliers.note = spyApplier(applied, (step) => ({ kind: step.kind, success: true }), (step) => ({ consequences: freeCons([`${step.id}`]) }));
    const choix: CascadeStep = { id: 'c', kind: cleDeFixture('pick'), actorId: h.id, options: [{ key: 'devier', label: fixtureText('Dévier') }, { key: 'subir', label: fixtureText('Subir') }]};
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [choix] });
    expect(fermeturesDuFlux(banc.getState(), 'cascade').valider, 'la validation attend le choix').toBe('choixDu');
    banc.getState().jetValider('cascade'); // pas de choix → no-op
    expect(applied).toHaveLength(0);
    expect(banc.getState().pendingCascade!.cursor).toBe(0);
    banc.getState().jetRegler('cascade', 'choix', 'devier', 'c');
    expect(banc.getState().pendingCascade!.participants[0].chosen).toBe('devier');
    expect(fermeturesDuFlux(banc.getState(), 'cascade').valider, 'tranchée, l’étape se valide').toBeNull();
    banc.getState().jetValider('cascade'); // valide → applier voit 'devier' + insère 'suite'
    expect(applied[0]).toEqual({ kind: 'pick', success: true });
    expect(banc.getState().pendingCascade!.participants).toHaveLength(2);
    expect(banc.getState().pendingCascade!.cursor).toBe(1);
  });

  it('étape « affichage » : validée sans jet ni choix', () => {
    const h = hero();
    appliers.note = spyApplier(applied, () => ({ kind: 'note', success: true }), (step) => ({ consequences: freeCons([`${step.id}`]) }));
    const aff: CascadeStep = { id: 'd', kind: cleDeFixture('note'), actorId: h.id};
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [aff] });
    banc.getState().jetValider('cascade'); // affichage → acquitté directement, cascade finalisée
    expect(applied).toEqual([{ kind: 'note', success: true }]);
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('au BILAN, la validation est fermée (`etapesJouees`) : la séquence ne se clôt que par sa sortie', () => {
    const h = hero();
    appliers.note = spyApplier(applied, () => ({ kind: 'note', success: true }));
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [{ id: 'd', kind: cleDeFixture('note'), actorId: h.id }] });
    banc.getState().jetLancer('cascade');
    expect(banc.getState().pendingCascade?.cursor, 'bilan').toBe(1);
    expect(fermeturesDuFlux(banc.getState(), 'cascade').valider).toBe('etapesJouees');
    banc.getState().jetValider('cascade');
    expect(banc.getState().pendingCascade, 'la validation ne termine pas le bilan').not.toBeNull();
    banc.getState().fenetreFermer('cascade');
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('la validation se juge sur la fenêtre entière : avant le jet, l’id d’étape que la fenêtre désigne ne l’ouvre pas', () => {
    const h = hero();
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [step('s1', h.id)] });
    const valider = cleDuGeste({ verbe: 'jetValider', flux: 'cascade' });
    const avant = banc.getState();
    const fenetre = fenetreDuJeu(avant);
    expect(fenetre?.pid, 'la fenêtre désigne l’étape').toBe('s1');
    expect(fermeturesDuFlux(avant, 'cascade', 's1').valider, 'jugée sur la rangée, la validation serait ouverte').toBeNull();
    expect(fermeturesDeLaFenetre(avant, fenetre).get(valider)).toBe('jetNonLance');
    banc.getState().jetValider('cascade');
    expect(banc.getState().pendingCascade, 'refusée, la validation ne change rien').toEqual(avant.pendingCascade);
    expect(applied).toHaveLength(0);
    banc.getState().jetLancer('cascade', 's1');
    expect(fermeturesDeLaFenetre(banc.getState()).get(valider), 'le jet lancé, elle s’ouvre').toBeNull();
    banc.getState().jetValider('cascade');
    expect(applied).toHaveLength(1);
  });

  it('« Tout résoudre » s’annonce fermé exactement quand le jouer ne change rien', () => {
    banc.getState().ensemencerLeTirage(7);
    const h = hero();
    appliers.pick = spyApplier(applied, (step) => ({ kind: 'pick', success: step.chosen === 'a' }));
    const choix: CascadeStep = { id: 'c', kind: cleDeFixture('pick'), actorId: h.id, options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }] };
    const toutResoudre = cleDuGeste(TOUT_RESOUDRE);
    /** L'annonce de « Tout résoudre » dans la fenêtre, et si le jouer change la cascade. */
    const annonceEtEffet = (): [FermetureDuJet | null | undefined, boolean] => {
      const avant = banc.getState();
      const annonce = fermeturesDeLaFenetre(avant).get(toutResoudre);
      banc.getState().jetLancer('cascade');
      return [annonce, JSON.stringify(banc.getState().pendingCascade) !== JSON.stringify(avant.pendingCascade)];
    };
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [step('s1', h.id), choix] });
    expect(annonceEtEffet(), 'une étape-jet : ouvert, joué').toEqual([null, true]);
    expect(banc.getState().pendingCascade?.cursor, 'arrêté sur le choix').toBe(1);
    expect(annonceEtEffet(), 'un choix non tranché : fermé, refusé').toEqual(['choixDu', false]);
    banc.getState().jetRegler('cascade', 'choix', 'a', 'c');
    expect(annonceEtEffet(), 'le choix tranché : ouvert, joué').toEqual([null, true]);
    expect(banc.getState().pendingCascade?.cursor, 'bilan').toBe(2);
    expect(annonceEtEffet(), 'au bilan : fermé, refusé').toEqual(['etapesJouees', false]);
  });

  it('« Tout résoudre » résout les étapes auto mais S\'ARRÊTE sur un CHOIX (pas d\'auto-tranche)', () => {
    banc.getState().ensemencerLeTirage(7);
    const h = hero();
    appliers.pick = spyApplier(applied, (step) => ({ kind: 'pick', success: step.chosen === 'a' }));
    appliers.note = spyApplier(applied, () => ({ kind: 'note', success: true }));
    const steps: CascadeStep[] = [
      step('s1', h.id), // jet (tally) — auto-résolu
      { id: 'c', kind: cleDeFixture('pick'), actorId: h.id, options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }]}, // CHOIX → STOP
      { id: 'd', kind: cleDeFixture('note'), actorId: h.id}, // affichage (pas atteint tant que le choix n'est pas tranché)
    ];
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps });
    banc.getState().jetLancer('cascade');
    expect(applied.map((a) => a.kind)).toEqual(['tally']); // le jet est résolu, on S'ARRÊTE sur le choix
    expect(banc.getState().pendingCascade!.cursor).toBe(1); // curseur SUR le choix (le joueur doit trancher)
    // Le joueur tranche → on enchaîne le reste.
    banc.getState().jetRegler('cascade', 'choix', 'a', 'c');
    banc.getState().jetValider('cascade'); // valide le choix → affichage
    banc.getState().jetValider('cascade'); // valide l'affichage → fin
    expect(applied.map((a) => a.kind)).toEqual(['tally', 'pick', 'note']);
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('runCascadeImmediate : CHOIX sans `defaultChoice` authoré → S\'ARRÊTE PENDANTE (jamais `options[0]` en silence, #351)', () => {
    banc.getState().ensemencerLeTirage(7);
    const h = hero();
    appliers.pick = spyApplier(applied, (step) => ({ kind: 'pick', success: step.chosen === 'a' }));
    appliers.note = spyApplier(applied, () => ({ kind: 'note', success: true }));
    const steps: CascadeStep[] = [
      step('s1', h.id), // jet (tally) — auto-résolu
      { id: 'c', kind: cleDeFixture('pick'), actorId: h.id, options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }]}, // CHOIX sans défaut → STOP
      { id: 'd', kind: cleDeFixture('note'), actorId: h.id}, // jamais atteint
    ];
    const resolved = runCascadeImmediate(banc.getState, banc.setState, steps);
    expect(applied.map((a) => a.kind)).toEqual(['tally']); // seul le jet est résolu
    expect(resolved, 'pilote INTERROMPU : aucune étape rendue, l’appelant n’enchaîne rien (#1595)').toBeUndefined();
    // La cascade est SURFACÉE (pas résolue en aveugle) — le joueur/l'appelant la reprend.
    const p = banc.getState().pendingCascade!;
    expect(p).toBeTruthy();
    expect(p.cursor).toBe(1); // curseur SUR le choix
    expect(p.participants.map((s) => s.id)).toEqual(['s1', 'c', 'd']);
  });

  it('runCascadeImmediate : étape HÔTE TENUE dont la fenêtre vit (`pendingExtendedTest`) → S’ARRÊTE PENDANTE, non validée (#1765)', () => {
    const h = hero();
    banc.getState().ouvrirLeTestEtendu({ actorId: h.id, label: 'Enfoncer la porte', skillLabel: 'Force', target: 70, drCible: 15 });
    const hote = banc.getState().pendingCascade!.participants[0];
    banc.setState({ pendingCascade: null });
    const resolved = runCascadeImmediate(banc.getState, banc.setState, [hote]);
    expect(resolved, 'pilote INTERROMPU : aucune étape rendue, l’appelant n’enchaîne rien (#1765)').toBeUndefined();
    const p = banc.getState().pendingCascade!;
    expect(p.cursor).toBe(0);
    expect(p.participants[0].committed).toBeFalsy();
    expect(banc.getState().pendingExtendedTest).not.toBeNull();
  });

  it('runCascadeImmediate : étape HÔTE qu’AUCUN humain ne tient → parquée, ses verbes se jouent d’office sur le slot (#3892)', () => {
    banc.getState().ensemencerLeTirage(7);
    const h = hero();
    banc.getState().ouvrirLeTestEtendu({ actorId: h.id, label: 'Enfoncer la porte', skillLabel: 'Force', target: 70, drCible: 15 });
    const hote = banc.getState().pendingCascade!.participants[0];
    banc.setState({ pendingCascade: null, party: banc.getState().party.map((c) => (c.id === h.id ? { ...c, aiControlled: true } : c)) });
    expect(runCascadeImmediate(banc.getState, banc.setState, [hote]), 'la séquence se dénoue par la clôture du jet, pas par le pilote').toBeUndefined();
    expect(banc.getState().pendingExtendedTest, 'les Rounds ont été joués jusqu’à la cible').toBeNull();
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('runCascadeImmediate : parqué sur l’étape HÔTE, la fenêtre rendue → la reprise du pilote finit la séquence sans fenêtre, comme sans parcage (#1765)', () => {
    const g = banc.getState;
    const s = banc.setState;
    const h = hero();
    appliers.jetEtendu = spyApplier(applied, () => ({ kind: 'jetEtendu', success: true }));
    appliers.note = spyApplier(applied, () => ({ kind: 'note', success: true }));
    const sequence = (): CascadeStep[] => {
      g().ouvrirLeTestEtendu({ actorId: h.id, label: 'Enfoncer la porte', skillLabel: 'Force', target: 70, drCible: 15 });
      const hote = g().pendingCascade!.participants[0];
      s({ pendingCascade: null });
      return [hote, step('s1', h.id), { id: 'd', kind: cleDeFixture('note'), actorId: h.id }];
    };

    const temoinSteps = sequence();
    s({ pendingExtendedTest: null });
    g().ensemencerLeTirage(7);
    const temoin = runCascadeImmediate(g, s, temoinSteps)!;
    const appliquesTemoin = [...applied];
    expect(appliquesTemoin.map((a) => a.kind)).toEqual(['jetEtendu', 'tally', 'note']);

    applied.length = 0;
    const steps = sequence();
    g().ensemencerLeTirage(7);
    expect(runCascadeImmediate(g, s, steps), 'pilote PARQUÉ sur l’hôte').toBeUndefined();
    expect(g().pendingCascade!.piloteImmediat, 'la séquence parquée sur l’hôte ne porte pas la reprise').toEqual({ sansContexte: true });
    expect(applied).toEqual([]);

    s({ pendingExtendedTest: null });
    const done = advanceCascade(g, s)!;
    expect(done, 'la reprise n’a pas fini la séquence : le curseur est resté sur une fenêtre').toBeTruthy();
    expect(done.cursor).toBe(steps.length);
    expect(g().pendingCascade, 'une fenêtre s’est rouverte après le rendu de l’hôte').toBeNull();
    expect(applied.filter((a) => a.kind === 'jetEtendu'), 'l’hôte validé plus d’une fois').toHaveLength(1);
    expect(done.participants.every((x) => x.committed)).toBe(true);
    expect(applied).toEqual(appliquesTemoin);
    expect(done.participants.map((x) => x.result?.roll)).toEqual(temoin.map((x) => x.result?.roll));
  });

  it('runCascadeImmediate : CHOIX avec `defaultChoice` authoré → tranché sans surfacer (comportement inchangé)', () => {
    banc.getState().ensemencerLeTirage(7);
    const h = hero();
    appliers.pick = spyApplier(applied, (step) => ({ kind: 'pick', success: step.chosen === 'a' }));
    const steps: CascadeStep[] = [
      { id: 'c', kind: cleDeFixture('pick'), actorId: h.id, options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }], defaultChoice: 'a'},
    ];
    const resolved = runCascadeImmediate(banc.getState, banc.setState, steps)!;
    expect(applied).toEqual([{ kind: 'pick', success: true }]); // défaut authoré appliqué
    expect(resolved[0].chosen).toBe('a');
    expect(banc.getState().pendingCascade).toBeNull(); // rien à surfacer
  });

  it('étape « affichage » : contenu pré-posé (outcome) PRÉSERVÉ par un applier muet', () => {
    const h = hero();
    appliers.reveal = () => {}; // applier MUET (mutation seule, aucun journal)
    appliers.note = spyApplier(applied, () => ({ kind: 'note', success: true }));
    const steps: CascadeStep[] = [
      { id: 'r', kind: cleDeFixture('reveal'), actorId: h.id, outcome: [{ text: 'Sonné appliqué (Assommante)' }]}, // affichage
      { id: 'd', kind: cleDeFixture('note'), actorId: h.id},
    ];
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps });
    banc.getState().jetValider('cascade'); // valide l'affichage → figé, avance sur 'd'
    const committed = banc.getState().pendingCascade!.participants[0];
    expect(committed.committed).toBe(true);
    expect(committed.outcome).toEqual([{ text: 'Sonné appliqué (Assommante)' }]); // contenu pré-posé NON effacé
  });

  it('étape « batch » (participants — seam de jet #275 Décision 4 cran 1) : agrège les contributeurs à la validation', () => {
    banc.getState().ensemencerLeTirage(11);
    const h1 = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Timonier', seed: 2 });
    const h2 = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vigie', seed: 3 });
    banc.setState({ party: [h1, h2] });
    appliers['crew-batch'] = spyApplier(applied, (step) => ({ kind: step.kind, success: !!step.result?.success }), (step) => ({ consequences: freeCons([`${step.label} → DR ${step.result?.sl}`]) }));
    const participants: BatchParticipant[] = [
      { id: h1.id, label: 'Timonier', essential: true, interactive: true, base: 40, target: 40, result: null },
      { id: h2.id, label: 'Vigie', essential: false, interactive: true, base: 40, target: 40, result: null },
    ];
    // Deux porteurs → possession de GROUPE (`bandStep`/`buildBatchStep`) : une bande anonyme n'entre
    // plus dans une séquence (#1262 V2 L4, `assertBandeDeclarePossession`).
    const batch: CascadeStep = { id: 'progression', kind: cleDeFixture('crew-batch'), label: fixtureText('Progression'), groupOwner: true, participants, result: null};
    startCascade(banc.getState, banc.setState, { title: 'Voyage', purpose: 'test', steps: [batch] });
    expect(stepInteraction(banc.getState().pendingCascade!.participants[0])).toBe('batch');
    expect(stepReady(banc.getState().pendingCascade!.participants[0], banc.getState())).toBe(false); // aucun participant lancé
    banc.getState().jetValider('cascade'); // batch pas prêt → no-op (aucun participant lancé)
    expect(applied).toHaveLength(0);
    banc.getState().jetLancer('cascadeEnBande', h1.id);
    expect(stepReady(banc.getState().pendingCascade!.participants[0], banc.getState())).toBe(false); // h2 pas encore lancé
    banc.getState().jetLancer('cascadeEnBande', h2.id);
    expect(stepReady(banc.getState().pendingCascade!.participants[0], banc.getState())).toBe(true);
    banc.getState().jetValider('cascade'); // agrège (essentiel ×2, MDG 14 l.19) puis applique
    expect(applied).toHaveLength(1);
    expect(banc.getState().pendingCascade).toBeNull();
    expect(banc.getState().journal.some((l) => l.startsWith('Progression → DR'))).toBe(true);
  });

  /**
   * `dejaDites` (#1508) — l'applier qui déclenche LUI-MÊME une continuation écrivante dit sa conclusion
   * AVANT elle, par `journaliser`, et DÉCLARE au goulot de ne pas la ré-écrire. Le drapeau DÉSIGNE donc
   * des lignes : sans elles il ne protège rien, il coupe seulement le journal (compense #1881).
   */
  it('`dejaDites` : les conséquences rendues sont AFFICHÉES sur l’étape, et écrites au journal UNE fois', () => {
    const h = hero();
    appliers.deja = (get, set) => {
      journaliser(get, set, ['la conclusion, dite par l’applier'], 'information', { actorId: h.id });
      return { consequences: freeCons(['la conclusion, dite par l’applier']), dejaDites: true };
    };
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [{ id: 'd', kind: cleDeFixture('deja'), actorId: h.id }] });
    banc.getState().jetValider('cascade');
    expect(banc.getState().journal.filter((l) => l === 'la conclusion, dite par l’applier'),
      'le goulot ne la ré-écrit pas').toHaveLength(1);
  });

  it('`dejaDites` SANS conséquence à désigner : refus nommé (le drapeau ne remplace pas une conclusion)', () => {
    const h = hero();
    appliers.dejaVide = () => ({ dejaDites: true });
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [{ id: 'v', kind: cleDeFixture('dejaVide'), actorId: h.id }] });
    expect(() => banc.getState().jetValider('cascade')).toThrow(/dejaDites.*sans conclusion à désigner/s);
  });

  it('liveMerge : un applier qui APPEND une étape (conséquence foldée) la préserve à la validation', () => {
    const h = hero();
    // Simule une conséquence FOLDÉE (déviation) : son applier re-déclenche le reste de l'attaque, qui
    // APPEND une étape au pending (via set, comme pushReveal). advanceCascade doit la préserver.
    appliers.trigger = (get, set) => {
      const pc = get().pendingCascade!;
      set({ pendingCascade: { ...pc, participants: [...pc.participants, { id: 'appended', kind: cleDeFixture('note'), actorId: h.id, outcome: [{ text: 'conséquence ajoutée' }]}] } });
      return {};
    };
    appliers.note = spyApplier(applied, () => ({ kind: 'note', success: true }));
    const trig: CascadeStep = { id: 't', kind: cleDeFixture('trigger'), actorId: h.id, outcome: [{ text: 'déclencheur' }]};
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [trig] });
    banc.getState().jetValider('cascade'); // valide 'trigger' → APPEND 'appended' ; le pending NE se ferme PAS
    const p = banc.getState().pendingCascade;
    expect(p).toBeTruthy(); // pas finalisé : l'étape appendée est conservée
    expect(p!.participants.map((s) => s.id)).toEqual(['t', 'appended']);
    expect(p!.cursor).toBe(1); // curseur sur l'étape appendée
  });

  // DOCTRINE DU SLOT (#942 L1) : `pendingCascade` porte UNE séquence et rien n'y est jamais écrasé —
  // append à même `purpose` (bilan compris), suspension sinon, REPRISE à la clôture. Tout est joué par
  // les VRAIES coutures du noyau (`jetLancer('cascade', id)`/`jetValider('cascade')`/`jetLancer('cascade')`/`fenetreFermer('cascade')`) : la
  // reprise n'est jamais simulée à la main.
  describe('doctrine du slot : aucun écrasement (#942 L1)', () => {
    /** Résout puis TERMINE la séquence en place par les vraies actions du noyau (bouton « Tout lancer »
     *  puis « Terminer ») — c'est `dispatchCascadeDone` qui s'exécute, dénouement et reprise compris. */
    const terminerEnPlace = () => {
      banc.getState().jetLancer('cascade');
      banc.getState().fenetreFermer('cascade');
    };

    it('MÊME purpose sur une séquence ACTIVE : les étapes sont APPENDUES, aucune perdue', () => {
      const h = hero();
      startCascade(banc.getState, banc.setState, { title: 'Nuit', purpose: 'test', steps: [step('s1', h.id), step('s2', h.id)] });
      startCascade(banc.getState, banc.setState, { title: 'Halte', purpose: 'test', steps: [step('s3', h.id)] });
      const p = banc.getState().pendingCascade!;
      expect(p.participants.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
      expect(p.cursor).toBe(0); // la séquence en vol garde sa place
      expect(banc.getState().suspendedCascades).toHaveLength(0);
    });

    it('MÊME purpose : les bornes de dénouement et le journal des deux fragments sont RÉUNIS', () => {
      const h = hero();
      startCascade(banc.getState, banc.setState, { title: 'Voyage', purpose: 'travelDay', steps: [step('s1', h.id)], log: ['a'], travelHalt: true });
      startCascade(banc.getState, banc.setState, { title: 'Fin de Round', purpose: 'travelDay', steps: [step('s2', h.id)], log: ['b'], roundBoundary: true });
      const p = banc.getState().pendingCascade!;
      expect(p.travelHalt).toBe(true);
      expect(p.roundBoundary).toBe(true); // la borne du fragment appendu survit
      expect(p.log).toEqual(['a', 'b']);
    });

    it('MÊME purpose sur un BILAN : la séquence est RÉOUVERTE (append), son dénouement n’est pas jeté', () => {
      const h = hero();
      startCascade(banc.getState, banc.setState, { title: 'Nuit', purpose: 'test', steps: [step('s1', h.id)], travelHalt: true });
      banc.getState().jetLancer('cascade'); // → BILAN : curseur en fin, en attente du « Terminer »
      expect(banc.getState().pendingCascade!.cursor).toBe(1);
      startCascade(banc.getState, banc.setState, { title: 'Autre', purpose: 'test', steps: [step('s9', h.id)] });
      const p = banc.getState().pendingCascade!;
      expect(p.participants.map((s) => s.id)).toEqual(['s1', 's9']); // le bilan n'est PAS remplacé
      expect(p.cursor).toBe(1); // curseur sur l'étape appendée : la séquence est de nouveau JOUABLE
      expect(p.travelHalt).toBe(true); // le dénouement du fragment terminé survit jusqu'au « Terminer » fusionné
      expect(banc.getState().suspendedCascades).toHaveLength(0);
    });

    it('purpose DIFFÉRENT : la séquence en vol est PARQUÉE, et REPRISE par la clôture de l’autre (vraie couture)', () => {
      const h = hero();
      startCascade(banc.getState, banc.setState, { title: 'Voyage', purpose: 'travelDay', steps: [step('s1', h.id), step('s2', h.id)], travelHalt: true });
      banc.getState().jetLancer('cascade', 's1'); // la 1ʳᵉ étape est déjà lancée : son jet ne doit pas disparaître
      const roll = banc.getState().pendingCascade!.participants[0].result;
      startCascade(banc.getState, banc.setState, { title: 'Test de scène', purpose: 'test', steps: [step('t1', h.id)] });
      expect(banc.getState().pendingCascade!.participants.map((s) => s.id)).toEqual(['t1']);
      expect(banc.getState().suspendedCascades).toHaveLength(1);
      // CLÔTURE de la séquence 'test' par les vraies actions → `dispatchCascadeDone` reprend la parquée.
      terminerEnPlace();
      const back = banc.getState().pendingCascade;
      expect(back, 'la séquence parquée doit revenir dans le slot à la clôture').toBeTruthy();
      expect(back!.purpose).toBe('travelDay');
      expect(back!.participants.map((s) => s.id)).toEqual(['s1', 's2']); // aucune étape perdue
      expect(back!.participants[0].result).toEqual(roll); // ni le jet déjà lancé
      expect(back!.cursor).toBe(0);
      expect(back!.travelHalt).toBe(true); // sa borne de dénouement est intacte
      expect(banc.getState().suspendedCascades).toHaveLength(0);
    });

    it('BILAN d’un AUTRE purpose : parqué (jamais jeté) puis repris à la clôture, prêt à être terminé', () => {
      const h = hero();
      startCascade(banc.getState, banc.setState, { title: 'Journée', purpose: 'travelDay', steps: [step('s1', h.id)], travelHalt: true });
      banc.getState().jetLancer('cascade'); // bilan travelDay en attente de « Terminer »
      startCascade(banc.getState, banc.setState, { title: 'Test de scène', purpose: 'test', steps: [step('t1', h.id)] });
      expect(banc.getState().suspendedCascades[0]?.purpose).toBe('travelDay');
      terminerEnPlace(); // clôture du 'test' → reprise du bilan parqué
      const back = banc.getState().pendingCascade!;
      expect(back.purpose).toBe('travelDay');
      expect(back.travelHalt).toBe(true);
      expect(back.cursor).toBe(1); // toujours son BILAN : « Terminer » jouera son dénouement
    });

    it('une séquence ouverte PAR un applier (purpose différent) ne perd pas les étapes restantes', () => {
      const h = hero();
      // L'applier ouvre une séquence d'un AUTRE purpose (patron `sceneTest` déclenché par une étape de voyage).
      appliers.opens = (get, set) => {
        startCascade(get, set, { title: 'Test de scène', purpose: 'test', steps: [step('inner', h.id)] });
        return {};
      };
      const outer: CascadeStep = { id: 'day', kind: cleDeFixture('opens'), actorId: h.id, outcome: [{ text: 'journée' }]};
      startCascade(banc.getState, banc.setState, { title: 'Journée', purpose: 'travelDay', steps: [outer, step('later', h.id)] });
      banc.getState().jetValider('cascade'); // valide 'day' → l'applier prend le slot
      expect(banc.getState().pendingCascade!.purpose).toBe('test'); // la nouvelle séquence tient le slot
      expect(banc.getState().pendingCascade!.participants.map((s) => s.id)).toEqual(['inner']);
      const stack = banc.getState().suspendedCascades;
      expect(stack).toHaveLength(1);
      expect(stack[0].participants.map((s) => s.id)).toEqual(['day', 'later']); // 'later' n'est PAS perdue
      expect(stack[0].participants[0].committed).toBe(true); // 'day' reste validée
      expect(stack[0].cursor).toBe(1);
      // Et la clôture de la séquence interne rend le slot à la journée, sur l'étape 'later'.
      terminerEnPlace();
      expect(banc.getState().pendingCascade!.participants[banc.getState().pendingCascade!.cursor].id).toBe('later');
    });

    it('pushStep suit la MÊME doctrine : append à même purpose, PARQUE l’autre (jamais un écrasement)', () => {
      const h = hero();
      pushStep(banc.setState, { id: 'p1', kind: cleDeFixture('note'), actorId: h.id, label: fixtureText('Surprise')}, 'combat');
      expect(banc.getState().pendingCascade!.title).toBe('Surprise'); // l'étape prête son label au titre
      pushStep(banc.setState, { id: 'p2', kind: cleDeFixture('note'), actorId: h.id}, 'combat');
      expect(banc.getState().pendingCascade!.participants.map((s) => s.id)).toEqual(['p1', 'p2']);
      // purpose DIFFÉRENT : la séquence de combat est PARQUÉE, pas remplacée (contrat inverse de l'ancien).
      pushStep(banc.setState, { id: 'p3', kind: cleDeFixture('note'), actorId: h.id, label: fixtureText('Voyage')}, 'travelDay');
      expect(banc.getState().pendingCascade!.purpose).toBe('travelDay');
      expect(banc.getState().pendingCascade!.participants.map((s) => s.id)).toEqual(['p3']);
      const stack = banc.getState().suspendedCascades;
      expect(stack).toHaveLength(1);
      expect(stack[0].purpose).toBe('combat');
      expect(stack[0].participants.map((s) => s.id)).toEqual(['p1', 'p2']); // les deux étapes de combat vivent
    });
  });
});

/**
 * CONTRAT de l'étape OPPOSÉE : la grandeur qui DÉPARTAGE à DR égal est le Niveau de Compétence NU
 * (LDB 12 l.160), et `stepOpposedFreeze` est le SEUL point de passage des résolutions opposées (mono
 * ET bande) — il rend le jet d'adversaire FIGÉ tel que le producteur l'a jeté, une fois pour toutes
 * les rangées. La `base` d'une étape est nue PAR CONSTRUCTION (`CascadeStepBase.base`, Soutien en
 * ligne de `mods`) : aucune étape ne peut plus y fondre un Soutien.
 */
describe('étape opposée — base NUE (LDB 12 l.160)', () => {
  const aT = { roll: 20, target: 60, success: true, sl: 4, isDouble: false, base: 60 };
  it('une étape opposée rend son freeze', () => {
    const st = { id: 's1', kind: 'x', base: 40, target: 40, meta: { opposed: { aT } } } as unknown as CascadeStep;
    expect(stepOpposedFreeze(st)?.aT.roll).toBe(20);
  });
  it('une étape NON opposée n’en rend aucun', () => {
    const st = { id: 's1', kind: 'x', base: 50, target: 50, mods: [{ label: 'Soutien', value: 10 }] } as unknown as CascadeStep;
    expect(stepOpposedFreeze(st)).toBeUndefined();
  });
});

/**
 * LES DEUX PORTES D'ENTRÉE sous la fenêtre d'insertion (#1508) : une étape de la MÊME séquence ouverte
 * PENDANT l'application d'une autre — par `pushStep` OU par `startCascade` — est la suite immédiate de
 * celle-ci, et son id se mint sur le compteur de la fenêtre. Sous les TROIS pilotes.
 */
describe('startCascade pendant une application : la fenêtre, comme pushStep', () => {
  const g = () => banc.getState();
  const s: Banc['setState'] = (p) => banc.setState(p);
  let joues: string[] = [];
  let erreurs: ReturnType<typeof vi.spyOn>;
  const appliers: Record<string, CascadeApplier> = {
    // `fenP` ouvre, pendant qu'il s'applique, UNE étape de la même séquence par `startCascade` ; son id
    // vient du compteur de la séquence (`compteurDeSequence`), comme tout mint.
    fenP: (get, set, step) => {
      joues.push(step.id);
      const id = `sc-${compteurDeSequence(get(), 'test')}`;
      startCascade(get, set, { title: 'T', purpose: 'test', steps: [{ id, kind: cleDeFixture('fenF'), label: fixtureText('F') }] });
    },
    fenF: (_g, _s, step) => { joues.push(step.id); },
    // `fenB` ouvre, sous applier, un fragment qui porte une BORNE et une ligne de `log`.
    fenB: (get, set, step) => {
      joues.push(step.id);
      startCascade(get, set, { title: 'T', purpose: 'test', steps: [{ id: 'borne', kind: cleDeFixture('fenF'), label: fixtureText('F') }], roundBoundary: true, log: ['ligne du fragment'] });
    },
  };
  beforeEach(() => {
    joues = [];
    s({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    erreurs = vi.spyOn(console, 'error').mockImplementation(() => {});
    avecLesTables({ appliers });
  });
  afterEach(() => { erreurs.mockRestore(); });

  const trois = (): CascadeStep[] => [
    { id: 'a', kind: cleDeFixture('fenP'), label: fixtureText('a') },
    { id: 'c', kind: cleDeFixture('fenP'), label: fixtureText('c') },
    { id: 'b', kind: cleDeFixture('fenF'), label: fixtureText('b') },
  ];
  const ATTENDU = ['a', 'sc-3', 'c', 'sc-4', 'b'];

  it('interactif : chaque étape ouverte se joue juste derrière celle qui l’a ouverte, ids uniques', () => {
    startCascade(g, s, { title: 'T', purpose: 'test', steps: trois() });
    for (let k = 0; k < 10 && g().pendingCascade; k++) advanceCascade(g, s);
    expect(joues).toEqual(ATTENDU);
    expect(erreurs).not.toHaveBeenCalled();
  });

  it('« Tout résoudre » : aucune étape ouverte n’est perdue', () => {
    startCascade(g, s, { title: 'T', purpose: 'test', steps: trois() });
    resolveRemainingCascade(g, s);
    expect(joues).toEqual(ATTENDU);
    expect(g().pendingCascade!.participants.map((x) => x.id)).toEqual(ATTENDU);
    expect(g().pendingCascade!.seq).toBe(5);
    expect(erreurs).not.toHaveBeenCalled();
  });

  it('immédiat : les étapes ouvertes se jouent dans le tableau du pilote, pas au slot', () => {
    runCascadeImmediate(g, s, trois(), { title: 'T', purpose: 'test' });
    expect(joues).toEqual(ATTENDU);
    expect(g().pendingCascade).toBeNull();
    expect(erreurs).not.toHaveBeenCalled();
  });

  it('la BORNE et le `log` d’un fragment ouvert sous applier arrivent au slot : interactif, « Tout résoudre », immédiat ARRÊTÉ sur un choix', () => {
    const avecBorne = (): CascadeStep[] => [
      { id: 'x', kind: cleDeFixture('fenB'), label: fixtureText('x') },
      { id: 'fin', kind: cleDeFixture('fenF'), label: fixtureText('fin'), options: [{ key: 'o', label: fixtureText('o') }] },
    ];
    startCascade(g, s, { title: 'T', purpose: 'test', steps: avecBorne() });
    advanceCascade(g, s);
    expect(g().pendingCascade!.roundBoundary, 'interactif').toBe(true);
    expect(g().pendingCascade!.log).toContain('ligne du fragment');

    s({ pendingCascade: null });
    startCascade(g, s, { title: 'T', purpose: 'test', steps: avecBorne() });
    resolveRemainingCascade(g, s);
    expect(g().pendingCascade!.roundBoundary, '« Tout résoudre »').toBe(true);
    expect(g().pendingCascade!.log).toContain('ligne du fragment');

    s({ pendingCascade: null });
    runCascadeImmediate(g, s, avecBorne(), { title: 'T', purpose: 'test' });
    expect(g().pendingCascade!.roundBoundary, 'immédiat (arrêté sur le choix sans défaut)').toBe(true);
    expect(g().pendingCascade!.log).toContain('ligne du fragment');
    expect(erreurs).not.toHaveBeenCalled();
  });

  it('immédiat REPRIS après une décision : la borne, le `log` et le compteur que la reprise collecte arrivent à la séquence finalisée', () => {
    const steps: CascadeStep[] = [
      { id: 'decision', kind: cleDeFixture('fenF'), label: fixtureText('d'), options: [{ key: 'o', label: fixtureText('o') }] },
      { id: 'x', kind: cleDeFixture('fenB'), label: fixtureText('x') },
    ];
    expect(runCascadeImmediate(g, s, steps, { title: 'T', purpose: 'test' })).toBeUndefined();
    g().jetRegler('cascade', 'choix', 'o', 'decision');
    const done = advanceCascade(g, s)!;
    expect(done.participants.map((x) => x.id)).toEqual(['decision', 'x', 'borne']);
    expect(done.roundBoundary, 'la borne collectée à la reprise n’arrive pas au dénouement').toBe(true);
    expect(done.log).toContain('ligne du fragment');
    expect(done.seq, 'le compteur rendu ignore l’étape ouverte à la reprise').toBe(3);
    expect(erreurs).not.toHaveBeenCalled();
  });

  it('immédiat ALLÉ AU BOUT avec une borne collectée : aucun slot ne la porte, la levée la NOMME', () => {
    const seul = (): CascadeStep[] => [{ id: 'x', kind: cleDeFixture('fenB'), label: fixtureText('x') }];
    expect(() => runCascadeImmediate(g, s, seul(), { title: 'T', purpose: 'test' })).toThrow(/bornes collectées \(roundBoundary\)/);
    expect(erreurs).toHaveBeenCalledTimes(1);
  });
});

/**
 * LA REPRISE D'UNE SÉQUENCE PARQUÉE PAR LE PILOTE IMMÉDIAT rejoue le CONTEXTE de son lancement (#1595) :
 * la décision validée, la suite se résout comme si le pilote n'avait jamais rendu la main.
 */
describe('reprise du pilote immédiat : le contexte de lancement voyage avec la séquence parquée', () => {
  const g = () => banc.getState();
  const s: Banc['setState'] = (p) => banc.setState(p);
  const ligne = { test: { skill: { id: 'resistance' }, characteristic: 'endurance' } } as const;
  const appliers: Record<string, CascadeApplier> = {
    repriseNeutre: () => {},
    repriseCombat: (_get, set) => { set({ battle: {} as never }); },
  };
  beforeEach(() => {
    s({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [], net: { ...g().net, mode: 'local', ownership: {} } } as never);
    avecLesTables({ appliers });
  });

  const choix = (): CascadeStep => ({ id: 'decision', kind: cleDeFixture('repriseNeutre'), label: fixtureText('Décision'), options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }] });

  /** Un trajet de mer sous ordres, seul lieu où `rowSurface: 'pv'` se déclare, et un porteur à bord. */
  const aBord = () => {
    g().ensemencerLeTirage(5);
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brawn', seed: 1 });
    s({ party: [h], vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } });
    s({ travelPlan: buildSeaPlan(g, 'r1', 'A', 'B', { km: 550, seaHeading: 'est' }, { cadence: 'commande' })! });
    return h;
  };
  const bande = (h: Combatant, label: string) => buildBand(g, { id: `bande-${label}`, kind: cleDeFixture('repriseNeutre'), label: fixtureText(label), difficulty: 'intermediaire', porteurs: [{ actor: h, ligne }] })!;
  /** Les bandes au compte rendu du trajet, nommées par leur rubrique. */
  const auProcesVerbal = () => (g().travelPlan!.procesVerbal ?? []).map((e) => String(e.group));
  const desDeBrawnAuJournal = () => g().journal.filter((l) => l.includes('Brawn'));
  const combat = (): CascadeStep => ({ id: 'combat', kind: cleDeFixture('repriseCombat'), label: fixtureText('Combat') });

  it('`rowSurface` déclarée au lancement, parquée au slot sur un choix sans défaut : « Suivant » écrit la bande au compte rendu du trajet à son commit, sans redire ses dés au journal', () => {
    const h = aBord();
    expect(runCascadeImmediate(g, s, [choix(), bande(h, 'Bande')], { title: 'Jour', purpose: 'test', rowSurface: 'pv' })).toBeUndefined();
    expect(g().pendingCascade!.piloteImmediat).toEqual({ rowSurface: 'pv' });
    expect(auProcesVerbal(), 'une bande pas encore jouée est au compte rendu').toEqual([]);

    g().jetRegler('cascade', 'choix', 'a', 'decision');
    const done = advanceCascade(g, s)!;
    expect(done.participants[1].participants?.[0].result, 'la bande n’a pas été résolue à la reprise').toBeTruthy();
    expect(auProcesVerbal(), 'la bande commise par « Suivant » n’est pas au compte rendu du trajet').toEqual(['Bande']);
    expect(g().travelPlan!.procesVerbal![0].actorId).toBe(h.id);
    expect(desDeBrawnAuJournal(), 'la reprise a tracé au journal les dés d’une bande déclarée au PV').toEqual([]);
  });

  it('`rowSurface` déclarée au lancement, parquée au slot : « Tout lancer » écrit la bande au compte rendu du trajet à son commit', () => {
    const h = aBord();
    expect(runCascadeImmediate(g, s, [choix(), bande(h, 'Bande')], { title: 'Jour', purpose: 'test', rowSurface: 'pv' })).toBeUndefined();

    g().jetRegler('cascade', 'choix', 'a', 'decision');
    expect(resolveRemainingCascade(g, s)).toBeNull();
    expect(auProcesVerbal(), 'la bande commise par « Tout lancer » n’est nulle part de durable').toEqual(['Bande']);
    expect(desDeBrawnAuJournal()).toEqual([]);
  });

  it('`rowSurface` déclarée au lancement, parquée derrière un combat : les bandes d’avant y sont à l’arrêt, celles de la reprise s’y ajoutent', () => {
    const h = aBord();
    setClotureDeCascade(() => {});
    expect(runCascadeImmediate(g, s, [bande(h, 'Avant'), combat(), bande(h, 'Après')], { title: 'Jour', purpose: 'test', rowSurface: 'pv' })).toBeUndefined();
    expect(g().suspendedCascades.slice(-1)[0]!.piloteImmediat).toEqual({ rowSurface: 'pv' });
    expect(auProcesVerbal(), 'à l’arrêt, le compte rendu ne porte pas les bandes déjà jouées, et elles seules').toEqual(['Avant']);

    s({ battle: null });
    expect(resumeSuspendedCascade(g, s)).toBe(true);
    expect(auProcesVerbal(), 'la reprise n’a pas écrit sa bande, ou a récrit celle d’avant').toEqual(['Avant', 'Après']);
    expect(desDeBrawnAuJournal()).toEqual([]);
  });

  it('SANS `rowSurface`, même reprise derrière un combat : le journal porte le dé de la bande, le compte rendu du trajet n’en reçoit rien', () => {
    const h = aBord();
    setClotureDeCascade(() => {});
    expect(runCascadeImmediate(g, s, [combat(), bande(h, 'Après')], { title: 'Jour', purpose: 'test' })).toBeUndefined();
    s({ battle: null });
    expect(resumeSuspendedCascade(g, s)).toBe(true);
    expect(desDeBrawnAuJournal(), 'la bande sans surface déclarée n’a pas tracé son dé').toHaveLength(1);
    expect(auProcesVerbal()).toEqual([]);
  });

  it('lancé SANS contexte : un combat ouvert en plein vol après la décision arrête la boucle sans rien empiler', () => {
    const steps: CascadeStep[] = [choix(), { id: 'combat', kind: cleDeFixture('repriseCombat'), label: fixtureText('Combat') }, { id: 'reste', kind: cleDeFixture('repriseNeutre'), label: fixtureText('Reste') }];
    expect(runCascadeImmediate(g, s, steps)).toBeUndefined();
    expect(g().pendingCascade!.piloteImmediat).toEqual({ sansContexte: true });

    g().jetRegler('cascade', 'choix', 'a', 'decision');
    advanceCascade(g, s);
    expect(g().battle, 'l’applier n’a pas ouvert son combat').toBeTruthy();
    expect(g().suspendedCascades, 'la reprise a empilé une séquence que son lancement n’aurait pas empilée').toEqual([]);
  });
});

/**
 * Les CLÔTURES (#1508, #2689) : la suite d'une étape est une liste de `Cloture` — des VERBES
 * sérialisables (le `pendingCascade` est sauvegardé et voyage sur le réseau). La table `clotures` est
 * totale au type ; un verbe venu d'une donnée hors union lève.
 */
describe('#1508 — un verbe de clôture inconnu lève', () => {
  it('un verbe INCONNU lève au lieu de se perdre en silence', () => {
    expect(() => jouerLesClotures(banc.getState, banc.setState, [{ verbe: 'verbeQuiNExistePas' } as never]))
      .toThrow(/sans applier/);
  });
});
