import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { openRoundStartPsych, openRoundEndCascade } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { psychDRAdjust } from '../engine/combat';
import { cibleEnVue, psychBranchOps, sousPeur, type PsychType } from '../engine/psychology';
import { ciblePsy } from '../engine/psych/ciblage';
import { parsePsychTraits } from '../engine/psych/registry';
import { applyOps } from '../engine/ops';
import { actorIn } from './monde/combatants';
import { sourcesPsyEnVue } from './monde/porteurs';
import { fireTriggers } from './triggeredEffects';
import { battleRng } from './battleRng';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';

/**
 * Passes de Round de la psychologie de combat, héros (rangée surfacée) ET IA (jet sans pilote), par le
 * même collecteur. LDB 21 l.9, l.19, l.25, l.39, l.48 ; LDB 10 l.1051 ; LDB 85 l.51 ; #3045
 *
 * `fin(n)` pose l'état du franchissement (`advanceTurn` a déjà incrémenté le Round) puis ouvre la passe
 * de fin, qui concerne le Round `n`.
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const g = () => banc.getState();
const lu = (id: string) => actorIn(g(), id)!;
const psy = (id: string, type: PsychType) => (lu(id).psychState ?? []).filter((p) => p.type === type);
const bandes = (): CascadeStep[] => (g().pendingCascade?.participants ?? []).filter((s) => s.kind === 'psychologieDeCombat');
const debut = (n: number) => { banc.setState({ battle: { ...g().battle!, round: n }, pendingCascade: null }); openRoundStartPsych(g, banc.setState); };
const fin = (n: number) => { banc.setState({ battle: { ...g().battle!, round: n + 1 }, pendingCascade: null }); openRoundEndCascade(g, banc.setState); };
/** Les Traits psy d'« Effrayé (`groupe`) », tels que la fiche les dérive. */
const effraye = (groupe: string) => parsePsychTraits([{ id: 'effraye', arg: groupe }]).psychTraits ?? [];
/** Joue chaque rangée de la cascade ouverte, bande après bande. */
const jouer = () => void draineCascade(g);

/** `heros` héros (surfacés) face à `ennemis` ennemis (IA), tous de Taille moyenne et en vue, sans source ; la
 *  scène porte les Groupes `groups`. */
function setup(heros = 1, ennemis = 1, groups?: string[]) {
  banc.getState().ensemencerLeTirage(7);
  const party = Array.from({ length: heros }, (_, i) => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i + 1}`, seed: i + 1 }));
  banc.setState({ party });
  g().lancerLaScene({ ...testScene(), groups });
  g().lancerLeCombat('enc-mutants');
  g().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = g().battle!;
  const H = b.combatants.filter((c) => c.kind === 'heros');
  const E = b.combatants.filter((c) => c.kind === 'ennemi');
  E.slice(ennemis).forEach((e) => (e.dead = true));
  const vivants = [...H, ...E.slice(0, ennemis)];
  vivants.forEach((c, i) => { c.pos = { x: 10 + (i % 2), y: 10 + Math.floor(i / 2) }; c.size = 'moyenne'; c.causesPeur = undefined; c.causesTerreur = undefined; c.psychState = []; c.psychTraits = []; });
  banc.setState({ battle: { ...b, round: 1 }, pendingCascade: null });
  return { H: H.map((c) => c.id), E: E.slice(0, ennemis).map((c) => c.id) };
}

describe('Peur : pèse dès le début du Round de rencontre, Test étendu en fin de Round (LDB 21 l.25)', () => {
  it('héros et IA : enregistrée sans Test au début, −1 DR contre la source, Test étendu à la fin du MÊME Round', () => {
    const { H: [h], E: [e] } = setup();
    lu(h).causesPeur = 2;
    lu(e).causesPeur = 2;
    debut(1);
    expect(bandes(), 'aucun Test au début du Round').toEqual([]);
    for (const [porteur, source] of [[h, e], [e, h]]) {
      expect(psy(porteur, 'peur')).toEqual([{ type: 'peur', sourceId: source, indice: 2, calmeDR: 0 }]);
      expect(psychDRAdjust(lu(porteur), lu(source))).toBe(-1);
    }
    fin(1);
    expect(bandes().map((s) => [s.psychologieDeCombat!.kind, s.psychologieDeCombat!.round, s.participants!.map((p) => p.id)])).toEqual([['peur', 1, [h]]]);
    expect(psy(e, 'peur')[0].lastTestRound, 'l’IA teste au même moment').toBe(1);
    jouer();
    expect(psy(h, 'peur')[0].lastTestRound).toBe(1);
  });

  it('Terreur au début du Round N : la Peur héritée se teste à la fin du Round N, héros et IA (LDB 21 l.56)', () => {
    const { H: [h], E: [e] } = setup();
    lu(h).causesTerreur = 2;
    lu(e).causesTerreur = 2;
    debut(1);
    expect(bandes().map((s) => s.psychologieDeCombat!.kind)).toEqual(['terreur']);
    jouer();
    for (const porteur of [h, e]) expect(psy(porteur, 'peur').map((p) => p.lastTestRound)).toEqual([undefined]);
    fin(1);
    expect(psy(e, 'peur')[0].lastTestRound).toBe(1);
    expect(bandes().map((s) => [s.psychologieDeCombat!.kind, s.psychologieDeCombat!.round])).toEqual([['peur', 1]]);
  });

  it('Sans Peur : le Test allégé se joue à la rencontre et vaut pour ce Round, héros et IA (LDB 10 l.1051 ; #3045)', () => {
    const { H: [h], E: [e] } = setup();
    lu(h).causesPeur = 3;
    lu(e).causesPeur = 3;
    for (const id of [h, e]) { lu(id).talents = [...(lu(id).talents ?? []), { talentId: 'sans-peur', times: 1 }]; lu(id).characteristics['force-mentale'] = 1; }
    debut(1);
    const bande = bandes()[0];
    expect([bande.psychologieDeCombat!.kind, bande.participants!.map((p) => [p.id, p.meta?.sansPeur])]).toEqual(['peur', [[h, true]]]);
    expect(bande.participants![0].difficulty, 'Test de Calme Accessible (+20)').toBe('accessible');
    expect(psy(e, 'peur')[0].lastTestRound, 'l’IA teste à la rencontre').toBe(1);
    jouer();
    expect(psy(h, 'peur')[0].lastTestRound).toBe(1);
    fin(1);
    expect(bandes(), 'pas de second Test à la fin du même Round').toEqual([]);
    expect(psy(e, 'peur')[0].lastTestRound).toBe(1);
  });
});

describe('Traits ciblés : premier Test au début, re-test selon l’entrée (LDB 21 l.9, l.19, l.39, l.48)', () => {
  /** Le héros et l'IA portent `type` envers le Groupe de l'autre, et ratent leur Calme. */
  const cibles = (type: PsychType) => {
    const { H: [h], E: [e] } = setup();
    lu(e).groups = ['mort-vivant'];
    lu(h).groups = ['humain'];
    lu(h).psychTraits = [{ type, cible: ciblePsy.groupe('mort-vivant') }];
    lu(e).psychTraits = [{ type, cible: ciblePsy.groupe('humain') }];
    for (const id of [h, e]) lu(id).characteristics['force-mentale'] = 1;
    return { h, e };
  };
  const reTestHeros = () => bandes().filter((s) => s.participants!.length).map((s) => [s.psychologieDeCombat!.kind, s.psychologieDeCombat!.round]);

  for (const type of ['animosite', 'haine'] as const) {
    it(`${type} née au Round N : re-testée à la fin de N+1 puis de N+2, jamais à la fin de N ni au début`, () => {
      const { h, e } = cibles(type);
      debut(1);
      expect(reTestHeros()).toEqual([[type, 1]]);
      jouer();
      for (const id of [h, e]) expect(psy(id, type).map((p) => [p.active, p.lastTestRound])).toEqual([[true, 1]]);
      fin(1);
      expect(reTestHeros()).toEqual([]);
      expect(psy(e, type)[0].lastTestRound).toBe(1);
      debut(2);
      expect(reTestHeros()).toEqual([]);
      expect(psy(e, type)[0].lastTestRound).toBe(1);
      fin(2);
      expect(reTestHeros()).toEqual([[type, 2]]);
      expect(psy(e, type)[0].lastTestRound).toBe(2);
      jouer();
      expect(psy(h, type)[0].lastTestRound).toBe(2);
      fin(3);
      expect(reTestHeros(), 'le repère voyage sur la bande').toEqual([[type, 3]]);
      expect(psy(e, type)[0].lastTestRound).toBe(3);
    });
  }

  it('Préjugé né au Round N : re-testé au début de N+1, pas à la fin de N', () => {
    const { h, e } = cibles('prejuge');
    debut(1);
    jouer();
    fin(1);
    expect(reTestHeros()).toEqual([]);
    expect(psy(e, 'prejuge')[0].lastTestRound).toBe(1);
    debut(2);
    expect(reTestHeros()).toEqual([['prejuge', 2]]);
    expect(psy(e, 'prejuge')[0].lastTestRound).toBe(2);
    jouer();
    expect(psy(h, 'prejuge')[0].lastTestRound).toBe(2);
  });
});

describe('Cardinalité et immunité : un seul code pour le héros et l’IA', () => {
  it('deux Tests dus à un même porteur se jouent dans la même passe', () => {
    const { H: [h1, h2], E: [e1, e2] } = setup(2, 2);
    for (const id of [h1, h2, e1, e2]) lu(id).causesTerreur = 2;
    debut(1);
    const rangees = bandes().map((s) => s.participants!.map((p) => p.id));
    expect(rangees.filter((r) => r.includes(h1)).length, 'une rangée du héros par source, alliée comprise').toBe(3);
    jouer();
    for (const [porteur, sources] of [[h1, [h2, e1, e2]], [e1, [h1, h2, e2]]] as const)
      expect(psy(porteur, 'peur').map((p) => p.sourceId).sort()).toEqual([...sources].sort());
  });

  it('Belliqueux : plus d’Avantages que l’adversaire Engagé ⇒ immunité, pour le héros comme pour l’IA (LDB 85 l.51)', () => {
    const { H: [h], E: [e] } = setup();
    for (const [porteur, autre] of [[h, e], [e, h]]) {
      lu(porteur).traits = [...(lu(porteur).traits ?? []), { id: 'belliqueux' }];
      lu(autre).causesTerreur = 2;
      lu(porteur).engagedWith = [autre];
    }
    lu(h).advantage = 2;
    lu(e).advantage = 3;
    debut(1);
    expect(bandes().map((s) => s.participants!.map((p) => p.id)), 'le héros, à 2 contre 3, se teste').toEqual([[h]]);
    expect(psy(e, 'peur'), 'l’IA, à 3 contre 2, est immunisée').toEqual([]);
    const sansTerreur = (c: Combatant) => !(c.psychState ?? []).some(sousPeur);
    expect(sansTerreur(lu(e))).toBe(true);
    banc.setState({ pendingCascade: null });
    lu(h).advantage = 4;
    lu(e).psychState = [];
    debut(1);
    expect(bandes(), 'le héros, à 4 contre 3, est immunisé').toEqual([]);
    expect(psy(e, 'peur').length, 'l’IA, à 3 contre 4, se teste').toBe(1);
  });
});

describe('Jet sans pilote de la passe (design B1b, D1 et D5)', () => {
  it('la passe joue l’IA même quand le Destin d’un héros bloque la cascade du début de Round', () => {
    const { H: [h], E: [e] } = setup();
    lu(h).causesTerreur = 2;
    lu(e).causesTerreur = 2;
    banc.setState({ pendingFateSave: { heroId: h, source: 'slow' } });
    openRoundStartPsych(g, banc.setState);
    expect(psy(e, 'peur').map((p) => p.sourceId)).toEqual([h]);
    expect(g().pendingCascade).toBeFalsy();
  });

  it('À sang-froid inverse le Test de Calme raté de l’IA face à une Terreur (LDB 85 l.13)', () => {
    const tient = (sangFroid: boolean) => {
      let n = 0;
      for (let graine = 1; graine <= 60; graine++) {
        const { H: [h], E: [e] } = setup();
        g().ensemencerLeTirage(graine);
        lu(h).causesTerreur = 2;
        lu(e).characteristics['force-mentale'] = 40;
        if (sangFroid) lu(e).traits = [...(lu(e).traits ?? []), { id: 'a-sang-froid' }];
        openRoundStartPsych(g, banc.setState);
        if (!(lu(e).conditions ?? []).some((c) => c.id === 'brise')) n++;
      }
      return n;
    };
    expect(tient(true)).toBeGreaterThan(tient(false));
  });
});

describe('Étiquette de scène : le lieu porte le Groupe, source en vue partout dans la scène (#3045)', () => {
  /** Le héros de la scène étiquetée `groupe`, au Calme plancher. */
  const etiquetee = (groupe: string) => {
    const { H: [h] } = setup(1, 1, [groupe]);
    lu(h).characteristics['force-mentale'] = 1;
    return h;
  };

  it('Effrayé (Feu) : Peur neuve au début du Round 1, Test étendu à sa fin, la Peur 0 prend fin (LDB 21 l.25 ; EDOC 12 l.241)', () => {
    const h = etiquetee('feu');
    lu(h).psychTraits = effraye('feu');
    debut(1);
    expect(bandes(), 'aucun Test au début du Round').toEqual([]);
    expect(psy(h, 'peur')).toEqual([{ type: 'peur', sourceId: 'scene', indice: 0, calmeDR: 0 }]);
    fin(1);
    expect(bandes().map((s) => [s.psychologieDeCombat!.kind, s.psychologieDeCombat!.sourceId, s.psychologieDeCombat!.sourceName, s.psychologieDeCombat!.round, s.participants!.map((p) => p.id)]))
      .toEqual([['peur', 'scene', g().scene!.label, 1, [h]]]);
    jouer();
    expect(psy(h, 'peur').map((p) => [p.lastTestRound, sousPeur(p)])).toEqual([[1, false]]);
  });

  it('Haine (Richesse) : Test au début du Round 1, présente non hostile en fin de Round, re-testée à la fin du Round 2 et finie sur un succès (LDB 21 l.39)', () => {
    const h = etiquetee('richesse');
    lu(h).psychTraits = [{ type: 'haine', cible: ciblePsy.groupe('richesse') }];
    debut(1);
    expect(bandes().map((s) => [s.psychologieDeCombat!.kind, s.psychologieDeCombat!.sourceId, s.psychologieDeCombat!.round])).toEqual([['haine', 'scene', 1]]);
    jouer();
    expect(psy(h, 'haine').map((p) => [p.active, p.lastTestRound])).toEqual([[true, 1]]);
    const haine = psy(h, 'haine')[0];
    expect(cibleEnVue(lu(h), haine, sourcesPsyEnVue(g().battle!, g().scene!, lu(h), (s) => !s.dead))).toEqual({ present: true, hostile: false });
    fireTriggers(g, lu(h), 'onRoundEnd', { rng: battleRng(), set: banc.setState });
    expect(psy(h, 'haine').map((p) => p.active), 'la Cible reste en vue : la Haine continue').toEqual([true]);
    fin(1);
    expect(bandes()).toEqual([]);
    lu(h).characteristics['force-mentale'] = 95;
    fin(2);
    expect(bandes().map((s) => [s.psychologieDeCombat!.kind, s.psychologieDeCombat!.round])).toEqual([['haine', 2]]);
    jouer();
    expect(psy(h, 'haine').map((p) => p.active)).toEqual([false]);
  });

  it('Sans Peur (Feu) : la Peur de l’étiquette se teste à la rencontre, Accessible (LDB 10 l.1051)', () => {
    const h = etiquetee('feu');
    lu(h).psychTraits = effraye('feu');
    lu(h).talents = [...(lu(h).talents ?? []), { talentId: 'sans-peur', spec: 'feu', times: 1 }];
    debut(1);
    const bande = bandes()[0];
    expect([bande.psychologieDeCombat!.kind, bande.psychologieDeCombat!.sourceId, bande.participants!.map((p) => [p.id, p.meta?.sansPeur])]).toEqual(['peur', 'scene', [[h, true]]]);
    expect(bande.participants![0].difficulty, 'Test de Calme Accessible (+20)').toBe('accessible');
  });

  it('Haine (Feu) active, née d’une autre source : aucune Peur du feu (LDB 21 l.41)', () => {
    const { H: [h], E: [e] } = setup(1, 1, ['feu']);
    lu(h).psychTraits = effraye('feu');
    applyOps(lu(h), psychBranchOps({ kind: 'haine', cible: ciblePsy.groupe('feu'), sourceId: e, indice: 0 }, { success: false }), { idNeuf: idsDeTest, rng: battleRng() });
    debut(1);
    expect(psy(h, 'peur')).toEqual([]);
    expect(bandes()).toEqual([]);
  });
});

describe('Source déjà affrontée : seule une Peur ou une Terreur l’éteint (LDB 21 l.25, l.54 ; #3045)', () => {
  it('un Préjugé actif né d’un combattant qui cause la Peur n’empêche pas sa Peur neuve', () => {
    const { H: [h], E: [e] } = setup();
    lu(e).groups = ['mort-vivant'];
    lu(e).causesPeur = 2;
    applyOps(lu(h), psychBranchOps({ kind: 'prejuge', cible: ciblePsy.groupe('mort-vivant'), sourceId: e, indice: 0 }, { success: false }), { idNeuf: idsDeTest, rng: battleRng() });
    debut(1);
    expect(psy(h, 'peur')).toEqual([{ type: 'peur', sourceId: e, indice: 2, calmeDR: 0 }]);
  });

  it('étiquette à deux Groupes : une Haine (Richesse) née de la scène n’empêche pas la Peur d’Effrayé (Feu)', () => {
    const { H: [h] } = setup(1, 1, ['feu', 'richesse']);
    lu(h).psychTraits = effraye('feu');
    applyOps(lu(h), psychBranchOps({ kind: 'haine', cible: ciblePsy.groupe('richesse'), sourceId: 'scene', indice: 0 }, { success: true }), { idNeuf: idsDeTest, rng: battleRng() });
    debut(1);
    expect(psy(h, 'peur')).toEqual([{ type: 'peur', sourceId: 'scene', indice: 0, calmeDR: 0 }]);
  });
});

