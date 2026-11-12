import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { emptyScene, type Scene } from './monde/scene';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { placeCombatant } from './monde/spawn';
import { testScene } from '../scenes/test-fixture';
import { avanceEtapeCascade } from './cascade.testkit';
import { planFranchissement } from './fallMove';
import { phaseDeChute } from './fallMove';
import { REFUS_FRANCHISSEMENT } from './gesteDArete';
import { setRule, resetRule } from '../engine/policy';
import type { TombantParticipant } from './pendings';
import { t } from '../i18n';
import { blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

/**
 * Câblage de la chute VOLONTAIRE (LDB 15 l.82 ; EDO 01 l.231) : `franchirLArete` ouvre une étape À
 * PARTICIPANTS — une rangée par TOMBANT (le groupe en exploration, l'actif en combat), chacune DÉCLARE
 * (`jetRegler('chute', 'suspendre' | 'tenter', …, id)`). Toutes sautent sans Test → résolution IMMÉDIATE ; sinon « Appliquer »
 * (`jetValider('chute')`). Chaque tombant subit SA hauteur ; réduite à 0 m ou moins → AUCUN Dégât.
 */

// Falaise de 4 m entre le sommet (2,0) à 4 m et le pied (2,1) à 0 m — AUCUNE arête `climb`.
function cliffScene(): Scene {
  const s = emptyScene('scene-test', 4, 4);
  const w = 4;
  const h = new Array(w * 4).fill(0) as number[];
  h[0 * w + 2] = 4;
  s.layers[0].height = h;
  return s;
}
const top = { x: 2, y: 0 };
const foot = { x: 2, y: 1 };
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const g = () => banc.getState();
const rangee = (id: string): TombantParticipant => g().pendingFall!.participants.find((x) => x.id === id)!;
/** Pose le résultat du Test d'une rangée (le dé est testé par `jetLancer('chute')` ci-dessous). */
function poserResultat(id: string, result: NonNullable<TombantParticipant['result']>): void {
  const p = g().pendingFall!;
  banc.setState({ pendingFall: { ...p, participants: p.participants.map((x) => (x.id === id ? { ...x, result } : x)) } });
}
/** DRAINE la séquence et rend chaque 1d10 de chute joué à la porte (#1508) : `[tombant, mètres]`. */
function drainerChutes(): (readonly [string | undefined, unknown])[] {
  const vues = new Map<string, readonly [string | undefined, unknown]>();
  for (let i = 0; i < 50 && g().pendingCascade; i++) {
    const p = g().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur?.kind === 'chuteDe') vues.set(cur.id, [cur.actorId, cur.meta?.chuteMetres] as const);
    avanceEtapeCascade(g);
  }
  return [...vues.values()];
}

describe('franchirLArete, chute — exploration, un tombant', () => {
  let H = '';
  beforeEach(() => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    H = hero.id;
    banc.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: top, scene: cliffScene(), pendingFall: null, pendingCascade: null });
  });

  it('ouvre l’étape : hauteur RÉELLE, une rangée non déclarée, phase dérivée `choice`', () => {
    g().franchirLArete(foot);
    const p = g().pendingFall!;
    expect(p).toMatchObject({ metres: 4, initiateurId: H });
    expect(p.participants).toEqual([{ id: H, interactive: true, attempt: null, result: null }]);
    expect(phaseDeChute(p)).toBe('choix');
  });

  it('« Tenter » fait AVANCER la phase dérivée de l’état : choice → roll (#1117)', () => {
    g().franchirLArete(foot);
    g().jetRegler('chute', 'tenter', true, H);
    expect(phaseDeChute(g().pendingFall!), 'la phase se lit sur l’état, jamais au site UI').toBe('jet');
  });

  it('geste inapplicable (pas une falaise descendante) → refus NOMMÉ (la raison du plan `none`)', () => {
    banc.setState({ partyPos: foot, journal: [] });
    g().franchirLArete(top); // sens ascendant
    expect(g().pendingFall).toBeNull();
    const plan = planFranchissement(cliffScene(), foot, top);
    if (plan.kind !== 'none') throw new Error('le sens ascendant doit être un plan `none`');
    expect(g().journal.slice(-1)[0]).toBe(t(REFUS_FRANCHISSEMENT[plan.raison]));
  });

  it('sans scène, le saut est refusé EN LE DISANT (porteur du geste, `gesteDArete`)', () => {
    banc.setState({ scene: null, journal: [] });
    g().franchirLArete(foot);
    expect(g().pendingFall).toBeNull();
    expect(g().journal.slice(-1)[0]).toBe(t('geste.refus.aucuneScene'));
  });

  it('une déclaration PÉRIMÉE (double clic coop, saut résolu, tombant étranger) est refusée EN LE DISANT', () => {
    banc.setState({ journal: [] });
    g().jetRegler('chute', 'tenter', true, H);
    expect(g().journal.slice(-1)[0], 'aucun saut en attente').toBe(t('jet.ferme.sansJet'));

    g().franchirLArete(foot);
    g().jetRegler('chute', 'tenter', true, 'etranger');
    expect(g().journal.slice(-1)[0], 'id hors des rangées, les tombants nommés avec leur id').toMatch(new RegExp(`^Déclaration refusée : etranger ne prend pas part à ce saut ; tombants : .*\\(${H}\\)`));

    g().jetRegler('chute', 'tenter', true, H);
    const declare = g().pendingFall;
    g().jetRegler('chute', 'tenter', false, H);
    expect(g().journal.slice(-1)[0], 'rangée déjà déclarée').toBe(t('fall.refus.dejaDeclare'));
    expect(g().pendingFall, 'la seconde déclaration ne touche rien').toBe(declare);
  });

  it('« Sauter » (seule rangée) résout IMMÉDIATEMENT : chute PLEINE, le groupe atterrit au pied', () => {
    const before = g().party[0].wounds.current;
    g().franchirLArete(foot);
    g().jetRegler('chute', 'tenter', false, H);
    expect(g().pendingFall).toBeNull();
    expect(g().partyPos).toEqual({ ...foot, z: 0 });
    // Le 1d10 des Dégâts est un DÉ DU JEU (#1508) : il tombe à la porte, en étape à dé nu appendue.
    expect(g().party[0].wounds.current, 'rien n’est encaissé avant le dé').toBe(before);
    expect(drainerChutes()).toEqual([[H, 4]]);
    expect(g().party[0].wounds.current).toBeLessThan(before); // 3×4m + 1d10 − BE
  });

  it('« Tenter » ouvre le Test — aucune résolution avant `jetValider(\'chute\')`', () => {
    g().franchirLArete(foot);
    g().jetRegler('chute', 'tenter', true, H);
    expect(rangee(H)).toMatchObject({ attempt: true, result: null });
    g().jetValider('chute'); // sans jet : refusé
    expect(g().pendingFall).not.toBeNull();
    expect(g().partyPos).toEqual(top);
  });

  it('Test réussi, réduction à 0 m ou moins → AUCUN Dégât (bypass, pas juste `applyFall(0,…)`)', () => {
    const before = g().party[0].wounds.current;
    g().franchirLArete(foot);
    g().jetRegler('chute', 'tenter', true, H);
    poserResultat(H, { success: true, roll: 5, target: 90, dr: 6, effectiveMetres: 0 });
    g().jetValider('chute');
    expect(g().pendingFall).toBeNull();
    expect(g().partyPos).toEqual({ ...foot, z: 0 });
    expect(drainerChutes(), 'aucun 1d10 de chute ouvert').toEqual([]);
    expect(g().party[0].wounds.current).toBe(before);
    expect(g().journal.slice(-1)[0]).toBe(t('fall.jumpSafe', { name: 'H' }));
  });

  it('Test réussi, réduction partielle → la chute de `effectiveMetres`, pas la hauteur pleine', () => {
    g().franchirLArete(foot);
    g().jetRegler('chute', 'tenter', true, H);
    poserResultat(H, { success: true, roll: 40, target: 90, dr: 2, effectiveMetres: 2 });
    g().jetValider('chute');
    expect(drainerChutes()).toEqual([[H, 2]]);
  });

  it('jetLancer@chute résout via resolveDeliberateFall : effectiveMetres = max(0, metres − max(0,dr))', () => {
    g().ensemencerLeTirage(3);
    g().franchirLArete(foot);
    g().jetRegler('chute', 'tenter', true, H);
    g().jetLancer('chute', H);
    const r = rangee(H).result!;
    expect(r.effectiveMetres).toBe(Math.max(0, 4 - Math.max(0, r.dr)));
  });

  it('jetLancer@chute AVANT la déclaration (attempt=null) : le flux gate sur `attempt`, aucun jet', () => {
    g().franchirLArete(foot);
    g().jetLancer('chute', H);
    expect(rangee(H).result).toBeNull();
  });

  it('jetAnnuler@chute : ferme la modale sans effet', () => {
    g().franchirLArete(foot);
    g().jetAnnuler('chute');
    expect(g().pendingFall).toBeNull();
    expect(g().partyPos).toEqual(top);
  });
});

describe('franchirLArete, chute — exploration, le groupe tombe (EDO 01 l.231)', () => {
  let A = '';
  let B = '';
  beforeEach(() => {
    const a = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    const b = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 2 });
    A = a.id;
    B = b.id;
    banc.setState({ battle: null, party: [a, b], mode: 'exploration', partyPos: top, scene: cliffScene(), pendingFall: null, pendingCascade: null, journal: [] });
  });
  afterEach(() => resetRule('chute-tombant-non-debout'));

  it('une rangée par tombant, le meneur en tête ; les jets restent verrouillés tant qu’une rangée n’a pas déclaré', () => {
    g().franchirLArete(foot);
    expect(g().pendingFall!.participants.map((x) => x.id)).toEqual([A, B]);
    g().jetRegler('chute', 'tenter', true, A);
    expect(phaseDeChute(g().pendingFall!)).toBe('choix');
    g().jetLancer('chute', A);
    expect(rangee(A).result, 'B n’a pas déclaré : aucun jet').toBeNull();
  });

  it('chacun est blessé selon SA déclaration : A saute (4 m pleins), B tente et réduit à 1 m', () => {
    const avant = g().party.map((h) => h.wounds.current);
    g().franchirLArete(foot);
    g().jetRegler('chute', 'tenter', false, A);
    expect(g().pendingFall, 'B n’a pas déclaré : l’étape reste ouverte').not.toBeNull();
    g().jetRegler('chute', 'tenter', true, B);
    poserResultat(B, { success: true, roll: 20, target: 90, dr: 3, effectiveMetres: 1 });
    g().jetValider('chute');
    expect(g().partyPos).toEqual({ ...foot, z: 0 });
    expect(drainerChutes()).toEqual([[A, 4], [B, 1]]);
    const apres = g().party.map((h) => h.wounds.current);
    expect(apres[0], 'A est blessé').toBeLessThan(avant[0]);
    // B : 3×1 m + 1d10 − BE (LDB 15 l.80) peut ne rien coûter — SON dé de 1 m, ci-dessus, fait la preuve.
    expect(apres[1]).toBeLessThanOrEqual(avant[1]);
  });

  it('un tombant réduit à 0 m ne subit rien, l’autre subit sa chute', () => {
    const avant = g().party.map((h) => h.wounds.current);
    g().franchirLArete(foot);
    g().jetRegler('chute', 'tenter', true, A);
    g().jetRegler('chute', 'tenter', false, B);
    poserResultat(A, { success: true, roll: 5, target: 90, dr: 6, effectiveMetres: 0 });
    g().jetValider('chute');
    expect(drainerChutes()).toEqual([[B, 4]]);
    expect(g().party[0].wounds.current).toBe(avant[0]);
    expect(g().party[1].wounds.current).toBeLessThan(avant[1]);
    expect(g().journal).toContain(t('fall.jumpSafe', { name: 'A' }));
  });

  it('les deux sautent sans Test → résolution IMMÉDIATE, deux chutes pleines', () => {
    g().franchirLArete(foot);
    g().jetRegler('chute', 'tenter', false, A);
    g().jetRegler('chute', 'tenter', false, B);
    expect(g().pendingFall).toBeNull();
    expect(drainerChutes()).toEqual([[A, 4], [B, 4]]);
  });

  it('maison `refus` (défaut) : un membre vivant non debout → refus NOMMÉ du geste', () => {
    banc.setState({ party: g().party.map((h) => (h.id === B ? blessuresSurLeProfil({ ...h, wounds: { ...h.wounds, current: 0 } }) : h)) });
    g().franchirLArete(foot);
    expect(g().pendingFall).toBeNull();
    expect(g().journal.slice(-1)[0]).toBe(t('fall.refus.nonDebout', { name: 'B' }));
    expect(g().partyPos).toEqual(top);
  });

  it('maison `chute-pleine` : le membre non debout est une rangée TÉMOIN qui tombe de toute la hauteur, sans Test', () => {
    setRule('chute-tombant-non-debout', 'chute-pleine');
    banc.setState({ party: g().party.map((h) => (h.id === B ? blessuresSurLeProfil({ ...h, wounds: { ...h.wounds, current: 0 } }) : h)) });
    g().franchirLArete(foot);
    expect(rangee(B)).toEqual({ id: B, interactive: false, attempt: false, result: null });
    g().jetRegler('chute', 'tenter', true, B);
    expect(rangee(B).attempt, 'une rangée témoin ne déclare pas').toBe(false);
    g().jetRegler('chute', 'tenter', false, A);
    expect(g().pendingFall).toBeNull();
    expect(drainerChutes()).toEqual([[A, 4], [B, 4]]);
  });
});

describe('franchirLArete, chute — combat', () => {
  beforeEach(() => {
    banc.setState({ battle: null });
  });
  afterEach(() => {
    banc.abandonner();
  });

  function setup(atPos = top) {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const sc = cliffScene();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    b.combatants.filter((c) => c.kind === 'ennemi').forEach((e) => (e.dead = true));
    H.engagedWith = [];
    placeCombatant(H, sc, atPos);
    banc.setState({ scene: sc, battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false, movedPreAction: false, reachable: new Map(), preview: null } });
    return { H };
  }

  it('« Sauter » (chute PLEINE) : le héros atterrit au pied, l’Action N’EST PAS consommée (pas de Test)', () => {
    const { H } = setup();
    banc.getState().franchirLArete(foot);
    expect(banc.getState().pendingFall!.participants.map((x) => x.id), 'combat : un seul tombant, l’actif').toEqual([H.id]);
    banc.getState().jetRegler('chute', 'tenter', false, H.id);
    const b = banc.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 1 });
    expect(b.acted).toBe(false);
  });

  it('« Tenter » : le Test consomme l’Action (LDB 13 l.86-88), une fois `jetValider(\'chute\')` appelé', () => {
    const { H } = setup();
    banc.getState().franchirLArete(foot);
    banc.getState().jetRegler('chute', 'tenter', true, H.id);
    poserResultat(H.id, { success: true, roll: 40, target: 90, dr: 2, effectiveMetres: 2 });
    banc.getState().jetValider('chute');
    const b = banc.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 1 });
    expect(b.acted).toBe(true);
  });

  it('geste inapplicable (pas de falaise adjacente) → refus NOMMÉ, aucune modale', () => {
    setup(foot);
    banc.setState({ journal: [] });
    banc.getState().franchirLArete(top); // ascendant depuis le pied
    expect(banc.getState().pendingFall).toBeNull();
    const plan = planFranchissement(cliffScene(), foot, top);
    if (plan.kind !== 'none') throw new Error('le sens ascendant doit être un plan `none`');
    expect(banc.getState().refus?.texte, 'combat : la bannière (`refuserGeste`)').toBe(t(REFUS_FRANCHISSEMENT[plan.raison]));
  });
});
