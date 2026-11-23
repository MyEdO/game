/**
 * #4860 — après le report de fin de rencontre (`battle.over`, `finalizeBattle`), `party` fait seul foi : les fenêtres
 * de fin encore ouvertes (seuil de Corruption, renoncement, mutation) et les Effets `onVictory` écrivent la copie du
 * groupe, que la sortie de l'écran de victoire garde. LDB 19 l.70 ; LDB 17 l.67
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, onTestFinished } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { avanceEtapeCascade, draineCascade } from './cascade.testkit';
import { imposerLesD100 } from './battleRng.testkit';
import { applyCast, checkBattleOver } from './combatFlow';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { initialNet } from './etat';
import { corruptionThreshold } from '../engine/corruption';
import { actorIn, porteurParId } from './monde/combatants';
import { flowFromEffects } from './monde/flow';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import { frapper } from './coupHorsBataille.testkit';
import { heroDuDuel, heroFaceAUnEnnemi, INCANTATION_CRITIQUE, ouvrirLeDuel, SORT_A_DEGATS } from './combatDeTest.testkit';
import { addCondition, COND, isOutOfAction } from '../engine/conditions';
import { resetRule, setRule } from '../engine/policy';

let banc: Banc;
const g = () => banc.getState();
beforeEach(() => { banc = ouvrirLeBanc(); seedBattleRng(4); });

interface Fixture {
  /** Héros au seuil de Corruption, en nombre. */
  auSeuil: number;
  resilience: number;
  /** L'ennemi porte le Trait Corruption (Mineure) : la bande d'Exposition de fin s'ouvre. */
  corrupteur: boolean;
  onVictory?: Effect[];
  /** Un PNJ allié à fiche de personnage (`kind:'heros'`), hors `party`, au seuil. */
  allieHorsGroupe?: boolean;
  /** Une Zone `noCorruption` couvre la case du premier héros. LDB 48 l.393 */
  zoneSansCorruption?: boolean;
}

/** Combat réel sur la scène de test, siège humain (hôte, siège 0) tenant tous les héros ; ennemis tués. */
function rencontre(f: Fixture): { H: Combatant[]; allie?: Combatant } {
  const party = Array.from({ length: Math.max(1, f.auSeuil) }, (_, i) =>
    createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, seed: i + 1 }));
  banc.setState({ party });
  g().lancerLaScene(testScene());
  g().lancerLeCombat('enc-mutants');
  g().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = g().battle!;
  const H = b.combatants.filter((c) => c.kind === 'heros');
  const E = b.combatants.filter((c) => c.kind === 'ennemi');
  E.forEach((e) => {
    e.traits = f.corrupteur ? [{ id: 'corruption', arg: 'mineure' }] as Combatant['traits'] : (e.traits ?? []).filter((t) => t.id !== 'corruption');
    e.dead = true;
  });
  H.forEach((h, i) => {
    h.pos = { x: 10, y: 10 + i };
    h.resilience = f.resilience;
    h.corruption = i < f.auSeuil ? corruptionThreshold(h) : 0;
  });
  let allie: Combatant | undefined;
  if (f.allieHorsGroupe) {
    allie = { ...structuredClone(H[0]), id: 'allie-1', label: 'Allie', pos: { x: 11, y: 10 }, followsCharacterRules: true } as Combatant;
    b.combatants.push(allie);
  }
  banc.setState({
    battle: { ...b, ...(f.onVictory ? { onVictory: flowFromEffects(f.onVictory) } : {}),
      ...(f.zoneSansCorruption ? { zones: [{ label: 'Protection de Phâ', tiles: [{ x: 10, y: 10 }], rounds: 3, noCorruption: true }] } : {}) },
    pendingCascade: null, suspendedCascades: [], pendingLogQueue: [],
    net: { ...initialNet(), mode: 'hote', mySeat: 0, slots: [0, 0, 0, 0], ownership: {} },
  } as never);
  return { H, allie };
}

/** Joue la rangée courante de la bande d'Exposition de fin, réussie ou ratée. */
function jouerLaBande(success: boolean): void {
  const p = g().pendingCascade!;
  const cur = p.participants[p.cursor];
  banc.setState({ pendingCascade: { ...p, participants: p.participants.map((s, i) => (i !== p.cursor ? s : { ...s,
    participants: (cur.participants ?? []).map((r) => ({ ...r, result: { roll: success ? 1 : 99, target: r.target ?? 0, sl: success ? 3 : -3, success } })) })) } } as never);
  g().jetValider('cascade');
  if (g().pendingCascade) g().fenetreFermer('cascade');
}

function seuilRate(): void {
  banc.setState({ pendingCorruption: { ...g().pendingCorruption!, roll: 99, target: 40, sl: -3, success: false } } as never);
  g().jetValider('corruption');
}

const duGroupe = (id: string) => g().party.find((h) => h.id === id)!;
const deTerrain = (id: string) => g().battle!.combatants.find((c) => c.id === id)!;

describe('#4860 — les fenêtres de fin ouvertes après le report écrivent `party`', () => {
  it('(1) seuil raté, Résilience, « Je te renie ! » : la Résilience dépensée est celle du groupe, aucune mutation', () => {
    const { H } = rencontre({ auSeuil: 1, resilience: 2, corrupteur: true });
    checkBattleOver(g, banc.setState);
    jouerLaBande(false);
    expect(g().battle!.over).toBe('victoire');
    seuilRate();
    const groupeAvant = g().party;
    g().fenetreChoisir('renier', 'renier', true);
    expect(g().party, 'l’écriture en place ré-émet le groupe (`touchActors`)').not.toBe(groupeAvant);
    expect(duGroupe(H[0].id).resilience).toBe(1);
    expect(duGroupe(H[0].id).mutations ?? []).toHaveLength(0);
  });

  it('(2) seuil raté, mutation acceptée : la mutation et la Corruption débitée vont au groupe', () => {
    const { H } = rencontre({ auSeuil: 1, resilience: 2, corrupteur: true });
    checkBattleOver(g, banc.setState);
    jouerLaBande(false);
    const avant = duGroupe(H[0].id).corruption ?? 0;
    seuilRate();
    g().fenetreChoisir('renier', 'renier', false);
    draineCascade(g);
    expect(g().pendingCascade).toBeNull();
    expect(duGroupe(H[0].id).mutations ?? []).toHaveLength(1);
    expect(duGroupe(H[0].id).corruption ?? 0).toBeLessThan(avant);
  });

  it('(3) seuil raté sans Résilience : la mutation d’office va au groupe', () => {
    const { H } = rencontre({ auSeuil: 1, resilience: 0, corrupteur: true });
    checkBattleOver(g, banc.setState);
    jouerLaBande(false);
    seuilRate();
    draineCascade(g);
    expect(duGroupe(H[0].id).mutations ?? []).toHaveLength(1);
  });

  it('(4) deux héros au seuil, en file : les deux renoncements sont écrits au groupe', () => {
    const { H } = rencontre({ auSeuil: 2, resilience: 2, corrupteur: true });
    checkBattleOver(g, banc.setState);
    jouerLaBande(false);
    expect(g().corruptionQueue.map((q) => q.heroId)).toEqual([H[1].id]);
    seuilRate(); g().fenetreChoisir('renier', 'renier', true);
    seuilRate(); g().fenetreChoisir('renier', 'renier', true);
    expect(H.map((h) => duGroupe(h.id).resilience)).toEqual([1, 1]);
  });

  it('(5) l’Exposition de fin n’est jetée qu’une fois, fenêtres d’après le report comprises', () => {
    rencontre({ auSeuil: 1, resilience: 2, corrupteur: true });
    let bandes = 0;
    const compter = () => { bandes += (g().pendingCascade?.participants ?? []).filter((s) => s.kind === 'corruptionDeFinDeCombat').length; };
    checkBattleOver(g, banc.setState);
    compter();
    jouerLaBande(false);
    seuilRate();
    g().fenetreChoisir('renier', 'renier', false);
    for (let n = 0; g().pendingCascade && n < 10; n++) {
      compter();
      avanceEtapeCascade(g);
    }
    expect(bandes).toBe(1);
  });

  it('(8) après la dernière fenêtre et la sortie de l’écran de victoire, le groupe garde les écritures ; `actorIn` rend sa copie', () => {
    const { H } = rencontre({ auSeuil: 1, resilience: 2, corrupteur: true });
    checkBattleOver(g, banc.setState);
    jouerLaBande(false);
    seuilRate();
    g().fenetreChoisir('renier', 'renier', true);
    expect(actorIn(g(), H[0].id)).toBe(duGroupe(H[0].id));
    g().fenetreFermer('victoire');
    expect(g().battle).toBeNull();
    expect(duGroupe(H[0].id).resilience).toBe(1);
  });
});

describe('#4860 — `onVictory` écrit `party`', () => {
  it('(6) ops Corruption +2 sur un héros : le groupe la porte ; `giveXp` compté une fois', () => {
    const { H } = rencontre({ auSeuil: 0, resilience: 0, corrupteur: false, onVictory: [
      { type: 'ops', on: 'heros', heroId: '', ops: [{ op: 'corruption', amount: 2 }] },
      { type: 'giveXp', amount: 10 },
    ] as Effect[] });
    const xp = duGroupe(H[0].id).xp ?? 0;
    checkBattleOver(g, banc.setState);
    expect(g().battle!.over).toBe('victoire');
    expect(duGroupe(H[0].id).corruption).toBe(2);
    expect(duGroupe(H[0].id).xp).toBe(xp + 10);
    expect(g().pendingVictory?.xp).toBe(10);
  });

  it('(7) Exposition `corruptionExposure` sans héros désigné : sa fenêtre se résout dans le groupe', () => {
    const { H } = rencontre({ auSeuil: 0, resilience: 0, corrupteur: false, onVictory: [
      { type: 'corruptionExposure', level: 'majeure', nature: 'physique', heroId: '' },
    ] as Effect[] });
    checkBattleOver(g, banc.setState);
    expect(g().pendingCorruption?.heroId).toBe(H[0].id);
    banc.setState({ pendingCorruption: { ...g().pendingCorruption!, roll: 99, target: 40, sl: -3, success: false } } as never);
    g().jetValider('corruption');
    expect(duGroupe(H[0].id).corruption ?? 0).toBeGreaterThan(0);
    expect(deTerrain(H[0].id).corruption ?? 0).toBe(0);
  });

  it('(Z) Exposition ratée sous une Zone `noCorruption` : la protection se lit à la case de terrain, le groupe ne gagne rien', () => {
    const { H } = rencontre({ auSeuil: 0, resilience: 0, corrupteur: false, zoneSansCorruption: true, onVictory: [
      { type: 'corruptionExposure', level: 'majeure', nature: 'physique', heroId: '' },
    ] as Effect[] });
    checkBattleOver(g, banc.setState);
    expect(g().pendingCorruption?.heroId).toBe(H[0].id);
    banc.setState({ pendingCorruption: { ...g().pendingCorruption!, roll: 99, target: 40, sl: -3, success: false } } as never);
    g().jetValider('corruption');
    expect(duGroupe(H[0].id).corruption ?? 0).toBe(0);
  });
});

describe('#4860 — l’univers d’un acteur après le report', () => {
  it('(I) `actorIn` et `porteurParId` rendent la copie du groupe', () => {
    const { H } = rencontre({ auSeuil: 0, resilience: 0, corrupteur: false });
    checkBattleOver(g, banc.setState);
    expect(g().battle!.over).toBe('victoire');
    H.forEach((h, i) => {
      expect(actorIn(g(), h.id)).toBe(g().party[i]);
      expect(porteurParId(g(), h.id)).toBe(g().party[i]);
    });
  });

  it('(N) un allié hors du groupe, tenu par un humain : ses fenêtres de seuil et de renoncement s’ouvrent et s’écrivent sur sa copie de terrain', () => {
    const { H, allie } = rencontre({ auSeuil: 1, resilience: 2, corrupteur: true, allieHorsGroupe: true });
    checkBattleOver(g, banc.setState);
    jouerLaBande(false);
    expect(g().corruptionQueue.map((q) => q.heroId)).toEqual([allie!.id]);
    seuilRate(); g().fenetreChoisir('renier', 'renier', true);
    expect(duGroupe(H[0].id).resilience).toBe(1);
    expect(g().pendingCorruption?.heroId).toBe(allie!.id);
    seuilRate();
    expect(g().pendingRenounce?.heroId).toBe(allie!.id);
    g().fenetreChoisir('renier', 'renier', true);
    expect(deTerrain(allie!.id).resilience).toBe(1);
  });
});


describe('#4860 — l’issue du combat attend le Destin en suspens', () => {
  for (const tour of ['ennemi', 'heros'] as const) it(`(D) dernier héros frappé à mort au tour ${tour === 'ennemi' ? 'de l’ennemi' : 'du héros'}, siège humain, « Meurs un autre jour » : le report suit, le groupe porte le Destin débité sans champ de rencontre`, () => {
    onTestFinished(() => resetRule('combat-cible-inconsciente'));
    const { H, E } = heroFaceAUnEnnemi(banc, testScene());
    const b = g().battle!;
    banc.setState({ battle: { ...b, turn: b.order.indexOf(tour === 'ennemi' ? E.id : H.id), acted: false },
      net: { ...initialNet(), mode: 'hote', mySeat: 0, slots: [0, 0, 0, 0], ownership: {} } } as never);
    const posDuGroupe = structuredClone(g().party[0].pos);
    const fate = H.fate ?? 0;
    expect(fate, 'chemin : un Point de Destin à dépenser').toBeGreaterThan(0);
    setRule('combat-cible-inconsciente', 'mort-auto');
    H.wounds.current = 0;
    addCondition(H, COND.inconscient);
    frapper(banc, E, H, [30]);
    expect(g().pendingFateSave, 'chemin : la mort suspendue au Destin').toMatchObject({ heroId: H.id, source: 'hit' });
    expect(g().battle!.over, 'la défaite attend le Destin').toBeFalsy();
    g().fenetreChoisir('destin', 'issue', 'survivre');
    banc.jusquA((s) => !!s.battle?.over, 20);
    expect(g().battle!.over).toBe('defaite');
    expect(g().party[0].fate).toBe(fate - 1);
    expect(g().party[0].outOfRencontre).toBeFalsy();
    expect(g().party[0].pos).toEqual(posDuGroupe);
  });

  it('(V) le Sort du héros abat le dernier ennemi et met un allié à Destin hors de combat : la victoire attend « Meurs un autre jour », le groupe porte le Destin débité sans champ de rencontre', () => {
    onTestFinished(() => resetRule('combat-aa-blessures'));
    setRule('combat-aa-blessures', 'aa'); // AA 07 l.65
    const T2 = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'T', seed: 2 });
    const { H, E, T } = ouvrirLeDuel(banc, { scene: testScene(), party: [heroDuDuel(), T2] }, 'enc-mutants', 'heros');
    banc.setState({ net: { ...initialNet(), mode: 'hote', mySeat: 0, slots: [0, 0, 0, 0], ownership: {} } } as never);
    H.talents = [...H.talents, { talentId: 'diction-instinctive', times: 1 }];
    T!.wounds.current = 1;
    E.wounds.current = 1;
    const fate = T!.fate ?? 0;
    expect(fate, 'chemin : un Point de Destin à dépenser').toBeGreaterThan(0);
    const posDuGroupe = structuredClone(g().party.find((h) => h.id === T!.id)!.pos);
    imposerLesD100(1, 100);
    applyCast(g, banc.setState, H, [T!, E], SORT_A_DEGATS, INCANTATION_CRITIQUE, false, 'critique');
    draineCascade(g);
    expect(g().pendingFateSave, 'chemin : la mort de l’allié suspendue au Destin').toMatchObject({ heroId: T!.id, source: 'hit' });
    expect(isOutOfAction(actorIn(g(), E.id)!), 'chemin : le dernier ennemi hors de combat').toBe(true);
    expect(g().battle!.over, 'la victoire attend le Destin').toBeFalsy();
    g().fenetreChoisir('destin', 'issue', 'survivre');
    draineCascade(g);
    banc.jusquA((s) => !!s.battle?.over, 20);
    expect(g().battle!.over).toBe('victoire');
    const duGroupeT = g().party.find((h) => h.id === T!.id)!;
    expect(duGroupeT.fate).toBe(fate - 1);
    expect(duGroupeT.outOfRencontre).toBeFalsy();
    expect(duGroupeT.pos).toEqual(posDuGroupe);
  });
});
