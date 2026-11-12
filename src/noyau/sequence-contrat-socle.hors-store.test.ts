import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet } from './etat';
import { openSequence, displayStep, monoStep } from './rollSeam';
import { startCascade, advanceCascade, resumeSuspendedCascade, sortirDeLHote, suspendActiveCascade, setClotureDeCascade } from './cascade';
import { runFlow, pushReveal } from './combatEffects';
import { dispatchCascadeDone } from './combatSlice';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import type { Set as SetFn } from './flowTypes';
import { seedBattleRng } from './battleRng';
import { setCadence } from '../engine/cadence';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { voyageStakeRef } from '../data';
import { fixtureText } from '../i18n/fixtureText';
import type { BuiltCascadeStep } from './stepBrand';
import { avecLesTables, cleDeFixture } from './noyau.testkit';
import { tablesDuJeu } from './tablesDuJeu';
import type { GenreDeCascade } from './tablesPosees';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

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

const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);
const NET0 = initialNet();

const KIND_INERTE = cleDeFixture('sonde-1479-inerte');
const KIND_OUVRE_COMBAT = cleDeFixture('sonde-1479-ouvre-combat');
const KIND_JET = cleDeFixture('sonde-1479-jet');
const KIND_OUVRE_FLOW = cleDeFixture('sonde-4006-ouvre-flow');
const KIND_REVELE = cleDeFixture('sonde-4006-revele');
const KIND_REVELE_A_PART = cleDeFixture('sonde-4006-revele-a-part');
const KIND_OUVRE_FLOW_PUIS_REVELE = cleDeFixture('sonde-4006-ouvre-flow-puis-revele');
const KIND_OUVRE_FLOW_PUIS_COMBAT = cleDeFixture('sonde-4006-ouvre-flow-puis-combat');

/** Le Flow que joue l'applier `KIND_OUVRE_FLOW`, posé par chaque test. */
let flowOuvert: Flow = { kind: 'sequence', etapes: [] };
/** Les clôtures `testRateDeLActeur` jouées, avec la profondeur de pile qu'elles voient. */
let ratesVus: { actorId: string; parquees: number }[] = [];

/** Le combat que voit la garde `combatALEntree` : elle lit `get().battle`, un combat complet est inutile. */
const COMBAT = { combatants: [], order: [], turn: 0, round: 1, log: [], over: null } as never;
/** Une révélation par l'émetteur unique (`pushReveal`) : elle rejoint la séquence en vol, ou ouvre la sienne (`own`). */
const reveler = (s: SetFn, own: boolean): void => pushReveal(s, { kind: 'effet', title: fixtureText('Révélation'), lines: [] }, { own });

let apples = 0;
beforeEach(() => { avecLesTables({ appliers: { ...tablesDuJeu().appliers, [KIND_INERTE]: () => { apples++; return {}; }, [KIND_OUVRE_COMBAT]: (_get, setter) => {
  apples++;
  // Ce que fait `lancerLeCombat` du point de vue de la garde : le slot appartient désormais à un AUTRE
  // contexte. La garde lit `get().battle` — inutile de monter un combat complet pour la mesurer.
  setter({ battle: COMBAT });
  return {};
}, [KIND_JET]: () => ({}), [KIND_OUVRE_FLOW]: (g, s) => {
  apples++;
  runFlow(g, s, flowOuvert);
  return {};
}, [KIND_REVELE]: (_g, s) => { apples++; reveler(s, false); return {}; },
[KIND_REVELE_A_PART]: (_g, s) => { apples++; reveler(s, true); return {}; },
[KIND_OUVRE_FLOW_PUIS_REVELE]: (g, s) => { apples++; runFlow(g, s, flowOuvert); reveler(s, true); return {}; },
[KIND_OUVRE_FLOW_PUIS_COMBAT]: (g, s) => {
  apples++;
  runFlow(g, s, flowOuvert);
  // `lancerLeCombat` du point de vue du slot et de la garde : la séquence en vol est parquée, le combat est ouvert.
  suspendActiveCascade(g, s);
  s({ battle: COMBAT });
  return {};
} }, clotures: { ...tablesDuJeu().clotures, testRateDeLActeur: (g, s, c) => {
  ratesVus.push({ actorId: c.actorId, parquees: g().suspendedCascades.length });
  tablesDuJeu().clotures.testRateDeLActeur(g, s, c);
} } }); });

/** Les étapes d'AFFICHAGE de la sonde — porteur conduit par l'IA, donc AUCUN siège ne les tient. */
function sequenceDe(premierKind: GenreDeCascade): BuiltCascadeStep[] {
  const [h] = get().party;
  return [
    displayStep({ id: 's1', kind: premierKind, actorId: h.id, label: fixtureText('Étape 1') })!,
    displayStep({ id: 's2', kind: KIND_INERTE, actorId: h.id, label: fixtureText('Étape 2') })!,
  ];
}

beforeEach(() => {
  apples = 0;
  ratesVus = [];
  seedBattleRng(7);
  const party = tousLesHerosDeScenario(idsDeTest).slice(0, 1).map((h) => ({ ...h, aiControlled: true }));
  set({ party, battle: null, pendingCascade: null, suspendedCascades: [], journal: [] } as never);
  set({ net: { ...NET0, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} } } as never);
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
    set({ battle: COMBAT });
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
      difficulty: 'intermediaire', stake: voyageStakeRef('equipage-progression'),
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

const posee = (flag: string): Flow => ({ kind: 'effet', effet: { type: 'setFlag', flag } });
/** Le groupe : `Meneur` tenu par le siège local (le Test de Force est le sien), `Automate` conduit par l'IA
 *  (le Test d'Agilité est le sien, joué d'office). */
function groupe(): void {
  const [a, b] = tousLesHerosDeScenario(idsDeTest).slice(0, 2);
  const meneur = { ...a, aiControlled: false, characteristics: { ...a.characteristics, force: 8, agilite: 5 } };
  const automate = { ...b, aiControlled: true, characteristics: { ...b.characteristics, force: 4, agilite: 60 } };
  set({ party: [meneur, automate], flags: {}, pendingTest: null, pendingExtendedTest: null, pendingForceDoor: null } as never);
}

describe('#4006 — la sortie d’hôte d’un Test de scène reprend la séquence qu’il a parquée', () => {
  /** Une séquence TENUE AU SLOT dont la 1ʳᵉ étape ouvre `flow` : validée, son applier la parque derrière l'hôte. */
  function parquerSous(flow: Flow): void {
    flowOuvert = flow;
    const meneur = get().party[0];
    startCascade(get, set, { title: 'Parquée', purpose: 'affichage', steps: [
      displayStep({ id: 'p1', kind: KIND_OUVRE_FLOW, actorId: meneur.id, label: fixtureText('Ouvre') })!,
      displayStep({ id: 'p2', kind: KIND_INERTE, actorId: meneur.id, label: fixtureText('Reste') })!,
    ] });
    get().jetValider('cascade');
    expect(get().suspendedCascades.map((c) => c.title), 'la séquence est parquée derrière l’hôte').toEqual(['Parquée']);
  }
  /** La séquence parquée est revenue au slot, à son curseur, une fois. */
  function reprise(): void {
    expect(get().suspendedCascades, 'la pile est vide').toEqual([]);
    expect(get().pendingCascade?.title, 'la séquence parquée tient le slot').toBe('Parquée');
    expect(get().pendingCascade?.cursor, 'à son curseur, derrière l’étape jouée').toBe(1);
    expect(apples, 'l’étape jouée n’est pas rejouée').toBe(1);
  }
  beforeEach(groupe);

  it('Test de scène validé : sa branche se joue, puis la séquence parquée est reprise', () => {
    parquerSous({ kind: 'test', test: { characteristic: 'force' }, reussite: posee('branche'), echec: posee('branche') });
    get().jetLancer('test');
    get().jetValider('test');
    expect(get().flags.branche, 'la suite du Test est jouée').toBe(true);
    reprise();
  });

  const etendu: Flow = { kind: 'effet', effet: { type: 'extendedTest', characteristic: 'force', difficulty: 'tresFacile', label: 'Étendu', drCible: 1, flag: 'cede' } };
  const porte: Flow = { kind: 'effet', effet: { type: 'forceDoor', label: 'Porte', doorBE: 0, doorB: 1, flag: 'porte-ouverte' } };

  it('Test étendu mené à son terme : la séquence parquée est reprise', () => {
    parquerSous(etendu);
    let garde = 0;
    while (get().pendingExtendedTest && garde++ < 60) {
      const p = get().pendingExtendedTest!;
      get().jetLancer('testEtendu', p.rounds[p.rounds.length - 1].id);
      get().jetValider('testEtendu');
    }
    expect(get().pendingExtendedTest).toBeNull();
    reprise();
  });

  it('Test étendu renoncé : la séquence parquée est reprise', () => {
    parquerSous(etendu);
    get().jetAnnuler('testEtendu');
    expect(get().pendingExtendedTest).toBeNull();
    reprise();
  });

  it('porte enfoncée : la séquence parquée est reprise', () => {
    parquerSous(porte);
    let garde = 0;
    while (get().pendingForceDoor && garde++ < 60) {
      for (const part of get().pendingForceDoor!.participants) get().jetLancer('enfoncerLaPorte', part.id);
      get().jetValider('enfoncerLaPorte');
    }
    expect(get().flags['porte-ouverte']).toBe(true);
    reprise();
  });

  it('porte renoncée : la séquence parquée est reprise', () => {
    parquerSous(porte);
    get().jetAnnuler('enfoncerLaPorte');
    expect(get().pendingForceDoor).toBeNull();
    reprise();
  });

  it('S4 — la branche ouvre un Test joué d’office : la reprise vient après les clôtures du Test externe, une fois', () => {
    const interne: Flow = { kind: 'test', test: { characteristic: 'agilite' }, reussite: posee('interne'), echec: posee('interne') };
    parquerSous({ kind: 'test', test: { characteristic: 'force' }, reussite: interne, echec: interne });
    const meneur = get().party[0];
    seedBattleRng(3);
    get().jetLancer('test');
    expect(get().pendingTest?.actorId, 'le Test externe est celui du Meneur').toBe(meneur.id);
    expect(get().pendingTest?.success, 'précondition : le Test externe est raté (sa clôture `testRateDeLActeur` se joue)').toBe(false);
    get().jetValider('test');
    expect(get().flags.interne, 'le Test interne s’est joué d’office').toBe(true);
    expect(ratesVus.filter((r) => r.actorId === meneur.id), 'la clôture du Test externe voit encore la séquence parquée').toEqual([{ actorId: meneur.id, parquees: 1 }]);
    reprise();
  });

  it('garde — une sortie d’hôte EN COMBAT ne reprend rien', () => {
    parquerSous({ kind: 'test', test: { characteristic: 'force' }, reussite: posee('branche'), echec: posee('branche') });
    set({ battle: COMBAT });
    let suite = 0;
    sortirDeLHote(get, set, { pendingTest: null }, () => { suite++; });
    expect(suite, 'la suite est jouée').toBe(1);
    expect(get().pendingCascade, 'le slot est libéré').toBeNull();
    expect(get().suspendedCascades.map((c) => c.title), 'la séquence parquée reste au teardown du combat').toEqual(['Parquée']);
  });
});

describe('#4006 — le pilote immédiat à contexte parque au rang ce que son applier ouvre', () => {
  /** Les dénouements de séquence (`clotureDeCascade`), dans l'ordre : la clôture que le jeu branche, observée. */
  let denouements: string[] = [];
  beforeEach(() => {
    groupe();
    denouements = [];
    setClotureDeCascade((done) => { denouements.push(done.title); dispatchCascadeDone(get, set, done); });
  });
  const testDeForce: Flow = { kind: 'test', test: { characteristic: 'force' }, reussite: posee('force'), echec: posee('force') };
  /** La séquence du pilote, portée par l'Automate (aucun siège ne la tient : `openSequence` la pilote d'office). */
  function piloter(premierKind: GenreDeCascade): ReturnType<typeof openSequence> {
    const automate = get().party[1];
    return openSequence(get, set, { title: 'Journée', purpose: 'travelDay', steps: [
      displayStep({ id: 'j1', kind: premierKind, actorId: automate.id, label: fixtureText('Étape 1') })!,
      displayStep({ id: 'j2', kind: KIND_INERTE, actorId: automate.id, label: fixtureText('Étape 2') })!,
    ] });
  }
  const pile = () => get().suspendedCascades.map((c) => c.title);
  /** Le Test de Force du Meneur, ouvert par l'applier, joué puis validé par son siège. */
  function jouerLeTestDeForce(): void {
    expect(get().pendingTest?.actorId, 'le Test ouvert est celui du Meneur').toBe(get().party[0].id);
    get().jetLancer('test');
    get().jetValider('test');
    expect(get().flags.force, 'la branche du Test est jouée').toBe(true);
  }
  /** La journée reprise une fois depuis son curseur, son dénouement joué une fois. */
  function journeeDenouee(): void {
    expect(apples, 'l’étape jouée n’est pas rejouée, la suivante est jouée une fois').toBe(2);
    expect(denouements, 'le dénouement de la journée est joué une fois').toEqual(['Journée']);
    expect(get().suspendedCascades, 'la pile est vide').toEqual([]);
  }

  it('slot nul, l’applier ouvre une séquence : la journée est parquée entière, reprise une fois à sa clôture, dénouée une fois', () => {
    flowOuvert = testDeForce;
    expect(piloter(KIND_OUVRE_FLOW), 'rien n’est rendu').toBeUndefined();
    expect(apples, 'la suite n’est pas jouée par-dessus le Test').toBe(1);
    expect(pile(), 'la journée est parquée sous le Test').toEqual(['Journée']);
    const [parquee] = get().suspendedCascades;
    expect(parquee.participants.map((s) => s.id), 'la séquence ENTIÈRE est parquée').toEqual(['j1', 'j2']);
    expect(parquee.cursor, 'le curseur est posé derrière l’étape jouée').toBe(1);
    expect(parquee.piloteImmediat, 'le pilote la reprendra').toBeTruthy();
    expect(denouements, 'aucun dénouement avant la clôture du Test').toEqual([]);
    jouerLeTestDeForce();
    journeeDenouee();
  });

  it('slot vivant, l’applier ouvre une séquence d’un autre purpose : pile [slot d’entrée, journée], l’ouverte au slot', () => {
    flowOuvert = testDeForce;
    const meneur = get().party[0];
    startCascade(get, set, { title: 'Vivante', purpose: 'affichage', steps: [displayStep({ id: 'v1', kind: KIND_INERTE, actorId: meneur.id, label: fixtureText('Vivante') })!] });
    expect(piloter(KIND_OUVRE_FLOW), 'rien n’est rendu').toBeUndefined();
    expect(pile(), 'la journée est parquée au-dessus du slot d’entrée').toEqual(['Vivante', 'Journée']);
    expect(get().pendingCascade?.purpose, 'le Test ouvert tient le slot').toBe('test');
    expect(apples).toBe(1);
  });

  it('garde — séquence ouverte et close dans l’applier (Test joué d’office) : rien n’est parqué, la journée va au bout', () => {
    flowOuvert = { kind: 'test', test: { characteristic: 'agilite' }, reussite: posee('agilite'), echec: posee('agilite') };
    const resolues = piloter(KIND_OUVRE_FLOW);
    expect(get().flags.agilite, 'le Test d’office est joué dans l’applier').toBe(true);
    expect(resolues?.map((s) => s.id), 'la journée est rendue résolue').toEqual(['j1', 'j2']);
    expect(get().suspendedCascades).toEqual([]);
    expect(get().pendingCascade).toBeNull();
  });

  it('garde (doc de `clotureHorsCombat`) — slot vivant et append : le fait n’est pas levé, la journée va au bout, rien n’est rendu', () => {
    const meneur = get().party[0];
    startCascade(get, set, { title: 'Vivante', purpose: 'affichage', steps: [displayStep({ id: 'v1', kind: KIND_INERTE, actorId: meneur.id, label: fixtureText('Vivante') })!] });
    expect(piloter(KIND_REVELE), 'le slot a été réécrit : aucun dénouement à enchaîner').toBeUndefined();
    expect(apples, 'la journée est jouée en entier').toBe(2);
    expect(get().suspendedCascades, 'rien n’est parqué').toEqual([]);
    expect(get().pendingCascade?.participants.map((s) => s.label), 'la révélation rejoint le slot vivant').toEqual(['Vivante', 'Révélation']);
  });

  it('deux ouvertures dans un applier : la seconde, puis la première, puis la journée, une fois', () => {
    flowOuvert = testDeForce;
    expect(piloter(KIND_OUVRE_FLOW_PUIS_REVELE)).toBeUndefined();
    expect(pile(), 'la journée sous le Test, sous la révélation qui tient le slot').toEqual(['Journée', expect.any(String)]);
    expect(get().pendingCascade?.purpose).toBe('affichage');
    get().jetValider('cascade');
    expect(get().pendingCascade?.purpose, 'la révélation close, le Test revient au slot').toBe('test');
    expect(pile()).toEqual(['Journée']);
    expect(apples).toBe(1);
    jouerLeTestDeForce();
    journeeDenouee();
  });

  it('une ouverture puis un combat : la journée sous le Test derrière le combat ; le Test d’abord, puis la journée, une fois', () => {
    flowOuvert = testDeForce;
    expect(piloter(KIND_OUVRE_FLOW_PUIS_COMBAT)).toBeUndefined();
    expect(get().suspendedCascades.map((c) => c.purpose), 'pile [journée, Test] derrière le combat').toEqual(['travelDay', 'test']);
    set({ battle: null } as never);
    expect(resumeSuspendedCascade(get, set), 'le teardown du combat reprend la tête de pile').toBe(true);
    expect(get().pendingCascade?.purpose, 'le Test revient au slot avant la journée').toBe('test');
    expect(apples).toBe(1);
    jouerLeTestDeForce();
    journeeDenouee();
  });

  it('garde — lancée en combat, une séquence ouverte par l’applier n’arrête pas la journée', () => {
    set({ battle: COMBAT });
    expect(piloter(KIND_REVELE_A_PART)).toBeUndefined();
    expect(apples, 'la journée est jouée en entier').toBe(2);
    expect(get().suspendedCascades, 'rien n’est parqué').toEqual([]);
    expect(get().pendingCascade?.purpose, 'la révélation tient le slot').toBe('affichage');
  });
});
