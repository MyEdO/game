import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { emptyScene, type Scene } from './scene';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { placeCombatant } from './spawn';
import { testScene } from '../scenes/test-fixture';
import { avanceEtapeCascade } from './cascadeTestKit';
import { planFranchissement } from './fallMove';
import { phaseDeChute } from './fallMove';
import { REFUS_FRANCHISSEMENT } from './gesteDArete';
import { setRule, resetRule } from '../engine/policy';
import type { TombantParticipant } from './pendings';
import { t } from '../i18n';

/**
 * Câblage de la chute VOLONTAIRE (LDB 15 l.82 ; EDO 01 l.231) : `fallAcross` ouvre une étape À
 * PARTICIPANTS — une rangée par TOMBANT (le groupe en exploration, l'actif en combat), chacune DÉCLARE
 * (`fallChoose(id, …)`). Toutes sautent sans Test → résolution IMMÉDIATE ; sinon « Appliquer »
 * (`fallConfirm`). Chaque tombant subit SA hauteur ; réduite à 0 m ou moins → AUCUN Dégât.
 */

// Falaise de 4 m entre le sommet (2,0) à 4 m et le pied (2,1) à 0 m — AUCUNE arête `climb`.
function cliffScene(): Scene {
  const s = emptyScene(4, 4);
  const w = 4;
  const h = new Array(w * 4).fill(0) as number[];
  h[0 * w + 2] = 4;
  s.layers[0].height = h;
  return s;
}
const top = { x: 2, y: 0 };
const foot = { x: 2, y: 1 };
const g = () => useGame.getState();
const rangee = (id: string): TombantParticipant => g().pendingFall!.participants.find((x) => x.id === id)!;
/** Pose le résultat du Test d'une rangée (le dé est testé par `fallRoll` ci-dessous). */
function poserResultat(id: string, result: NonNullable<TombantParticipant['result']>): void {
  const p = g().pendingFall!;
  useGame.setState({ pendingFall: { ...p, participants: p.participants.map((x) => (x.id === id ? { ...x, result } : x)) } });
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

describe('fallAcross — exploration, un tombant', () => {
  let H = '';
  beforeEach(() => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    H = hero.id;
    useGame.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: top, scene: cliffScene(), pendingFall: null, pendingCascade: null });
  });

  it('ouvre l’étape : hauteur RÉELLE, une rangée non déclarée, phase dérivée `choice`', () => {
    g().fallAcross(top, foot);
    const p = g().pendingFall!;
    expect(p).toMatchObject({ metres: 4, initiateurId: H });
    expect(p.participants).toEqual([{ id: H, interactive: true, attempt: null, result: null }]);
    expect(phaseDeChute(p)).toBe('choice');
  });

  it('« Tenter » fait AVANCER la phase dérivée de l’état : choice → roll (#1117)', () => {
    g().fallAcross(top, foot);
    g().fallChoose(H, true);
    expect(phaseDeChute(g().pendingFall!), 'la phase se lit sur l’état, jamais au site UI').toBe('roll');
  });

  it('geste inapplicable (pas une falaise descendante) → refus NOMMÉ (la raison du plan `none`)', () => {
    useGame.setState({ partyPos: foot, journal: [] });
    g().fallAcross(foot, top); // sens ascendant
    expect(g().pendingFall).toBeNull();
    const plan = planFranchissement(cliffScene(), foot, top);
    if (plan.kind !== 'none') throw new Error('le sens ascendant doit être un plan `none`');
    expect(g().journal.slice(-1)[0]).toBe(t(REFUS_FRANCHISSEMENT[plan.raison]));
  });

  it('sans scène, le saut est refusé EN LE DISANT (porteur du geste, `gesteDArete`)', () => {
    useGame.setState({ scene: null, journal: [] });
    g().fallAcross(top, foot);
    expect(g().pendingFall).toBeNull();
    expect(g().journal.slice(-1)[0]).toBe(t('geste.refus.aucuneScene'));
  });

  it('une déclaration PÉRIMÉE (double clic coop, saut résolu, tombant étranger) est refusée EN LE DISANT', () => {
    useGame.setState({ journal: [] });
    g().fallChoose(H, true);
    expect(g().journal.slice(-1)[0], 'aucun saut en attente').toBe(t('fall.refus.aucunSaut'));

    g().fallAcross(top, foot);
    g().fallChoose('etranger', true);
    expect(g().journal.slice(-1)[0], 'id hors des rangées').toBe(t('fall.refus.horsDuSaut'));

    g().fallChoose(H, true);
    const declare = g().pendingFall;
    g().fallChoose(H, false);
    expect(g().journal.slice(-1)[0], 'rangée déjà déclarée').toBe(t('fall.refus.dejaDeclare'));
    expect(g().pendingFall, 'la seconde déclaration ne touche rien').toBe(declare);
  });

  it('« Sauter » (seule rangée) résout IMMÉDIATEMENT : chute PLEINE, le groupe atterrit au pied', () => {
    const before = g().party[0].wounds.current;
    g().fallAcross(top, foot);
    g().fallChoose(H, false);
    expect(g().pendingFall).toBeNull();
    expect(g().partyPos).toEqual({ ...foot, z: 0 });
    // Le 1d10 des Dégâts est un DÉ DU JEU (#1508) : il tombe à la porte, en étape à dé nu appendue.
    expect(g().party[0].wounds.current, 'rien n’est encaissé avant le dé').toBe(before);
    expect(drainerChutes()).toEqual([[H, 4]]);
    expect(g().party[0].wounds.current).toBeLessThan(before); // 3×4m + 1d10 − BE
  });

  it('« Tenter » ouvre le Test — aucune résolution avant `fallConfirm`', () => {
    g().fallAcross(top, foot);
    g().fallChoose(H, true);
    expect(rangee(H)).toMatchObject({ attempt: true, result: null });
    g().fallConfirm(); // sans jet : refusé
    expect(g().pendingFall).not.toBeNull();
    expect(g().partyPos).toEqual(top);
  });

  it('Test réussi, réduction à 0 m ou moins → AUCUN Dégât (bypass, pas juste `applyFall(0,…)`)', () => {
    const before = g().party[0].wounds.current;
    g().fallAcross(top, foot);
    g().fallChoose(H, true);
    poserResultat(H, { success: true, roll: 5, target: 90, dr: 6, effectiveMetres: 0 });
    g().fallConfirm();
    expect(g().pendingFall).toBeNull();
    expect(g().partyPos).toEqual({ ...foot, z: 0 });
    expect(drainerChutes(), 'aucun 1d10 de chute ouvert').toEqual([]);
    expect(g().party[0].wounds.current).toBe(before);
    expect(g().journal.slice(-1)[0]).toBe(t('fall.jumpSafe', { name: 'H' }));
  });

  it('Test réussi, réduction partielle → la chute de `effectiveMetres`, pas la hauteur pleine', () => {
    g().fallAcross(top, foot);
    g().fallChoose(H, true);
    poserResultat(H, { success: true, roll: 40, target: 90, dr: 2, effectiveMetres: 2 });
    g().fallConfirm();
    expect(drainerChutes()).toEqual([[H, 2]]);
  });

  it('fallRoll (verbe généré, rollFlowSpecs.fall) résout via resolveDeliberateFall : effectiveMetres = max(0, metres − max(0,dr))', () => {
    g().seedRng(3);
    g().fallAcross(top, foot);
    g().fallChoose(H, true);
    g().fallRoll(H);
    const r = rangee(H).result!;
    expect(r.effectiveMetres).toBe(Math.max(0, 4 - Math.max(0, r.dr)));
  });

  it('fallRoll AVANT la déclaration (attempt=null) : le flux gate sur `attempt`, aucun jet', () => {
    g().fallAcross(top, foot);
    g().fallRoll(H);
    expect(rangee(H).result).toBeNull();
  });

  it('fallCancel : ferme la modale sans effet', () => {
    g().fallAcross(top, foot);
    g().fallCancel();
    expect(g().pendingFall).toBeNull();
    expect(g().partyPos).toEqual(top);
  });
});

describe('fallAcross — exploration, le groupe tombe (EDO 01 l.231)', () => {
  let A = '';
  let B = '';
  beforeEach(() => {
    const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    const b = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 2 });
    A = a.id;
    B = b.id;
    useGame.setState({ battle: null, party: [a, b], mode: 'exploration', partyPos: top, scene: cliffScene(), pendingFall: null, pendingCascade: null, journal: [] });
  });
  afterEach(() => resetRule('chute-tombant-non-debout'));

  it('une rangée par tombant, le meneur en tête ; les jets restent verrouillés tant qu’une rangée n’a pas déclaré', () => {
    g().fallAcross(top, foot);
    expect(g().pendingFall!.participants.map((x) => x.id)).toEqual([A, B]);
    g().fallChoose(A, true);
    expect(phaseDeChute(g().pendingFall!)).toBe('choice');
    g().fallRoll(A);
    expect(rangee(A).result, 'B n’a pas déclaré : aucun jet').toBeNull();
  });

  it('chacun est blessé selon SA déclaration : A saute (4 m pleins), B tente et réduit à 1 m', () => {
    const avant = g().party.map((h) => h.wounds.current);
    g().fallAcross(top, foot);
    g().fallChoose(A, false);
    expect(g().pendingFall, 'B n’a pas déclaré : l’étape reste ouverte').not.toBeNull();
    g().fallChoose(B, true);
    poserResultat(B, { success: true, roll: 20, target: 90, dr: 3, effectiveMetres: 1 });
    g().fallConfirm();
    expect(g().partyPos).toEqual({ ...foot, z: 0 });
    expect(drainerChutes()).toEqual([[A, 4], [B, 1]]);
    const apres = g().party.map((h) => h.wounds.current);
    expect(apres[0], 'A est blessé').toBeLessThan(avant[0]);
    // B : 3×1 m + 1d10 − BE (LDB 15 l.80) peut ne rien coûter — SON dé de 1 m, ci-dessus, fait la preuve.
    expect(apres[1]).toBeLessThanOrEqual(avant[1]);
  });

  it('un tombant réduit à 0 m ne subit rien, l’autre subit sa chute', () => {
    const avant = g().party.map((h) => h.wounds.current);
    g().fallAcross(top, foot);
    g().fallChoose(A, true);
    g().fallChoose(B, false);
    poserResultat(A, { success: true, roll: 5, target: 90, dr: 6, effectiveMetres: 0 });
    g().fallConfirm();
    expect(drainerChutes()).toEqual([[B, 4]]);
    expect(g().party[0].wounds.current).toBe(avant[0]);
    expect(g().party[1].wounds.current).toBeLessThan(avant[1]);
    expect(g().journal).toContain(t('fall.jumpSafe', { name: 'A' }));
  });

  it('les deux sautent sans Test → résolution IMMÉDIATE, deux chutes pleines', () => {
    g().fallAcross(top, foot);
    g().fallChoose(A, false);
    g().fallChoose(B, false);
    expect(g().pendingFall).toBeNull();
    expect(drainerChutes()).toEqual([[A, 4], [B, 4]]);
  });

  it('maison `refus` (défaut) : un membre vivant non debout → refus NOMMÉ du geste', () => {
    useGame.setState({ party: g().party.map((h) => (h.id === B ? { ...h, wounds: { ...h.wounds, current: 0 } } : h)) });
    g().fallAcross(top, foot);
    expect(g().pendingFall).toBeNull();
    expect(g().journal.slice(-1)[0]).toBe(t('fall.refus.nonDebout', { name: 'B' }));
    expect(g().partyPos).toEqual(top);
  });

  it('maison `chute-pleine` : le membre non debout est une rangée TÉMOIN qui tombe de toute la hauteur, sans Test', () => {
    setRule('chute-tombant-non-debout', 'chute-pleine');
    useGame.setState({ party: g().party.map((h) => (h.id === B ? { ...h, wounds: { ...h.wounds, current: 0 } } : h)) });
    g().fallAcross(top, foot);
    expect(rangee(B)).toEqual({ id: B, interactive: false, attempt: false, result: null });
    g().fallChoose(B, true);
    expect(rangee(B).attempt, 'une rangée témoin ne déclare pas').toBe(false);
    g().fallChoose(A, false);
    expect(g().pendingFall).toBeNull();
    expect(drainerChutes()).toEqual([[A, 4], [B, 4]]);
  });
});

describe('fallAcross — combat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup(atPos = top) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const sc = cliffScene();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    b.combatants.filter((c) => c.kind === 'enemy').forEach((e) => (e.dead = true));
    H.engagedWith = [];
    placeCombatant(H, sc, atPos);
    useGame.setState({ scene: sc, battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false, movedPreAction: false, reachable: new Map(), preview: null } });
    return { H };
  }

  it('« Sauter » (chute PLEINE) : le héros atterrit au pied, l’Action N’EST PAS consommée (pas de Test)', () => {
    const { H } = setup();
    useGame.getState().fallAcross(top, foot);
    expect(useGame.getState().pendingFall!.participants.map((x) => x.id), 'combat : un seul tombant, l’actif').toEqual([H.id]);
    useGame.getState().fallChoose(H.id, false);
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 1 });
    expect(b.acted).toBe(false);
  });

  it('« Tenter » : le Test consomme l’Action (LDB 13 l.86-88), une fois `fallConfirm` appelé', () => {
    const { H } = setup();
    useGame.getState().fallAcross(top, foot);
    useGame.getState().fallChoose(H.id, true);
    poserResultat(H.id, { success: true, roll: 40, target: 90, dr: 2, effectiveMetres: 2 });
    useGame.getState().fallConfirm();
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 1 });
    expect(b.acted).toBe(true);
  });

  it('geste inapplicable (pas de falaise adjacente) → refus NOMMÉ, aucune modale', () => {
    setup(foot);
    useGame.setState({ journal: [] });
    useGame.getState().fallAcross(foot, top); // ascendant depuis le pied
    expect(useGame.getState().pendingFall).toBeNull();
    const plan = planFranchissement(cliffScene(), foot, top);
    if (plan.kind !== 'none') throw new Error('le sens ascendant doit être un plan `none`');
    expect(useGame.getState().refus?.texte, 'combat : la bannière (`refuserGeste`)').toBe(t(REFUS_FRANCHISSEMENT[plan.raison]));
  });
});
