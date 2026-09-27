import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { combatStakeRef } from '../data';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { startCascade, registerCascadeApplier, stepInteraction, stepReady, buildConsequenceSteps, runCascadeImmediate, pushStep, stepOpposedFreeze, advanceCascade, resolveRemainingCascade, compteurDeSequence } from './cascade';
import { freeCons, monoStep, displayStep, type BuiltCascadeStep } from './rollSeam';
import { spyApplier } from './cascadeTestKit';
import { journaliser } from './combatLog';
import type { CascadeStep, BatchParticipant } from './pendings';
import type { Combatant } from '../engine/types';

/**
 * CASCADE séquentielle influençable (jets de NUIT / VOYAGE) — cœur générique. 3ᵉ consommateur de la
 * fabrique UNIQUE de jet, SÉQUENTIEL comme le Test Étendu mais avec une conséquence PROPRE par étape
 * (registre `cascadeAppliers`) et insertion dynamique d'étapes (dépendance abri → Exposition).
 */
describe('Cascade séquentielle influençable', () => {
  const applied: { kind: string; success: boolean }[] = [];
  beforeEach(() => {
    applied.length = 0;
    useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    // Conséquence synthétique : enregistre l'étape validée + une ligne de journal.
    spyApplier('tally', applied, (step) => ({ kind: step.kind, success: !!step.result?.success }),
      (step) => ({ consequences: freeCons([`${step.label} → ${step.result?.success ? 'réussi' : 'raté'}`]) }));
  });

  function hero() {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brawn', seed: 1 });
    h.fortune = 2; h.resilience = 1;
    useGame.setState({ party: [h] });
    return h;
  }
  const step = (id: string, actorId: string, target = 55): CascadeStep =>
    ({ id, kind: 'tally', actorId, label: fixtureText(id), rollLabel: 'Résistance', base: target, target, result: null});

  it('présente une étape à la fois, applique chaque conséquence dans l’ordre, puis finalise', () => {
    useGame.getState().seedRng(3);
    const h = hero();
    startCascade(useGame.getState, useGame.setState, {
      title: 'Nuit', purpose: 'test', steps: [step('s1', h.id), step('s2', h.id)],
    });
    // Étape 1 : seule l'étape COURANTE (cursor) est active.
    expect(useGame.getState().pendingCascade!.cursor).toBe(0);
    useGame.getState().cascadeRoll('s1');
    expect(useGame.getState().pendingCascade!.participants[0].result).toBeTruthy();
    useGame.getState().cascadeNext(); // valide s1 → conséquence appliquée, avance sur s2
    expect(applied).toHaveLength(1);
    expect(useGame.getState().pendingCascade!.cursor).toBe(1);
    // Étape 2 → fin de cascade.
    useGame.getState().cascadeRoll('s2');
    useGame.getState().cascadeNext();
    expect(applied).toHaveLength(2);
    expect(useGame.getState().pendingCascade).toBeNull(); // finalisée
    expect(useGame.getState().journal.some((l) => l.startsWith('s1'))).toBe(true); // journal des conséquences
  });

  it('« Étape suivante » est un no-op tant que l’étape courante n’est pas lancée', () => {
    const h = hero();
    startCascade(useGame.getState, useGame.setState, { title: 'Nuit', purpose: 'test', steps: [step('s1', h.id)] });
    useGame.getState().cascadeNext(); // pas encore lancé → rien ne se passe
    expect(applied).toHaveLength(0);
    expect(useGame.getState().pendingCascade!.cursor).toBe(0);
  });

  it('une conséquence peut INSÉRER des étapes suivantes (dépendance abri → Exposition)', () => {
    useGame.getState().seedRng(5);
    const h = hero();
    spyApplier('shelter', applied, (step) => ({ kind: step.kind, success: !!step.result?.success }),
      // Abri raté → 2 jets d'Exposition insérés ; réussi → aucun.
      (step) => ({ insert: step.result?.success ? [] : [step1Insert(h, 'expo-a'), step1Insert(h, 'expo-b')] }));
    // Une étape insérée passe par un mint de la porte (`insert` n'accepte aucun littéral) : valeur
    // FOURNIE (40) à Intermédiaire (+0) — base 40, cible 40, comme le montage à la main d'avant.
    function step1Insert(actor: Combatant, id: string): BuiltCascadeStep {
      return monoStep({ id, kind: 'tally', actor, label: fixtureText(id), rollLabel: 'Résistance', difficulty: 'intermediaire', stake: combatStakeRef('fatigue'), ligne: { valeur: 40, valeurEtrangere: true } })!;
    }
    // Abri FORCÉ raté (dé 99) → insère 2 étapes d'Exposition.
    const shelter: CascadeStep = { id: 'abri', kind: 'shelter', actorId: h.id, label: fixtureText('Abri'), rollLabel: 'Survie', base: 40, target: 40, result: { roll: 99, target: 40, sl: -5, success: false }};
    startCascade(useGame.getState, useGame.setState, { title: 'Camp', purpose: 'test', steps: [shelter] });
    expect(useGame.getState().pendingCascade!.participants).toHaveLength(1);
    useGame.getState().cascadeNext(); // valide l'abri raté → +2 étapes
    expect(useGame.getState().pendingCascade!.participants).toHaveLength(3); // abri + 2 Exposition
    expect(useGame.getState().pendingCascade!.cursor).toBe(1); // on enchaîne sur la 1ʳᵉ insérée
  });

  it('« Tout lancer » résout d’office les étapes restantes puis montre le BILAN avant fermeture', () => {
    useGame.getState().seedRng(9);
    const h = hero();
    startCascade(useGame.getState, useGame.setState, {
      title: 'Nuit', purpose: 'test', steps: [step('s1', h.id), step('s2', h.id), step('s3', h.id)],
    });
    useGame.getState().cascadeResolveAll(); // auto-résout s1..s3
    expect(applied).toHaveLength(3); // toutes les conséquences se sont appliquées
    // BILAN : la modale reste ouverte (curseur EN FIN) pour voir les conséquences, avant fermeture explicite.
    expect(useGame.getState().pendingCascade!.cursor).toBe(3);
    useGame.getState().cascadeFinish(); // « Terminer » ferme
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('mêmes verbes d’influence : la Chance relance une étape propre ratée', () => {
    const h = hero();
    const failed: CascadeStep = { id: 's1', kind: 'tally', actorId: h.id, label: fixtureText('s1'), rollLabel: 'Résistance', base: 30, target: 30, result: { roll: 88, target: 30, sl: -5, success: false }, rerolled: false};
    startCascade(useGame.getState, useGame.setState, { title: 'Nuit', purpose: 'test', steps: [failed] });
    useGame.getState().cascadeReroll('s1');
    expect(useGame.getState().party[0].fortune).toBe(1); // 1 Point de Chance dépensé
    // Résilience : étape garantie réussie.
    useGame.getState().cascadeForceSuccess('s1');
    expect(useGame.getState().pendingCascade!.participants[0].result!.success).toBe(true);
    expect(useGame.getState().party[0].resilience).toBe(0);
  });

  it('stepInteraction / stepReady : type d’interaction inféré des champs', () => {
    const jet: CascadeStep = { id: 'j', kind: 'tally', actorId: 'x', rollLabel: 'R', base: 30, target: 30, result: null};
    const choix: CascadeStep = { id: 'c', kind: 'pick', actorId: 'x', options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }]};
    const aff: CascadeStep = { id: 'd', kind: 'note', actorId: 'x'};
    expect(stepInteraction(jet)).toBe('jet');
    expect(stepInteraction(choix)).toBe('choix');
    expect(stepInteraction(aff)).toBe('affichage');
    expect(stepReady(jet)).toBe(false);
    expect(stepReady({ ...jet, result: { roll: 10, target: 30, sl: 2, success: true } })).toBe(true);
    expect(stepReady(choix)).toBe(false);
    expect(stepReady({ ...choix, chosen: 'a' })).toBe(true);
    expect(stepReady(aff)).toBe(true);
  });

  it('étape « choix » : no-op sans choix, puis l’option pilote la conséquence + insertion', () => {
    const h = hero();
    spyApplier('pick', applied, (step) => ({ kind: step.kind, success: step.chosen === 'devier' }),
      (step) => (step.chosen === 'devier' ? { insert: [displayStep({ id: 'suite', kind: 'note', actorId: h.id, label: fixtureText('Suite')})] } : {}));
    spyApplier('note', applied, (step) => ({ kind: step.kind, success: true }), (step) => ({ consequences: freeCons([`${step.id}`]) }));
    const choix: CascadeStep = { id: 'c', kind: 'pick', actorId: h.id, options: [{ key: 'devier', label: fixtureText('Dévier') }, { key: 'subir', label: fixtureText('Subir') }]};
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [choix] });
    useGame.getState().cascadeNext(); // pas de choix → no-op
    expect(applied).toHaveLength(0);
    expect(useGame.getState().pendingCascade!.cursor).toBe(0);
    useGame.getState().cascadeChoose('c', 'devier');
    expect(useGame.getState().pendingCascade!.participants[0].chosen).toBe('devier');
    useGame.getState().cascadeNext(); // valide → applier voit 'devier' + insère 'suite'
    expect(applied[0]).toEqual({ kind: 'pick', success: true });
    expect(useGame.getState().pendingCascade!.participants).toHaveLength(2);
    expect(useGame.getState().pendingCascade!.cursor).toBe(1);
  });

  it('étape « affichage » : validée sans jet ni choix', () => {
    const h = hero();
    spyApplier('note', applied, () => ({ kind: 'note', success: true }), (step) => ({ consequences: freeCons([`${step.id}`]) }));
    const aff: CascadeStep = { id: 'd', kind: 'note', actorId: h.id};
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [aff] });
    useGame.getState().cascadeNext(); // affichage → acquitté directement, cascade finalisée
    expect(applied).toEqual([{ kind: 'note', success: true }]);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('« Tout résoudre » résout les étapes auto mais S\'ARRÊTE sur un CHOIX (pas d\'auto-tranche)', () => {
    useGame.getState().seedRng(7);
    const h = hero();
    spyApplier('pick', applied, (step) => ({ kind: 'pick', success: step.chosen === 'a' }));
    spyApplier('note', applied, () => ({ kind: 'note', success: true }));
    const steps: CascadeStep[] = [
      step('s1', h.id), // jet (tally) — auto-résolu
      { id: 'c', kind: 'pick', actorId: h.id, options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }]}, // CHOIX → STOP
      { id: 'd', kind: 'note', actorId: h.id}, // affichage (pas atteint tant que le choix n'est pas tranché)
    ];
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps });
    useGame.getState().cascadeResolveAll();
    expect(applied.map((a) => a.kind)).toEqual(['tally']); // le jet est résolu, on S'ARRÊTE sur le choix
    expect(useGame.getState().pendingCascade!.cursor).toBe(1); // curseur SUR le choix (le joueur doit trancher)
    // Le joueur tranche → on enchaîne le reste.
    useGame.getState().cascadeChoose('c', 'a');
    useGame.getState().cascadeNext(); // valide le choix → affichage
    useGame.getState().cascadeNext(); // valide l'affichage → fin
    expect(applied.map((a) => a.kind)).toEqual(['tally', 'pick', 'note']);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('runCascadeImmediate : CHOIX sans `defaultChoice` authoré → S\'ARRÊTE PENDANTE (jamais `options[0]` en silence, #351)', () => {
    useGame.getState().seedRng(7);
    const h = hero();
    spyApplier('pick', applied, (step) => ({ kind: 'pick', success: step.chosen === 'a' }));
    spyApplier('note', applied, () => ({ kind: 'note', success: true }));
    const steps: CascadeStep[] = [
      step('s1', h.id), // jet (tally) — auto-résolu
      { id: 'c', kind: 'pick', actorId: h.id, options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }]}, // CHOIX sans défaut → STOP
      { id: 'd', kind: 'note', actorId: h.id}, // jamais atteint
    ];
    const resolved = runCascadeImmediate(useGame.getState, useGame.setState, steps);
    expect(applied.map((a) => a.kind)).toEqual(['tally']); // seul le jet est résolu
    expect(resolved.map((s) => s.id)).toEqual(['s1', 'c', 'd']); // renvoyé tel quel (préfixe committé + reste)
    // La cascade est SURFACÉE (pas résolue en aveugle) — le joueur/l'appelant la reprend.
    const p = useGame.getState().pendingCascade!;
    expect(p).toBeTruthy();
    expect(p.cursor).toBe(1); // curseur SUR le choix
    expect(p.participants.map((s) => s.id)).toEqual(['s1', 'c', 'd']);
  });

  it('runCascadeImmediate : CHOIX avec `defaultChoice` authoré → tranché sans surfacer (comportement inchangé)', () => {
    useGame.getState().seedRng(7);
    const h = hero();
    spyApplier('pick', applied, (step) => ({ kind: 'pick', success: step.chosen === 'a' }));
    const steps: CascadeStep[] = [
      { id: 'c', kind: 'pick', actorId: h.id, options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }], defaultChoice: 'a'},
    ];
    const resolved = runCascadeImmediate(useGame.getState, useGame.setState, steps);
    expect(applied).toEqual([{ kind: 'pick', success: true }]); // défaut authoré appliqué
    expect(resolved[0].chosen).toBe('a');
    expect(useGame.getState().pendingCascade).toBeNull(); // rien à surfacer
  });

  it('étape « affichage » : contenu pré-posé (outcome) PRÉSERVÉ par un applier muet', () => {
    const h = hero();
    registerCascadeApplier('reveal', () => {}); // applier MUET (mutation seule, aucun journal)
    spyApplier('note', applied, () => ({ kind: 'note', success: true }));
    const steps: CascadeStep[] = [
      { id: 'r', kind: 'reveal', actorId: h.id, outcome: [{ text: 'Sonné appliqué (Assommante)' }]}, // affichage
      { id: 'd', kind: 'note', actorId: h.id},
    ];
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps });
    useGame.getState().cascadeNext(); // valide l'affichage → figé, avance sur 'd'
    const committed = useGame.getState().pendingCascade!.participants[0];
    expect(committed.committed).toBe(true);
    expect(committed.outcome).toEqual([{ text: 'Sonné appliqué (Assommante)' }]); // contenu pré-posé NON effacé
  });

  it('étape « batch » (participants — seam de jet #275 Décision 4 cran 1) : agrège les contributeurs à la validation', () => {
    useGame.getState().seedRng(11);
    const h1 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Timonier', seed: 2 });
    const h2 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vigie', seed: 3 });
    useGame.setState({ party: [h1, h2] });
    spyApplier('crew-batch', applied, (step) => ({ kind: step.kind, success: !!step.result?.success }),
      (step) => ({ consequences: freeCons([`${step.label} → DR ${step.result?.sl}`]) }));
    const participants: BatchParticipant[] = [
      { id: h1.id, label: 'Timonier', essential: true, interactive: true, base: 40, target: 40, result: null },
      { id: h2.id, label: 'Vigie', essential: false, interactive: true, base: 40, target: 40, result: null },
    ];
    // Deux porteurs → possession de GROUPE (`bandStep`/`buildBatchStep`) : une bande anonyme n'entre
    // plus dans une séquence (#1262 V2 L4, `assertBandeDeclarePossession`).
    const batch: CascadeStep = { id: 'progression', kind: 'crew-batch', label: fixtureText('Progression'), groupOwner: true, participants, result: null};
    startCascade(useGame.getState, useGame.setState, { title: 'Voyage', purpose: 'test', steps: [batch] });
    expect(stepInteraction(useGame.getState().pendingCascade!.participants[0])).toBe('batch');
    expect(stepReady(useGame.getState().pendingCascade!.participants[0])).toBe(false); // aucun participant lancé
    useGame.getState().cascadeNext(); // batch pas prêt → no-op (aucun participant lancé)
    expect(applied).toHaveLength(0);
    useGame.getState().cascadeBatchRoll(h1.id);
    expect(stepReady(useGame.getState().pendingCascade!.participants[0])).toBe(false); // h2 pas encore lancé
    useGame.getState().cascadeBatchRoll(h2.id);
    expect(stepReady(useGame.getState().pendingCascade!.participants[0])).toBe(true);
    useGame.getState().cascadeNext(); // agrège (essentiel ×2, MDG 14 l.19) puis applique
    expect(applied).toHaveLength(1);
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(useGame.getState().journal.some((l) => l.startsWith('Progression → DR'))).toBe(true);
  });

  /**
   * `dejaDites` (#1508) — l'applier qui déclenche LUI-MÊME une continuation écrivante dit sa conclusion
   * AVANT elle, par `journaliser`, et DÉCLARE au goulot de ne pas la ré-écrire. Le drapeau DÉSIGNE donc
   * des lignes : sans elles il ne protège rien, il coupe seulement le journal (compense #1881).
   */
  it('`dejaDites` : les conséquences rendues sont AFFICHÉES sur l’étape, et écrites au journal UNE fois', () => {
    const h = hero();
    registerCascadeApplier('deja', (get, set) => {
      journaliser(get, set, ['la conclusion, dite par l’applier'], 'info', { actorId: h.id });
      return { consequences: freeCons(['la conclusion, dite par l’applier']), dejaDites: true };
    });
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [{ id: 'd', kind: 'deja', actorId: h.id }] });
    useGame.getState().cascadeNext();
    expect(useGame.getState().journal.filter((l) => l === 'la conclusion, dite par l’applier'),
      'le goulot ne la ré-écrit pas').toHaveLength(1);
  });

  it('`dejaDites` SANS conséquence à désigner : refus nommé (le drapeau ne remplace pas une conclusion)', () => {
    const h = hero();
    registerCascadeApplier('dejaVide', () => ({ dejaDites: true }));
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [{ id: 'v', kind: 'dejaVide', actorId: h.id }] });
    expect(() => useGame.getState().cascadeNext()).toThrow(/dejaDites.*sans conclusion à désigner/s);
  });

  it('buildConsequenceSteps : groupes non vides → étapes d’affichage (outcome pré-posé), vides ignorés', () => {
    const steps = buildConsequenceSteps([
      { kind: 'miscast', label: 'Imparfaite', icon: '💥', lines: ['Le Vent se déchaîne.', 'L’incantateur perd 3 PB.'], actorId: 'x' },
      { kind: 'effet', label: 'Effets', lines: [] }, // vide → ignoré
      { kind: 'effet', label: 'Effets', icon: '✨', lines: ['Cible Aveuglée 2 rounds.'] },
    ]);
    expect(steps.map((s) => s.kind)).toEqual(['miscast', 'effet']);
    expect(steps[0].outcome).toEqual([{ text: 'Le Vent se déchaîne.' }, { text: 'L’incantateur perd 3 PB.' }]);
    expect(stepInteraction(steps[0])).toBe('affichage'); // ni target ni options
    expect(steps[0].actorId).toBe('x');
    expect(steps[1].outcome).toEqual([{ text: 'Cible Aveuglée 2 rounds.' }]);
  });

  it('liveMerge : un applier qui APPEND une étape (conséquence foldée) la préserve à la validation', () => {
    const h = hero();
    // Simule une conséquence FOLDÉE (déviation) : son applier re-déclenche le reste de l'attaque, qui
    // APPEND une étape au pending (via set, comme pushReveal). advanceCascade doit la préserver.
    registerCascadeApplier('trigger', (get, set) => {
      const pc = get().pendingCascade!;
      set({ pendingCascade: { ...pc, participants: [...pc.participants, { id: 'appended', kind: 'note', actorId: h.id, outcome: [{ text: 'conséquence ajoutée' }]}] } });
      return {};
    });
    spyApplier('note', applied, () => ({ kind: 'note', success: true }));
    const trig: CascadeStep = { id: 't', kind: 'trigger', actorId: h.id, outcome: [{ text: 'déclencheur' }]};
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [trig] });
    useGame.getState().cascadeNext(); // valide 'trigger' → APPEND 'appended' ; le pending NE se ferme PAS
    const p = useGame.getState().pendingCascade;
    expect(p).toBeTruthy(); // pas finalisé : l'étape appendée est conservée
    expect(p!.participants.map((s) => s.id)).toEqual(['t', 'appended']);
    expect(p!.cursor).toBe(1); // curseur sur l'étape appendée
  });

  // DOCTRINE DU SLOT (#942 L1) : `pendingCascade` porte UNE séquence et rien n'y est jamais écrasé —
  // append à même `purpose` (bilan compris), suspension sinon, REPRISE à la clôture. Tout est joué par
  // les VRAIES coutures du store (`cascadeRoll`/`cascadeNext`/`cascadeResolveAll`/`cascadeFinish`) : la
  // reprise n'est jamais simulée à la main.
  describe('doctrine du slot : aucun écrasement (#942 L1)', () => {
    /** Résout puis TERMINE la séquence en place par les vraies actions du store (bouton « Tout lancer »
     *  puis « Terminer ») — c'est `dispatchCascadeDone` qui s'exécute, dénouement et reprise compris. */
    const terminerEnPlace = () => {
      useGame.getState().cascadeResolveAll();
      useGame.getState().cascadeFinish();
    };

    it('MÊME purpose sur une séquence ACTIVE : les étapes sont APPENDUES, aucune perdue', () => {
      const h = hero();
      startCascade(useGame.getState, useGame.setState, { title: 'Nuit', purpose: 'test', steps: [step('s1', h.id), step('s2', h.id)] });
      startCascade(useGame.getState, useGame.setState, { title: 'Halte', purpose: 'test', steps: [step('s3', h.id)] });
      const p = useGame.getState().pendingCascade!;
      expect(p.participants.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
      expect(p.cursor).toBe(0); // la séquence en vol garde sa place
      expect(useGame.getState().suspendedCascades).toHaveLength(0);
    });

    it('MÊME purpose : les bornes de dénouement et le journal des deux fragments sont RÉUNIS', () => {
      const h = hero();
      startCascade(useGame.getState, useGame.setState, { title: 'Voyage', purpose: 'travelDay', steps: [step('s1', h.id)], log: ['a'], travelHalt: true });
      startCascade(useGame.getState, useGame.setState, { title: 'Fin de Round', purpose: 'travelDay', steps: [step('s2', h.id)], log: ['b'], roundBoundary: true });
      const p = useGame.getState().pendingCascade!;
      expect(p.travelHalt).toBe(true);
      expect(p.roundBoundary).toBe(true); // la borne du fragment appendu survit
      expect(p.log).toEqual(['a', 'b']);
    });

    it('MÊME purpose sur un BILAN : la séquence est RÉOUVERTE (append), son dénouement n’est pas jeté', () => {
      const h = hero();
      startCascade(useGame.getState, useGame.setState, { title: 'Nuit', purpose: 'test', steps: [step('s1', h.id)], travelHalt: true });
      useGame.getState().cascadeResolveAll(); // → BILAN : curseur en fin, en attente du « Terminer »
      expect(useGame.getState().pendingCascade!.cursor).toBe(1);
      startCascade(useGame.getState, useGame.setState, { title: 'Autre', purpose: 'test', steps: [step('s9', h.id)] });
      const p = useGame.getState().pendingCascade!;
      expect(p.participants.map((s) => s.id)).toEqual(['s1', 's9']); // le bilan n'est PAS remplacé
      expect(p.cursor).toBe(1); // curseur sur l'étape appendée : la séquence est de nouveau JOUABLE
      expect(p.travelHalt).toBe(true); // le dénouement du fragment terminé survit jusqu'au « Terminer » fusionné
      expect(useGame.getState().suspendedCascades).toHaveLength(0);
    });

    it('purpose DIFFÉRENT : la séquence en vol est PARQUÉE, et REPRISE par la clôture de l’autre (vraie couture)', () => {
      const h = hero();
      startCascade(useGame.getState, useGame.setState, { title: 'Voyage', purpose: 'travelDay', steps: [step('s1', h.id), step('s2', h.id)], travelHalt: true });
      useGame.getState().cascadeRoll('s1'); // la 1ʳᵉ étape est déjà lancée : son jet ne doit pas disparaître
      const roll = useGame.getState().pendingCascade!.participants[0].result;
      startCascade(useGame.getState, useGame.setState, { title: 'Test de scène', purpose: 'test', steps: [step('t1', h.id)] });
      expect(useGame.getState().pendingCascade!.participants.map((s) => s.id)).toEqual(['t1']);
      expect(useGame.getState().suspendedCascades).toHaveLength(1);
      // CLÔTURE de la séquence 'test' par les vraies actions → `dispatchCascadeDone` reprend la parquée.
      terminerEnPlace();
      const back = useGame.getState().pendingCascade;
      expect(back, 'la séquence parquée doit revenir dans le slot à la clôture').toBeTruthy();
      expect(back!.purpose).toBe('travelDay');
      expect(back!.participants.map((s) => s.id)).toEqual(['s1', 's2']); // aucune étape perdue
      expect(back!.participants[0].result).toEqual(roll); // ni le jet déjà lancé
      expect(back!.cursor).toBe(0);
      expect(back!.travelHalt).toBe(true); // sa borne de dénouement est intacte
      expect(useGame.getState().suspendedCascades).toHaveLength(0);
    });

    it('BILAN d’un AUTRE purpose : parqué (jamais jeté) puis repris à la clôture, prêt à être terminé', () => {
      const h = hero();
      startCascade(useGame.getState, useGame.setState, { title: 'Journée', purpose: 'travelDay', steps: [step('s1', h.id)], travelHalt: true });
      useGame.getState().cascadeResolveAll(); // bilan travelDay en attente de « Terminer »
      startCascade(useGame.getState, useGame.setState, { title: 'Test de scène', purpose: 'test', steps: [step('t1', h.id)] });
      expect(useGame.getState().suspendedCascades[0]?.purpose).toBe('travelDay');
      terminerEnPlace(); // clôture du 'test' → reprise du bilan parqué
      const back = useGame.getState().pendingCascade!;
      expect(back.purpose).toBe('travelDay');
      expect(back.travelHalt).toBe(true);
      expect(back.cursor).toBe(1); // toujours son BILAN : « Terminer » jouera son dénouement
    });

    it('une séquence ouverte PAR un applier (purpose différent) ne perd pas les étapes restantes', () => {
      const h = hero();
      // L'applier ouvre une séquence d'un AUTRE purpose (patron `sceneTest` déclenché par une étape de voyage).
      registerCascadeApplier('opens', (get, set) => {
        startCascade(get, set, { title: 'Test de scène', purpose: 'test', steps: [step('inner', h.id)] });
        return {};
      });
      const outer: CascadeStep = { id: 'day', kind: 'opens', actorId: h.id, outcome: [{ text: 'journée' }]};
      startCascade(useGame.getState, useGame.setState, { title: 'Journée', purpose: 'travelDay', steps: [outer, step('later', h.id)] });
      useGame.getState().cascadeNext(); // valide 'day' → l'applier prend le slot
      expect(useGame.getState().pendingCascade!.purpose).toBe('test'); // la nouvelle séquence tient le slot
      expect(useGame.getState().pendingCascade!.participants.map((s) => s.id)).toEqual(['inner']);
      const stack = useGame.getState().suspendedCascades;
      expect(stack).toHaveLength(1);
      expect(stack[0].participants.map((s) => s.id)).toEqual(['day', 'later']); // 'later' n'est PAS perdue
      expect(stack[0].participants[0].committed).toBe(true); // 'day' reste validée
      expect(stack[0].cursor).toBe(1);
      // Et la clôture de la séquence interne rend le slot à la journée, sur l'étape 'later'.
      terminerEnPlace();
      expect(useGame.getState().pendingCascade!.participants[useGame.getState().pendingCascade!.cursor].id).toBe('later');
    });

    it('pushStep suit la MÊME doctrine : append à même purpose, PARQUE l’autre (jamais un écrasement)', () => {
      const h = hero();
      pushStep(useGame.setState, { id: 'p1', kind: 'note', actorId: h.id, label: fixtureText('Surprise')}, 'combat');
      expect(useGame.getState().pendingCascade!.title).toBe('Surprise'); // l'étape prête son label au titre
      pushStep(useGame.setState, { id: 'p2', kind: 'note', actorId: h.id}, 'combat');
      expect(useGame.getState().pendingCascade!.participants.map((s) => s.id)).toEqual(['p1', 'p2']);
      // purpose DIFFÉRENT : la séquence de combat est PARQUÉE, pas remplacée (contrat inverse de l'ancien).
      pushStep(useGame.setState, { id: 'p3', kind: 'note', actorId: h.id, label: fixtureText('Voyage')}, 'travelDay');
      expect(useGame.getState().pendingCascade!.purpose).toBe('travelDay');
      expect(useGame.getState().pendingCascade!.participants.map((s) => s.id)).toEqual(['p3']);
      const stack = useGame.getState().suspendedCascades;
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
  const g = useGame.getState;
  const s = useGame.setState;
  let joues: string[] = [];
  let erreurs: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    joues = [];
    s({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    erreurs = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { erreurs.mockRestore(); });

  // `fenP` ouvre, pendant qu'il s'applique, UNE étape de la même séquence par `startCascade` ; son id
  // vient du compteur de la séquence (`compteurDeSequence`), comme tout mint.
  registerCascadeApplier('fenP', (get, set, step) => {
    joues.push(step.id);
    const id = `sc-${compteurDeSequence(get(), 'test')}`;
    startCascade(get, set, { title: 'T', purpose: 'test', steps: [{ id, kind: 'fenF', label: fixtureText('F') }] });
  });
  registerCascadeApplier('fenF', (_g, _s, step) => { joues.push(step.id); });
  // `fenB` ouvre, sous applier, un fragment qui porte une BORNE et une ligne de `log`.
  registerCascadeApplier('fenB', (get, set, step) => {
    joues.push(step.id);
    startCascade(get, set, { title: 'T', purpose: 'test', steps: [{ id: 'borne', kind: 'fenF', label: fixtureText('F') }], roundBoundary: true, log: ['ligne du fragment'] });
  });
  const trois = (): CascadeStep[] => [
    { id: 'a', kind: 'fenP', label: fixtureText('a') },
    { id: 'c', kind: 'fenP', label: fixtureText('c') },
    { id: 'b', kind: 'fenF', label: fixtureText('b') },
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
      { id: 'x', kind: 'fenB', label: fixtureText('x') },
      { id: 'fin', kind: 'fenF', label: fixtureText('fin'), options: [{ key: 'o', label: fixtureText('o') }] },
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

  it('immédiat ALLÉ AU BOUT avec une borne collectée : aucun slot ne la porte, la levée la NOMME', () => {
    const seul = (): CascadeStep[] => [{ id: 'x', kind: 'fenB', label: fixtureText('x') }];
    expect(() => runCascadeImmediate(g, s, seul(), { title: 'T', purpose: 'test' })).toThrow(/bornes collectées \(roundBoundary\)/);
    expect(erreurs).toHaveBeenCalledTimes(1);
  });
});
