import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { emptyScene, type Scene, type WallClimb } from './monde/scene';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { setRule } from '../engine/policy';
import { createHero } from '../engine/character';
import { placeCombatant } from './monde/spawn';
import { memeCase } from './monde/seating';
import { testScene } from '../scenes/test-fixture';
import { draineCascade } from './cascade.testkit';
import { t } from '../i18n';
import { planFranchissement } from './fallMove';
import { REFUS_FRANCHISSEMENT } from './gesteDArete';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc({ desFixes: true }); });

function resoudreLeTest(de: number, sl: number, success = false) {
  banc.getState().jetLancer('test');
  banc.getState().jetImposerLeResultat('test', de);
  expect(banc.getState().pendingTest).toMatchObject({ target: 40, roll: de, sl, success });
  banc.getState().jetValider('test');
}

function chutesOuvertes() {
  return banc.getState().pendingCascade?.participants.filter((etape) => etape.kind === 'chuteDe') ?? [];
}

// Falaise de 4 m entre le pied (2,1) à 0 m et le sommet (2,0) à 4 m ; l'arête N de (2,1) porte la grimpe.
function cliffScene(climb: WallClimb): Scene {
  const s = emptyScene('scene-test', 4, 4);
  const w = 4;
  const h = new Array(w * 4).fill(0) as number[];
  h[0 * w + 2] = 4;
  s.layers[0].height = h;
  s.walls = [{ x: 2, y: 1, side: 'N', climb }];
  return s;
}
const foot = { x: 2, y: 1 };
const top = { x: 2, y: 0 };

describe('franchirLArete, escalade — aucun grimpeur (#1906)', () => {
  it('seul héros à 0 PB, conscient : refus NOMMÉ au journal, le groupe ne bouge pas, rien ne lève', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    hero.wounds.current = 0;
    for (const climb of [{ kind: 'surface', requiresGrimpeur: true }, { kind: 'ladder' }] as WallClimb[]) {
      banc.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: foot, scene: cliffScene(climb), journal: [] });
      expect(() => banc.getState().franchirLArete(top)).not.toThrow();
      expect(banc.getState().journal.map((e) => e.texte).slice(-1)[0]).toBe(t('geste.refus.personne'));
      expect(banc.getState().partyPos).toEqual(foot);
    }
  });
});

describe('franchirLArete, escalade — exploration', () => {
  beforeEach(() => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    hero.characteristics.force = 40;
    hero.skills = [];
    banc.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: foot, scene: cliffScene({ kind: 'ladder' }) });
  });

  it('échelle : le groupe monte au sommet (z-transition, sans Test)', () => {
    banc.setState({ scene: cliffScene({ kind: 'ladder' }), partyPos: foot });
    banc.getState().franchirLArete(top);
    expect(banc.getState().partyPos).toEqual(top);
  });

  it('paroi en montée : le groupe ne bouge qu’après la réussite du Test', () => {
    banc.setState({ scene: cliffScene({ kind: 'surface' }) });
    banc.getState().franchirLArete(top);
    expect(banc.getState().partyPos).toEqual(foot);
    resoudreLeTest(28, 2, true);
    expect(banc.getState().partyPos).toEqual(top);
    expect(chutesOuvertes()).toHaveLength(0);
  });

  it('paroi en descente : le groupe reste au sommet sur un échec ordinaire', () => {
    banc.setState({ scene: cliffScene({ kind: 'surface' }), partyPos: top });
    banc.getState().franchirLArete(foot);
    resoudreLeTest(79, -3);
    expect(banc.getState().partyPos).toEqual(top);
    expect(chutesOuvertes()).toHaveLength(0);
  });

  it('paroi en descente : le groupe atteint le pied sur une réussite', () => {
    banc.setState({ scene: cliffScene({ kind: 'surface' }), partyPos: top });
    banc.getState().franchirLArete(foot);
    expect(banc.getState().partyPos).toEqual(top);
    resoudreLeTest(28, 2, true);
    expect(banc.getState().partyPos).toEqual(foot);
    expect(chutesOuvertes()).toHaveLength(0);
  });

  it('paroi exigeant Grimpeur, Talent absent : le groupe ne bouge pas (refus)', () => {
    banc.setState({ scene: cliffScene({ kind: 'surface', requiresGrimpeur: true }), partyPos: foot });
    banc.getState().franchirLArete(top);
    expect(banc.getState().partyPos).toEqual(foot);
  });

  it('arête non grimpable : aucune capacité, le refus du pas est NOMMÉ, aucun effet', () => {
    const s = cliffScene({ kind: 'ladder' });
    s.walls = [{ x: 2, y: 1, side: 'N' }];
    banc.setState({ scene: s, partyPos: foot, journal: [] });
    banc.getState().franchirLArete(top);
    expect(banc.getState().partyPos).toEqual(foot);
    const plan = planFranchissement(s, foot, top);
    if (plan.kind !== 'none') throw new Error('le sens ascendant doit être un plan `none`');
    expect(banc.getState().journal.map((e) => e.texte).slice(-1)[0]).toBe(t(REFUS_FRANCHISSEMENT[plan.raison]));
  });
});

describe('franchirLArete, escalade — combat', () => {
  beforeEach(() => {
    banc.setState({ battle: null });
  });

  function setup(climb: WallClimb, atPos = foot, sc = cliffScene(climb)) {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    hero.characteristics.force = 40;
    hero.skills = [];
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    b.combatants.filter((c) => c.kind === 'ennemi').forEach((e) => (e.dead = true));
    H.engagedWith = [];
    placeCombatant(H, sc, atPos);
    banc.setState({ scene: sc, battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false, movedPreAction: false, reachable: new Map(), preview: null } });
    return { H };
  }

  it('échelle : le héros actif monte, le Mouvement est consommé, l’Action NON (pas de Test)', () => {
    const { H } = setup({ kind: 'ladder' });
    banc.getState().franchirLArete(top);
    const b = banc.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 0 });
    expect(b.movementUsed).toBeGreaterThan(0); // ½ vitesse sur 4 m (LDB 15 l.55)
    expect(b.acted).toBe(false);
  });

  it('paroi : l’Action est consommée à l’ouverture, le héros monte à la réussite', () => {
    const { H } = setup({ kind: 'surface' });
    banc.getState().franchirLArete(top);
    const b = banc.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject(foot);
    expect(b.acted).toBe(true);
    expect(b.movementUsed).toBeGreaterThan(0);
    resoudreLeTest(28, 2, true);
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toMatchObject(top);
  });

  it('paroi exigeant Grimpeur, Talent absent : le héros ne bouge pas', () => {
    const { H } = setup({ kind: 'surface', requiresGrimpeur: true });
    banc.getState().franchirLArete(top);
    const b = banc.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 1 });
    expect(b.acted).toBe(false);
  });

  // Grimpant (LDB 85 l.160-162) : résolution automatique — aucun Test (même sur une paroi exigeant
  // Grimpeur), coût de Mouvement NORMAL (climbFullSpeed), journalisé.
  it('Grimpant : paroi exigeant Grimpeur — le porteur du trait monte SANS Test, coût normal, journalisé', () => {
    const { H } = setup({ kind: 'surface', requiresGrimpeur: true });
    H.traits = [{ id: 'grimpant' }];
    banc.setState({ battle: { ...banc.getState().battle! } });
    banc.getState().franchirLArete(top);
    const b = banc.getState().battle!;
    const hc = b.combatants.find((c) => c.id === H.id)!;
    expect(hc.pos).toMatchObject({ x: 2, y: 0 });
    expect(b.acted).toBe(false); // pas de Test → pas d'Action consommée
    expect(b.movementUsed).toBe(1); // coût NORMAL (1 case), pas la ½ vitesse du Talent joueur
    expect(b.log.some((e) => e.entree.texte.includes('Grimpant'))).toBe(true);
  });

  it('un échec à −4 DR en montée depuis le pied laisse le héros au sol sans dé de dégâts', () => {
    const { H } = setup({ kind: 'surface' });
    const before = H.wounds.current;
    banc.getState().franchirLArete(top);
    resoudreLeTest(84, -4);
    const grimpeur = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(grimpeur.pos).toMatchObject(foot);
    expect(grimpeur.wounds.current).toBe(before);
    expect(chutesOuvertes()).toHaveLength(0);
  });

  it.each([
    { de: 79, sl: -3, doubles: false, doigts: 0, chute: false, cas: 'échec ordinaire à −3 DR' },
    { de: 84, sl: -4, doubles: false, doigts: 0, chute: true, cas: 'échec à −4 DR' },
    { de: 55, sl: -1, doubles: false, doigts: 0, chute: false, cas: 'double raté sans l’option de Maladresse' },
    { de: 55, sl: -1, doubles: true, doigts: 0, chute: true, cas: 'double raté reconnu comme Maladresse' },
    { de: 51, sl: -1, doubles: false, doigts: 1, chute: true, cas: 'Maladresse liée à un doigt amputé' },
  ])('en descente : $cas', ({ de, sl, doubles, doigts, chute }) => {
    setRule('test-critiques-doubles', doubles);
    const { H } = setup({ kind: 'surface' }, top);
    if (doigts) H.traumas = [{ uid: 'doigt', label: 'Doigt amputé', traumaId: 'doigt-ampute', location: 'brasG', count: doigts }];
    const before = H.wounds.current;
    banc.getState().franchirLArete(foot);
    expect(H.pos).toMatchObject(top);
    resoudreLeTest(de, sl);
    if (chute) {
      expect(H.pos).toMatchObject(foot);
      expect(chutesOuvertes()).toMatchObject([{ actorId: H.id, meta: { chuteMetres: 4 } }]);
      draineCascade(banc.getState);
      expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
    } else {
      expect(H.pos).toMatchObject(top);
      expect(chutesOuvertes()).toHaveLength(0);
      expect(H.wounds.current).toBe(before);
    }
  });

  it('le dernier appui reste occupé par le grimpeur si la seule retombée est prise par un allié', () => {
    const climb = { kind: 'surface' } as const;
    const scene = cliffScene(climb);
    const depart = { ...foot, z: 1 };
    const arrivee = { ...top, z: 2 };
    for (const [z, hauteur] of [[1, 2], [2, 4]]) {
      scene.layers.push({ z, tiles: new Array(16).fill('plancher'), height: new Array(16).fill(hauteur) });
    }
    scene.walls = [{ ...foot, z: 1, side: 'N', climb }];
    const { H } = setup(climb, depart, scene);
    const allie = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Allié', seed: 2 });
    placeCombatant(allie, scene, { ...foot, z: 0 });
    const battle = banc.getState().battle!;
    banc.setState({ battle: { ...battle, combatants: [...battle.combatants, allie] } });

    banc.getState().franchirLArete(arrivee);
    const pc = banc.getState().pendingCascade;
    expect(pc?.participants[pc.cursor]?.stake).toMatchObject({ key: { kind: 'escalade-test-sans-chute' } });
    resoudreLeTest(84, -4);
    expect(H.pos).toMatchObject(depart);
    expect(allie.pos && memeCase(allie.pos, { ...foot, z: 0 })).toBe(true);
    expect(chutesOuvertes()).toHaveLength(0);
  });

  it('règle maison désactivée : un échec à −4 DR laisse le héros au sommet', () => {
    setRule('escalade-chute-sur-echec', false);
    const { H } = setup({ kind: 'surface' }, top);
    banc.getState().franchirLArete(foot);
    resoudreLeTest(84, -4);
    expect(H.pos).toMatchObject(top);
    expect(chutesOuvertes()).toHaveLength(0);
  });
});
