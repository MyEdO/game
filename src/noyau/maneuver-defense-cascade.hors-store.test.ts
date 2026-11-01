/**
 * GARDE BEHAVIORAL du TROU « jet silencieux » (LDB 85) : un HÉROS pris dans une manœuvre de ZONE d'une
 * créature ENNEMIE (Souffle/Vomi/Regard/Étreinte/Langue) fait un Test de défense que le RAW rend OPPOSÉ,
 * donc INFLUENÇABLE (Chance/Résilience, LDB 17). Il doit être résolu dans une CASCADE (une étape
 * `maneuverDefense` influençable par héros ciblé), PAS en silence au feed.
 *
 * Ce test ÉCHOUE sur l'ancien code (résolution inline muette → aucun `pendingCascade`) et PASSE sur le
 * neuf. Il vérifie AUSSI le cas défenseur IA (un héros active la zone sur des ennemis) : reste silencieux.
 *
 * Le garde statique `roll-modal-invariant` exempte en bloc combatFlow/combatManeuvers (scan incapable de
 * distinguer défenseur héros vs IA) — d'où ce garde COMPORTEMENTAL complémentaire.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { aiCreatureFreeAttacks, applyAreaAttack } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { creatureAttacks } from '../engine/creatureAttacks';
import { findConditionById, resolveStake } from '../data';

import { draineCascade } from './cascade.testkit';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('Défense de manœuvre de zone — cascade influençable (héros) vs silence (IA)', () => {
  /** Groupe de 2 héros NON surpris (donc capables de se défendre) + 1 ennemi à Souffle (Feu) à portée. */
  function setup() {
    const H1 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H1', seed: 1 });
    const H2 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H2', seed: 2 });
    banc.setState({ party: [H1, H2] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.getState().seedRng(2);
    const b = banc.getState().battle!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    const h1 = b.combatants.find((c) => c.label === 'H1')!;
    const h2 = b.combatants.find((c) => c.label === 'H2')!;
    // Ennemi à Souffle (Feu) : range = BE+20 m (large), blast = BF (de la cible-centre).
    E.traits = [{ id: 'souffle', value: 14, arg: 'feu' }]; E.advantage = 2; E.characteristics['capacite-de-tir'] = 85; E.characteristics.endurance = 40;
    E.pos = { x: 5, y: 5 };
    // Deux héros à portée, adjacents entre eux (dans le blast), NON adjacents à l'ennemi (pas de Piétinement).
    for (const h of [h1, h2]) {
      h.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
      h.characteristics.agilite = 1; h.characteristics.force = 30; // BF 3 → blast 2 cases ; Ag 1 → Esquive quasi nulle → l'attaquant l'emporte
      h.wounds = blessuresDeBase(40, 40, h);
      h.skills = h.skills.filter((s) => s.id !== 'esquive');
      h.conditions = []; // PAS Surpris → PEUT se défendre → étape de cascade influençable
    }
    h1.pos = { x: 5, y: 8 };
    h2.pos = { x: 5, y: 9 };
    banc.setState({ battle: { ...b, turn: b.order.indexOf(E.id), acted: true } }); // le Souffle est une attaque GRATUITE (après l'Action)
    return { E, h1, h2 };
  }

  it('Souffle IA sur 2 héros : ouvre une cascade (1 étape influençable/héros), dégâts DIFFÉRÉS (pas de silence)', () => {
    const { E, h1, h2 } = setup();
    const before1 = h1.wounds.current, before2 = h2.wounds.current;
    const suspended = aiCreatureFreeAttacks(banc.getState, banc.setState, E);

    // Tour SUSPENDU : une cascade de défense est ouverte (≠ résolution silencieuse au feed).
    expect(suspended).toBe(true);
    const p = banc.getState().pendingCascade;
    expect(p, 'une manœuvre de zone touchant des héros DOIT ouvrir une cascade de défense (pas de silence)').toBeTruthy();
    expect(p!.purpose).toBe('combat');
    // Reprise du tour de la créature à la fermeture (attaques gratuites restantes / avance).
    expect(p!.maneuverResume).toEqual({ attackerId: E.id, free: true });
    // UNE étape par héros ciblé.
    expect(p!.participants.length).toBe(2);
    for (const step of p!.participants) {
      expect(step.kind).toBe('maneuverDefense');
      // Étape de jet GÉNÉRIQUE influençable (Chance/+1 DR/Pacte/Résilience via CascadeModal) — PAS un `jet:`
      // à hook spécifique ni un résolveur muet : c'est ce qui la rend influençable.
      expect(step.jet).toBeUndefined();
      expect(step.target).toBeGreaterThan(0); // valeur de réaction (Esquive) → jet opposé au jet d'attaquant figé
      expect(step.meta?.opposed?.aT).toBeTruthy(); // jet d'attaquant CT FIGÉ (opposition RAW)
      expect(step.meta?.maneuverDefense?.def.label).toBe('Souffle (Feu)');
      // LDB 85 l.324 : le défenseur lit la règle du Type dans l'enjeu.
      expect(resolveStake(step.stake!).text).toContain(`PA ignorées, puis État ${findConditionById('en-flammes')!.label}`);
      expect(['hero']).toContain(banc.getState().battle!.combatants.find((c) => c.id === step.actorId)!.kind);
    }
    // Les effets restent différés à la validation de chaque étape (non appliqués à ce stade).
    const live = () => banc.getState().battle!.combatants;
    expect(live().find((c) => c.id === h1.id)!.wounds.current).toBe(before1);
    expect(live().find((c) => c.id === h2.id)!.wounds.current).toBe(before2);

    // Drive de la cascade : chaque héros JETTE sa défense (Esquive) puis on valide.
    draineCascade(banc.getState, 2);
    // Après résolution (Esquive ratée → l'attaquant l'emporte) : les DEUX héros ont subi le Souffle.
    expect(live().find((c) => c.id === h1.id)!.wounds.current).toBeLessThan(before1);
    expect(live().find((c) => c.id === h2.id)!.wounds.current).toBeLessThan(before2);
    expect(live().find((c) => c.id === h1.id)!.conditions.some((c) => c.id === 'en-flammes')).toBe(true);
  });

  it('Résilience : forcer la réussite de l’Esquive fait RÉSISTER le héros (aucun effet) — jet influençable', () => {
    const { E, h1 } = setup();
    // Un seul héros à portée pour isoler l'influence (H2 hors zone).
    const b = banc.getState().battle!;
    b.combatants.find((c) => c.id === h1.id)!.resilience = 3;
    (banc.getState().battle!.combatants.find((c) => c.label === 'H2'))!.pos = { x: 30, y: 30 };
    const before = h1.wounds.current;
    aiCreatureFreeAttacks(banc.getState, banc.setState, E);
    const p = banc.getState().pendingCascade!;
    expect(p.participants.length).toBe(1);
    const cur = p.participants[0];
    // « Je ne faillirai pas ! » (Résilience) AVANT le jet → réussite forcée → le héros l'emporte → RÉSISTE.
    banc.getState().cascadeForceSuccess(cur.id);
    banc.getState().cascadeNext();
    const live = banc.getState().battle!.combatants.find((c) => c.id === h1.id)!;
    expect(live.wounds.current).toBe(before); // résisté : aucun Dégât
    expect(live.conditions.some((c) => c.id === 'en-flammes')).toBe(false);
  });

  it('défenseur IA (un HÉROS active la zone sur des ENNEMIS) : reste SILENCIEUX (aucune cascade)', () => {
    const { h1 } = setup();
    // Donne le Souffle au HÉROS et fais-le souffler : ses cibles sont des ENNEMIS → pas d'influence, silence.
    h1.traits = [{ id: 'souffle', value: 14, arg: 'feu' }]; h1.advantage = 2; h1.characteristics['capacite-de-tir'] = 85;
    const enemy = banc.getState().battle!.combatants.find((c) => c.kind === 'enemy' && !c.dead)!;
    enemy.pos = { x: 5, y: 10 }; enemy.characteristics.agilite = 1; // dans le blast du héros, esquive faible
    const a = creatureAttacks(h1.traits).find((x) => x.kind === 'souffle')!;
    const before = enemy.wounds.current;
    const suspended = applyAreaAttack(banc.getState, banc.setState, h1, a);
    expect(suspended).toBe(false); // défenseur IA → jamais de cascade
    expect(banc.getState().pendingCascade).toBeNull();
    // Résolution SILENCIEUSE immédiate : l'ennemi a subi le Souffle au feed.
    expect(banc.getState().battle!.combatants.find((c) => c.id === enemy.id)!.wounds.current).toBeLessThan(before);
  });
});
