import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { openSequence, displayStep, monoStep } from '../noyau/rollSeam';
import { registerCascadeApplier, startCascade, advanceCascade, resumeSuspendedCascade } from '../noyau/cascade';
import { seedBattleRng } from '../noyau/battleRng';
import { setCadence, resetCadence } from '../engine/cadence';
import { makePregens } from '../data/pregens';
import { voyageStakeRef } from '../data';
import { fixtureText } from '../i18n/fixtureText';
import type { BuiltCascadeStep } from '../noyau/rollSeam';

/**
 * LE CONTRAT DU SOCLE DE SÉQUENCE (#1479), sur ses DEUX bords :
 *
 *  (1) `openSequence` rend les étapes RÉSOLUES — ou RIEN. Le pilote immédiat peut s'arrêter en vol
 *      (un applier ouvre un combat, un choix n'a pas de défaut authoré) : rendre ce préfixe comme
 *      « séquence résolue » fait ENCHAÎNER l'appelant sur un dénouement que la reprise rejouera
 *      ensuite — la continuation partait DEUX fois. La garde vit dans `openSequence`, une fois, jamais
 *      recopiée chez les appelants. Derrière un combat, la séquence ENTIÈRE est parquée, curseur posé
 *      derrière l'étape jouée : le combat clos, le pilote la reprend depuis ce curseur — aucune étape
 *      rejouée, un seul dénouement.
 *
 *  (2) PARITÉ DE TRACE — un dé posé D'OFFICE par le curseur (`poserLeCurseur`, aucun siège humain ne
 *      tient l'étape) laisse la MÊME trace que celui du pilote immédiat : sa ligne de journal.
 *      « A partir du moment ou je dois faire un jet, il doit apparaitre » (utilisateur, 2026-08-24) —
 *      ce que le socle roule à la place du joueur, il le MONTRE.
 *
 *  (3) Un combat DÉJÀ ouvert au lancement n'interrompt pas le pilote immédiat : seul un combat qu'une
 *      étape OUVRE parque la séquence (`combatALEntree`).
 */

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);
const NET0 = get().net;

const KIND_INERTE = 'sonde-1479-inerte';
const KIND_OUVRE_COMBAT = 'sonde-1479-ouvre-combat';
const KIND_JET = 'sonde-1479-jet';

let apples = 0;
registerCascadeApplier(KIND_INERTE, () => { apples++; return {}; });
registerCascadeApplier(KIND_OUVRE_COMBAT, (_get, setter) => {
  apples++;
  // Ce que fait `startCombat` du point de vue de la garde : le slot appartient désormais à un AUTRE
  // contexte. La garde lit `get().battle` — inutile de monter un combat complet pour la mesurer.
  setter({ battle: { combatants: [], order: [], turn: 0, round: 1, log: [], over: null } as never });
  return {};
});
registerCascadeApplier(KIND_JET, () => ({}));

/** Les étapes d'AFFICHAGE de la sonde — porteur conduit par l'IA, donc AUCUN siège ne les tient. */
function sequenceDe(premierKind: string): BuiltCascadeStep[] {
  const [h] = get().party;
  return [
    displayStep({ id: 's1', kind: premierKind, actorId: h.id, label: fixtureText('Étape 1') })!,
    displayStep({ id: 's2', kind: KIND_INERTE, actorId: h.id, label: fixtureText('Étape 2') })!,
  ];
}

beforeEach(() => {
  apples = 0;
  seedBattleRng(7);
  resetCadence();
  const party = makePregens().slice(0, 1).map((h) => ({ ...h, aiControlled: true }));
  set({ party, battle: null, pendingCascade: null, suspendedCascades: [], journal: [] } as never);
  set({ net: { ...NET0, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} } } as never);
});
afterEach(() => {
  resetCadence();
  set({ net: NET0, battle: null, pendingCascade: null, suspendedCascades: [] } as never);
});

describe('#1479 — `openSequence` ne rend JAMAIS un préfixe pour une séquence résolue', () => {
  it('séquence INTERROMPUE en vol (combat ouvert par l’applier) : rien n’est rendu, la séquence ENTIÈRE est parquée, et reprend UNE fois depuis son curseur', () => {
    let continuations = 0;
    const resolues = openSequence(get, set, {
      title: 'Sonde', purpose: 'test', steps: sequenceDe(KIND_OUVRE_COMBAT),
    });
    if (resolues) continuations++; // le patron d'appel réel : « j'ai mes lignes, je joue mon dénouement »
    expect(resolues, 'un PRÉFIXE n’est pas une séquence résolue').toBeUndefined();
    expect(continuations, 'l’appelant n’a pas enchaîné sa continuation').toBe(0);
    expect(apples, 'seule la 1ʳᵉ étape a été appliquée').toBe(1);
    expect(get().suspendedCascades, 'la séquence est parquée derrière le combat, une fois').toHaveLength(1);
    const [parque] = get().suspendedCascades;
    expect(parque.participants.map((s) => s.id), 'la séquence ENTIÈRE est parquée').toEqual(['s1', 's2']);
    expect(parque.cursor, 'le curseur est posé derrière l’étape jouée').toBe(1);
    expect(parque.participants[0].committed, 's1 est jouée avant le parcage').toBe(true);
    expect(parque.piloteImmediat, 'le contexte de lancement voyage avec la séquence').toEqual({});

    set({ battle: null } as never);
    expect(resumeSuspendedCascade(get, set)).toBe(true);
    expect(apples, 's1 n’est pas rejouée, s2 est jouée une fois').toBe(2);
    expect(get().pendingCascade, 'la reprise du pilote n’ouvre aucune fenêtre').toBeNull();
    expect(get().suspendedCascades, 'la pile est vide').toEqual([]);
  });

  it('CONTRÔLE POSITIF — la MÊME séquence, sans interruption, rend bien ses étapes RÉSOLUES', () => {
    const resolues = openSequence(get, set, {
      title: 'Sonde', purpose: 'test', steps: sequenceDe(KIND_INERTE),
    });
    expect(resolues?.map((s) => s.id), 'aucune interruption : l’appelant reçoit ses lignes').toEqual(['s1', 's2']);
    expect(apples).toBe(2);
    expect(get().suspendedCascades).toHaveLength(0);
  });
});

describe('#1595 — un combat DÉJÀ ouvert n’interrompt pas le pilote immédiat', () => {
  it('séquence de plusieurs étapes jouée en combat : toutes appliquées, rien n’est parqué', () => {
    set({ battle: { combatants: [], order: [], turn: 0, round: 1, log: [], over: null } as never });
    openSequence(get, set, { title: 'Sonde', purpose: 'test', steps: sequenceDe(KIND_INERTE) });
    expect(apples, 'chaque étape est appliquée une fois').toBe(2);
    expect(get().suspendedCascades, 'aucune étape n’est parquée derrière le combat en cours').toEqual([]);
  });
});

describe('#1479 — PARITÉ DE TRACE : le dé posé d’office par le curseur a SA ligne de journal', () => {
  it('cadence DÉFÉRÉE, cascade OUVERTE : le mono-jet est roulé À LA POSE, tracé, et visible au bilan', () => {
    const [h] = get().party;
    const jet = monoStep({
      id: 'sonde-jet', kind: KIND_JET, actor: h, label: fixtureText('Jet de sonde'),
      difficulty: 'intermediaire', stake: voyageStakeRef('progression'),
      ligne: { valeur: 50 },
    })!;
    setCadence('rapide'); // cadence déférée à un automate → aucun siège ne tient l'étape
    startCascade(get, set, { title: 'Sonde', purpose: 'test', steps: [jet] });
    const pose = get().pendingCascade!.participants[0];
    expect(pose.result, 'le socle a roulé l’étape À LA POSE du curseur').toBeTruthy();
    const de = pose.result!.roll;
    const finalisee = advanceCascade(get, set);
    expect(finalisee, 'la séquence se dénoue — le curseur ne reste pas bloqué').toBeTruthy();
    expect(finalisee!.participants[0].result?.roll, 'le BILAN montre le dé qui a été joué').toBe(de);
    // La ligne dérivée par le socle porte le couple dé/cible (`traceLineOf`) — assez précis pour
    // qu'une ligne de journal quelconque ne la simule pas.
    const trace = get().journal.filter((l) => l.includes(`${de}/${pose.result!.target}`));
    expect(trace.length, `aucune ligne de journal pour le dé ${de} — un jet roulé par le socle serait muet`).toBe(1);
  });
});
