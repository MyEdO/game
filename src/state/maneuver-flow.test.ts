/**
 * Flux de MANŒUVRE de créature par modale (`pendingManeuver` + `FLOWS.maneuver`). Un héros qui
 * possède un trait d'attaque de créature (mutation/polymorphie) active Souffle/Vomi/Langue/Regard/
 * Étreinte via la modale de jet d'ATTAQUANT ; Hurlement reste immédiat
 * (pas de jet d'attaquant). Couvre : ouverture sans jet (result===null), Lancer→Appliquer (Avantage
 * dépensé, `acted` selon l'activation, Dégâts/effets), Avantage variable du Regard (+DR → Pétrifié),
 * influence du jet d'attaquant (Résilience/Chance +1 DR).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

describe('FLOWS.maneuver — manœuvre de créature par modale (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingManeuver: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
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
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    E.wounds = { current: 30, max: 30, base: 30 } as Combatant['wounds'];
    E.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, movementUsed: 0, acted: false } });
    return { H, E };
  }

  /** Active une manœuvre SPÉCIALE ciblée comme la hotbar : arme l'attaque (`battleSelectAttack`) puis clique
   *  l'entité (point d'impact / victime) → la zone ouvre `pendingManeuver{targetId}` (1er clic, sans aperçu). */
  function activate(kind: string, targetId: string) {
    useGame.getState().battleSelectAttack(kind);
    useGame.getState().battleClickEntity(targetId);
  }

  it('Souffle : ouvrir n’ouvre PAS de jet (result===null) ; Lancer→Appliquer dépense 2 Av, Action préservée, Dégâts', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.traits = [{ id: 'souffle', value: 15, arg: 'Feu' }];
    H.characteristics['capacite-de-tir'] = 90; // touche déterministe vs Esquive
    H.advantage = 3;
    const before = E.wounds.current;
    activate('souffle-feu', E.id);
    const pm = useGame.getState().pendingManeuver;
    expect(pm).toBeTruthy();
    expect(pm!.kind).toBe('souffle');
    expect(pm!.avantageSpent).toBe(2); // coût RAW (fixe)
    expect(pm!.result).toBeNull(); // rien n’est tiré avant Lancer
    useGame.getState().maneuverRoll();
    expect(useGame.getState().pendingManeuver!.result).toBeTruthy();
    useGame.getState().maneuverConfirm();
    const st = useGame.getState();
    expect(st.pendingManeuver).toBeNull();
    const h2 = st.battle!.combatants.find((c) => c.id === H.id)!;
    const e2 = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(h2.advantage).toBe(1); // 3 − 2
    expect(e2.wounds.current).toBeLessThan(before);
    expect(st.battle!.acted).toBe(false); // gratuite : l’Action reste
  });

  it('Hurlement : reste IMMÉDIAT (pas de pendingManeuver) — jets SUBIS au feed', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.traits = [{ id: 'hurlement-fantomatique' }];
    H.characteristics.initiative = 40;
    H.advantage = 4;
    const before = E.wounds.current;
    useGame.getState().battleManeuverArea('hurlement');
    const st = useGame.getState();
    expect(st.pendingManeuver).toBeNull(); // pas de modale (pas de jet d’attaquant)
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.wounds.current).toBeLessThan(before);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0); // tous les Av dépensés
  });

  it('Étreinte : manœuvre-Action → maneuverConfirm pose `acted`', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.traits = [{ id: 'etreinte-glaciale' }];
    H.characteristics['capacite-de-combat'] = 90;
    H.advantage = 2;
    activate('etreinte-glaciale', E.id);
    const pm = useGame.getState().pendingManeuver;
    expect(pm!.kind).toBe('etreinte');
    expect(pm!.avantageSpent).toBe(2);
    useGame.getState().maneuverRoll();
    useGame.getState().maneuverConfirm();
    const st = useGame.getState();
    expect(st.battle!.acted).toBe(true); // Étreinte = Action (LDB 85 l.112)
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0); // 2 − 2
  });

  it('Regard : Avantage variable → maneuverSetAvantage(2) ajoute +2 DR à la marge (Pétrifié)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.traits = [{ id: 'regard-petrifiant' }];
    H.characteristics['capacite-de-tir'] = 95;
    H.advantage = 6;
    E.characteristics.initiative = 1;
    E.skills = E.skills.filter((s) => s.id !== 'initiative');
    activate('regard-petrifiant', E.id);
    expect(useGame.getState().pendingManeuver!.avantageSpent).toBe(1); // défaut variable = 1
    useGame.getState().maneuverSetAvantage(6); // dépense tout → +6 DR
    expect(useGame.getState().pendingManeuver!.avantageSpent).toBe(6);
    useGame.getState().maneuverRoll();
    useGame.getState().maneuverConfirm();
    const st = useGame.getState();
    expect(st.battle!.acted).toBe(true); // Regard = Action (l.238)
    const e2 = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(e2.conditions.some((c) => c.id === 'Pétrifié') || e2.wounds.current === 0).toBe(true);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0); // 6 dépensés
  });

  it('maneuverSetAvantage clampe à 1..Avantage', () => {
    const { H, E } = setup();
    H.traits = [{ id: 'regard-petrifiant' }];
    H.advantage = 3;
    activate('regard-petrifiant', E.id);
    useGame.getState().maneuverSetAvantage(99);
    expect(useGame.getState().pendingManeuver!.avantageSpent).toBe(3); // plafonné à l’Avantage
    useGame.getState().maneuverSetAvantage(0);
    expect(useGame.getState().pendingManeuver!.avantageSpent).toBe(1); // plancher 1
  });

  it('Résilience : forceSuccess garantit la réussite du jet d’attaquant (touche puis Dégâts)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.traits = [{ id: 'souffle', value: 15, arg: 'Feu' }];
    H.characteristics['capacite-de-tir'] = 1; // raterait sans Résilience
    H.advantage = 3;
    H.resilience = 1;
    const before = E.wounds.current;
    activate('souffle-feu', E.id);
    useGame.getState().maneuverRoll();
    expect(useGame.getState().pendingManeuver!.result!.success).toBe(false); // jet raté
    useGame.getState().maneuverForceSuccess();
    expect(useGame.getState().pendingManeuver!.result!.success).toBe(true); // forcé réussi
    useGame.getState().maneuverConfirm();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.wounds.current).toBeLessThan(before);
  });

  it('orientation : une manœuvre CIBLÉE tourne l’attaquant vers sa cible avant l’animation', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.traits = [{ id: 'souffle', value: 15, arg: 'Feu' }];
    H.characteristics['capacite-de-tir'] = 90;
    H.advantage = 3;
    E.pos = { x: 10, y: 9 }; // adjacente PLEIN NORD de l’attaquant (10,10)
    useGame.setState({ facing: { [H.id]: 'S' } }); // dos tourné à la cible avant la manœuvre
    activate('souffle-feu', E.id);
    useGame.getState().maneuverRoll();
    useGame.getState().maneuverConfirm();
    expect(useGame.getState().facing[H.id]).toBe('N');
  });

  it('orientation : cible choisie MORTE avant la résolution → l’attaquant vise le centre RECENTRÉ, pas le clic périmé', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.traits = [{ id: 'souffle', value: 15, arg: 'Feu' }];
    H.characteristics['capacite-de-tir'] = 90;
    H.advantage = 3;
    const D = useGame.getState().battle!.combatants.find((c) => c.kind === 'enemy' && c.id !== E.id)!;
    D.dead = false;
    D.wounds = { current: 30, max: 30, base: 30 } as Combatant['wounds'];
    D.pos = { x: 10, y: 11 }; // plein SUD : la cible CLIQUÉE
    E.pos = { x: 10, y: 9 }; // plein NORD : le seul ennemi encore debout à la résolution
    useGame.setState({ facing: { [H.id]: 'O' } });
    activate('souffle-feu', D.id);
    useGame.getState().maneuverRoll();
    D.dead = true; // elle tombe avant que le souffle ne parte → la zone se recentre sur le plus proche vivant
    useGame.getState().maneuverConfirm();
    expect(useGame.getState().facing[H.id]).toBe('N');
  });
});
