import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { castSpell, routeCounterspell, counterspellCandidates } from './combatFlow';
import { intentAllowedFor, influencesLocally, canFixDie } from './netOwnership';
import { seedBattleRng } from './battleRng';
import { setDesFixes } from '../engine/fixedDie';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { GameState } from './store';

/**
 * #1028 — Contre-sort (Dissipation, LDB 46 l.156) : le surfaçage suit la POSSESSION, jamais le `kind`
 * (doctrine #989 `defenseSurfaced`/`jetSurfaced`, #1005 `seatInfluences`). Un contre-lanceur ENNEMI
 * conduit par le siège MJ prend SA rangée dans la fenêtre (choix, influences, dé fixé) au lieu d'être
 * roulé en silence ; sans siège MJ, il reste à l'IA — chemin inline BIT-À-BIT inchangé (différentielle).
 */
const NET0 = { mode: 'local' as const, mySeat: 0, gmSeat: undefined, ownership: {} };

/** Héros sorcier (Langue (Magick)) + ennemie contre-lanceuse façon Eusapia, à portée l'un de l'autre. */
function setup() {
  const hero = createHero({
    speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W',
    careerTalent: 'Magie mineure', rng: makeRNG(707),
  });
  hero.spells = ['flechette'];
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(testScene);
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const enemies = b.combatants.filter((c) => c.kind === 'enemy');
  enemies.slice(1).forEach((e) => (e.dead = true));
  const E = enemies[0];
  E.characteristics.intelligence = 48; E.characteristics['force-mentale'] = 53;
  E.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }];
  E.spells = ['carreau'];
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 12, y: 10 };
  useGame.setState({ battle: { ...b }, pendingCounterspell: null, net: { ...useGame.getState().net, ...NET0 } });
  return { H, E };
}

/** Incantation FIGÉE du héros (réussie, non critique) : la fenêtre de Contre-sort a seulement un jet
 *  à trancher — aucun aléa de l'incantation n'entre dans la différentielle. */
function freezeHeroCast(H: Combatant, E: Combatant) {
  useGame.setState({
    pendingCounterspell: null,
    pendingCast: {
      casterId: H.id, targetId: E.id, spellId: 'flechette', missile: true, focused: false,
      result: { cast: true, roll: 30, target: 60, sl: 3, isCritical: false, isFumble: false, log: 'Sort lancé' },
    },
  } as unknown as Partial<GameState>);
  E.dispelledThisRound = undefined;
}

const net = (over: Partial<GameState['net']>) =>
  useGame.setState({ net: { ...useGame.getState().net, ...NET0, ...over } as GameState['net'] });

describe('#1028 — Contre-sort : la POSSESSION décide du surfaçage, jamais le kind', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null, pendingCounterspell: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); setDesFixes(false); useGame.setState({ net: { ...useGame.getState().net, ...NET0 } as GameState['net'] }); });

  it('A — siège MJ posé : le contre-lanceur ENNEMI d’un Sort de héros prend une rangée INTERACTIVE (plus de jet volé)', () => {
    useGame.getState().seedRng(3);
    const { H, E } = setup();
    net({ gmSeat: 0 });
    castSpell(useGame.getState, useGame.setState, H, E, 'flechette');
    useGame.getState().castRoll();
    const pcs = useGame.getState().pendingCounterspell;
    expect(pcs, 'la fenêtre de Contre-sort s’ouvre au lieu du jet inline').toBeTruthy();
    expect(pcs!.participants.map((p) => p.id)).toEqual([E.id]);
    expect(pcs!.participants[0].interactive, 'rangée du MJ : choix, influences, dé fixé').toBe(true);
    expect(pcs!.participants[0].result, 'rien n’est roulé avant que le MJ ne le décide').toBeNull();
    expect(useGame.getState().pendingCast!.result!.log, 'aucun Contre-sort en fait accompli').not.toContain('Contre-sort');
    expect(E.dispelledThisRound, 'l’essai du Round n’est pas consommé sans jet').toBeFalsy();
    // Fenêtre PARTAGÉE : l'étape `cast` bascule en groupe (le MJ voit la modale du lanceur héros).
    const step = useGame.getState().pendingCascade?.participants.find((s) => s.jet === 'cast');
    expect(step?.groupOwner, 'étape de GROUPE : la fenêtre porte les jets de deux sièges').toBe(true);
  });

  it('B — la rangée ennemie appartient au SEUL siège MJ (intent + affichage + dé fixé)', () => {
    useGame.getState().seedRng(3);
    const { H, E } = setup();
    net({ mode: 'host', mySeat: 2, gmSeat: 2, ownership: { [H.id]: 1 }, slots: [0, 1, 0, 0] } as Partial<GameState['net']>);
    castSpell(useGame.getState, useGame.setState, H, E, 'flechette');
    useGame.getState().castRoll();
    expect(useGame.getState().pendingCounterspell!.participants[0].id).toBe(E.id);
    const s = useGame.getState();
    for (const verb of ['counterspellRoll', 'counterspellForceSuccess', 'counterspellDarkPact']) {
      expect(intentAllowedFor(s, 2, verb, [E.id]), `${verb} — siège MJ`).toBe(true);
      expect(intentAllowedFor(s, 0, verb, [E.id]), `${verb} — hôte non MJ`).toBe(false);
      expect(intentAllowedFor(s, 1, verb, [E.id]), `${verb} — joueur : ce n’est pas son jet`).toBe(false);
    }
    expect(influencesLocally(s, E.id), 'siège local = MJ → la rangée est influençable').toBe(true);
    setDesFixes(true);
    expect(canFixDie(useGame.getState(), E.id), 'dé fixé offert au MJ sur SA rangée').toBe(true);
    net({ mode: 'host', mySeat: 1, gmSeat: 2, ownership: { [H.id]: 1 }, slots: [0, 1, 0, 0] } as Partial<GameState['net']>);
    expect(influencesLocally(useGame.getState(), E.id), 'siège local = joueur → rangée en lecture').toBe(false);
    expect(canFixDie(useGame.getState(), E.id)).toBe(false);
  });

  it('C — SOLO (aucun siège MJ) : aucune fenêtre, et l’ennemie chante inline — BIT-À-BIT (différentielle seedée)', () => {
    useGame.getState().seedRng(3);
    const { H, E } = setup();
    // (1) chemin INLINE (solo) : l'aiguilleur ne surface rien et laisse le meilleur lanceur chanter.
    freezeHeroCast(H, E);
    seedBattleRng(11);
    const opened = routeCounterspell(useGame.getState, useGame.setState);
    expect(opened, 'aucun contre-lanceur possédé → pas de fenêtre').toBe(false);
    expect(useGame.getState().pendingCounterspell).toBeNull();
    const inline = useGame.getState().pendingCast!.result;
    expect(inline!.log, 'le Contre-sort a bien été chanté par l’IA').toContain('Contre-sort');
    expect(E.dispelledThisRound).toBe(true);

    // (2) MÊME jet, chemin FENÊTRE (siège MJ) : la rangée est jouée puis agrégée. À dés égaux, l'issue
    // déposée dans `pendingCast` doit être la MÊME — la fenêtre ne change QUE qui lance le dé.
    freezeHeroCast(H, E);
    net({ gmSeat: 0 });
    seedBattleRng(11);
    expect(routeCounterspell(useGame.getState, useGame.setState)).toBe(true);
    // PHASE 1 (#1042/#1059) : la rangée du MJ déclare « contrer seul » — c'est le geste que le chemin
    // inline pose d'office pour l'IA ; les dés ne partent qu'ensuite (la différentielle porte sur eux).
    useGame.getState().counterspellDeclare(E.id, 'solo');
    useGame.getState().counterspellRoll(E.id);
    useGame.getState().counterspellConfirm();
    const windowed = useGame.getState().pendingCast!.result;
    expect(windowed).toEqual(inline);
    // La modale du LANCEUR reste ouverte : l'issue revient là où le jet inline la déposait, le héros applique.
    expect(useGame.getState().pendingCast, 'le lanceur surfacé garde sa modale (Surincantation, « Appliquer »)').toBeTruthy();
    expect(useGame.getState().pendingCounterspell).toBeNull();
  });

  it('D — Sort ENNEMI (IA) : chaque contre-lanceur héros garde SA rangée, à SON siège', () => {
    useGame.getState().seedRng(3);
    const w2 = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W2', careerTalent: 'Magie mineure', rng: makeRNG(101) });
    w2.spells = ['flechette'];
    const { H, E } = setup();
    const b = useGame.getState().battle!;
    const h2 = { ...w2, id: 'h2', pos: { x: 10, y: 11 }, kind: 'hero' } as unknown as Combatant;
    useGame.setState({ battle: { ...b, combatants: [...b.combatants, h2], order: [...b.order, h2.id] } });
    net({ mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { [h2.id]: 1 }, slots: [0, 1, 0, 0] } as Partial<GameState['net']>);
    expect(counterspellCandidates(useGame.getState().battle, useGame.getState().scene, E, H).map((c) => c.id))
      .toEqual(expect.arrayContaining([H.id, h2.id]));
    castSpell(useGame.getState, useGame.setState, E, H, 'carreau'); // lanceur IA : jet figé + aiguillage
    const pcs = useGame.getState().pendingCounterspell;
    expect(pcs, 'Sort ennemi abouti → la fenêtre s’ouvre').toBeTruthy();
    expect(pcs!.participants.map((p) => p.id)).toEqual(expect.arrayContaining([H.id, h2.id]));
    expect(pcs!.participants.every((p) => p.interactive), 'deux héros joués → deux rangées interactives').toBe(true);
    const s = useGame.getState();
    expect(intentAllowedFor(s, 0, 'counterspellRoll', [H.id]), 'rangée du héros de l’hôte').toBe(true);
    expect(intentAllowedFor(s, 1, 'counterspellRoll', [H.id]), 'un siège ne joue pas la rangée d’un autre').toBe(false);
    expect(intentAllowedFor(s, 1, 'counterspellRoll', [h2.id]), 'rangée du héros du siège 1').toBe(true);
    expect(intentAllowedFor(s, 0, 'counterspellRoll', [h2.id])).toBe(false);
  });
});
