import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { frenzyTarget } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

/**
 * Contraintes de Frénésie pour le HÉROS (LDB 21 l.33) : « vous devez vous déplacer à votre maximum
 * en direction de l'ennemi le plus proche dans votre Ligne de Vue pour l'attaquer. La seule Action
 * possible est un Test de Capacité de Combat ou un Test d'Athlétisme. »
 */
describe('Frénésie héros — cible imposée et déplacement contraint', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null, pendingAttack: null }); });
  afterEach(() => { vi.useRealTimers(); });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const foes = b.combatants.filter((c) => c.kind === 'enemy');
    const [E1, E2] = foes;
    for (const e of foes.slice(2)) e.wounds.current = 0;
    H.pos = { x: 6, y: 10 };
    (H.psychState ??= []).push({ type: 'frenesie' });
    E1.pos = { x: 8, y: 10 }; // le plus PROCHE (2 cases)
    E2.pos = { x: 12, y: 10 }; // plus loin (6 cases)
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false } });
    return { H, E1, E2 };
  }

  it('frenzyTarget = l’ennemi le plus proche en Ligne de Vue', () => {
    const { H, E1 } = setup();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(frenzyTarget(useGame.getState, h)?.id).toBe(E1.id);
  });

  it('attaquer un AUTRE ennemi que le plus proche est refusé ; le plus proche passe', () => {
    const { E1, E2 } = setup();
    vi.clearAllTimers(); // largue le turn-handoff résiduel du setup (le tour a été forcé sur le héros)
    useGame.getState().battleClickEntity(E2.id, { confirm: true });
    expect(useGame.getState().pendingAttack).toBeNull(); // refusé : pas le plus proche
    useGame.getState().battleClickEntity(E1.id, { confirm: true });
    vi.runOnlyPendingTimers(); // joue le glissé d'approche (charge) → ouvre la frappe
    expect(useGame.getState().pendingAttack?.targetId).toBe(E1.id); // charge/attaque sur la cible imposée
  });

  it('entrée en Frénésie ce Tour (Action dépensée) : la CHARGE vers la cible imposée reste permise (LDB 21 l.33)', () => {
    const { H, E1 } = setup();
    // Le Test de FM pour ENTRER en Frénésie a consommé l'Action (acted), mais PAS le Mouvement : le
    // frénétique « doit se déplacer à son maximum vers l'ennemi le plus proche pour l'attaquer ».
    const b = useGame.getState().battle!;
    const Hc = b.combatants.find((c) => c.id === H.id)!;
    Hc.talents = [...(Hc.talents ?? []), { talentId: 'frenesie', times: 1 }]; // talent Frénésie → attaque d'arme libre dispo (donnée)
    useGame.setState({ battle: { ...b, acted: true }, pendingAttack: null });
    vi.clearAllTimers();
    useGame.getState().battleClickEntity(E1.id, { confirm: true }); // E1 à 2 cases → CHARGE (déplacement + attaque)
    vi.runOnlyPendingTimers(); // joue le glissé d'approche → ouvre la frappe
    const pa = useGame.getState().pendingAttack;
    expect(pa?.targetId).toBe(E1.id); // la charge s'ouvre malgré l'Action dépensée (≠ blocage « attaque directe seulement »)
    expect(pa?.fromCharge).toBe(true);
  });

  it('se déplacer en s’ÉLOIGNANT de la cible imposée est refusé ; s’en rapprocher passe', () => {
    const { H } = setup();
    const before = { ...useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    useGame.getState().battleClickTile({ x: before.x - 2, y: before.y }, { confirm: true }); // s'éloigne
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(before);
    useGame.getState().battleClickTile({ x: before.x + 1, y: before.y }, { confirm: true }); // se rapproche
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: before.x + 1, y: before.y });
  });

  // ── L'OBLIGATION NE S'ARME PAS (spec HUD § ARBITRAGE 2026-08-19 × LDB 21 l.33) ──────────────────
  // Le modèle de gestes révisé demande d'ARMER la Course (au-delà de la Marche) et la Charge (approche
  // vers l'ennemi cliqué). Mais le RAW IMPOSE les deux au frénétique — verbatim l.33 : « vous devez
  // vous déplacer à votre maximum en direction de l'ennemi le plus proche dans votre Ligne de Vue pour
  // l'attaquer. La seule Action possible est un Test de Capacité de Combat ou un Test d'Athlétisme
  // pour atteindre votre ennemi le plus rapidement possible. » Ce que la règle impose ne se demande
  // pas : les deux gates s'effacent devant la Frénésie.
  it('COURSE imposée : au-delà de la Marche, VERS la cible, SANS case Course armée → la Course part', () => {
    const { E1, E2 } = setup();
    const b = useGame.getState().battle!;
    b.combatants.find((c) => c.id === E2.id)!.wounds.current = 0; // E1 reste la cible imposée
    b.combatants.find((c) => c.id === E1.id)!.pos = { x: 14, y: 10 };
    useGame.setState({ battle: { ...b }, localIntent: null, refus: null, pendingRun: null });
    const loin = { x: 11, y: 10 }; // 5 cases : au-delà de la Marche (M4), et ça RAPPROCHE de la cible
    useGame.getState().battleClickTile(loin, { confirm: true });
    expect(useGame.getState().refus, 'l’Athlétisme imposé par la Frénésie a été refusé').toBeNull();
    expect(useGame.getState().pendingRun ?? useGame.getState().pendingCascade, 'la Course imposée n’est pas partie').toBeTruthy();
  });

  it('APPROCHE imposée : attaque d’Arme qui COÛTE l’Action (gratuite déjà consommée), sans Charge armée', () => {
    const { H, E1 } = setup();
    const b = useGame.getState().battle!;
    const Hc = b.combatants.find((c) => c.id === H.id)!;
    Hc.freeAttacksThisTurn = { arme: 1 } as never; // l'attaque libre du Round est passée → l'Arme coûte l'Action
    useGame.setState({ battle: { ...b }, localIntent: null, refus: null, pendingAttack: null });
    vi.clearAllTimers();
    useGame.getState().battleClickEntity(E1.id, { confirm: true }); // E1 à 2 cases : hors d'Allonge
    vi.runOnlyPendingTimers();
    expect(useGame.getState().refus, 'le déplacement IMPOSÉ par la Frénésie a été refusé').toBeNull();
    expect(useGame.getState().pendingAttack?.targetId, 'le frénétique n’a pas pu rejoindre sa cible imposée').toBe(E1.id);
  });
});
