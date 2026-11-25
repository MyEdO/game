import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { autoCleave, buildAiInput, doAttack, etatDeTourNeuf, mobileDuTour, resumeCleaveChain } from './combatFlow';
import { createHero } from '../engine/character';
import { addCondition } from '../engine/conditions';
import { engage, isEngaged } from '../engine/engagement';
import { testScene } from '../scenes/test-fixture';
import type { AttackResult } from '../engine/combat';
import type { Combatant } from '../engine/types';
import { reluDans } from './combatDeTest.testkit';
import { chooseEnemyAction } from './monde/ai';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { draineCascade } from './cascade.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Un combat enc-mutants à `n` héros, l'ordre piloté par le test ; `vivants` ennemis en jeu, les autres morts. */
function combat(n: number, vivants = 1): { heros: Combatant[]; ennemi: Combatant; ennemis: Combatant[] } {
  const party = Array.from({ length: n }, (_, i) =>
    createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, seed: i + 1 }));
  banc.setState({ party });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const battle = banc.getState().battle!;
  const ennemis = battle.combatants.filter((c) => c.kind === 'ennemi');
  for (const e of ennemis.slice(vivants)) e.dead = true;
  return { heros: battle.combatants.filter((c) => c.kind === 'heros'), ennemi: ennemis[0], ennemis: ennemis.slice(0, vivants) };
}

const aSonTour = (c: Combatant) => {
  const battle = banc.getState().battle!;
  banc.setState({ battle: { ...battle, ...etatDeTourNeuf(), turn: battle.order.indexOf(c.id) } });
};

describe('Engagement lu contre le combat (LDB 13 l.169-171, #5029)', () => {
  it('un adversaire mis hors de combat hors du coup d’arme (Inconscient d’un État) ne retient plus le héros', () => {
    const get = banc.getState;
    const { heros: [h], ennemi } = combat(1);
    h.pos = { x: 10, y: 10 };
    ennemi.pos = { x: 11, y: 10 };
    engage(h, ennemi);
    aSonTour(h);
    expect(mobileDuTour(get(), get().battle!)).toMatchObject({ refus: 'engage' });
    addCondition(reluDans(get, ennemi), 'inconscient');
    expect(reluDans(get, h).engagedWith).toEqual([ennemi.id]);
    expect(mobileDuTour(get(), get().battle!)).not.toHaveProperty('refus');
  });
});

describe('L’IA Engagée ne quitte le contact que par une voie du Désengagement (LDB 15 l.45-49, #5030)', () => {
  it('cloué sans Avantage supérieur ; libre de partir avec l’Avantage à sacrifier, ou plus grand que tous ses Engagés', () => {
    const get = banc.getState;
    const { heros: [h], ennemi } = combat(1);
    h.pos = { x: 10, y: 10 };
    ennemi.pos = { x: 11, y: 10 };
    ennemi.size = 'moyenne';
    h.size = 'moyenne';
    engage(h, ennemi);
    h.advantage = 1;
    ennemi.advantage = 1;
    expect(buildAiInput(reluDans(get, ennemi), get).movement).toBe(0); // LDB 15 l.49
    reluDans(get, ennemi).advantage = 2;
    expect(buildAiInput(reluDans(get, ennemi), get).movement).toBeGreaterThan(0); // LDB 15 l.47
    reluDans(get, ennemi).advantage = 0;
    reluDans(get, ennemi).size = 'grande';
    expect(buildAiInput(reluDans(get, ennemi), get).movement).toBeGreaterThan(0); // LDB 85 l.373-374
  });

  it('Engagé avec un allié seul (pulsion) : cloué, et son tir refusé comme celui de tout Engagé', () => {
    const get = banc.getState;
    const { heros: [h], ennemis: [e, allie] } = combat(1, 2);
    h.pos = { x: 4, y: 10 };
    e.pos = { x: 10, y: 10 };
    allie.pos = { x: 11, y: 10 };
    e.weapons = [{ label: 'Arc', type: 'distance', damage: { plusBF: false, flat: 7 }, range: 30, qualities: [] }];
    for (const c of [e, allie]) { c.advantage = 0; c.size = 'moyenne'; }
    engage(e, allie);
    aSonTour(e);
    const input = buildAiInput(reluDans(get, e), get);
    expect(input.movement).toBe(0); // LDB 15 l.49
    expect(chooseEnemyAction(input).kind).not.toBe('tir');
  });
});

describe('Frappe Mortelle de Taille : une chaîne par Tour, nouée de touche en touche (LDB 14 l.9 ; LDB 85 l.362, #5031)', () => {
  /** Un Énorme au contact de trois héros Surpris (sans défense), CC haute. */
  function geant() {
    const { heros, ennemi } = combat(3);
    ennemi.size = 'enorme';
    ennemi.characteristics['capacite-de-combat'] = 80;
    ennemi.characteristics.force = 45;
    ennemi.pos = { x: 10, y: 10 };
    ennemi.weapons = [{ label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }];
    heros.forEach((h, i) => {
      h.pos = [{ x: 9, y: 10 }, { x: 12, y: 10 }, { x: 10, y: 9 }][i];
      h.conditions = [{ id: 'surpris', value: 1 }];
      h.wounds = blessuresDeBase(60, 60, h);
      h.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    });
    aSonTour(ennemi);
    return { heros, ennemi };
  }

  it('un maillon raté ne noue pas le suivant ; un maillon qui touche, si', () => {
    const get = banc.getState;
    get().ensemencerLeTirage(2);
    const { heros: [h1, h2, h3], ennemi } = geant();
    const chaine = { hitIds: [h1.id, h2.id], n: 1, bcc: 8, fm: false };
    resumeCleaveChain(get, banc.setState, reluDans(get, ennemi), reluDans(get, h2), chaine, false);
    draineCascade(get);
    expect(reluDans(get, h3).wounds.current).toBe(60);
    const avant = get().battle!.log.length;
    resumeCleaveChain(get, banc.setState, reluDans(get, ennemi), reluDans(get, h2), chaine, true);
    draineCascade(get);
    expect(get().battle!.log.slice(avant).some((l) => l.kind === 'attaque' && l.targetId === h3.id)).toBe(true);
  });

  it('la touche d’une autre attaque du même Tour (Piétinement) n’ouvre pas de seconde chaîne ; le Tour suivant, si', () => {
    const get = banc.getState;
    get().ensemencerLeTirage(2);
    const { heros: [h1, h2, h3], ennemi } = geant();
    for (const h of [h2, h3]) h.pos = { x: 20, y: 20 }; // aucune cible de balayage à la première touche
    doAttack(get, banc.setState, reluDans(get, ennemi), reluDans(get, h1));
    draineCascade(get);
    expect(get().battle!.balayagesDuTour).toEqual([ennemi.id]);
    reluDans(get, h2).pos = { x: 12, y: 10 };
    const touche = { hit: true, cleave: true } as AttackResult;
    expect(autoCleave(get, banc.setState, reluDans(get, ennemi), reluDans(get, h1), touche)).toBe(false);
    draineCascade(get);
    expect(reluDans(get, h2).wounds.current).toBe(60);
    aSonTour(ennemi);
    autoCleave(get, banc.setState, reluDans(get, ennemi), reluDans(get, h1), touche);
    draineCascade(get);
    expect(reluDans(get, h2).wounds.current).toBeLessThan(60);
    expect(isEngaged(reluDans(get, ennemi), get().battle!.combatants)).toBe(true);
  });

  it('la chaîne du Tour est celle de son attaquant : un second Grand balaie dans le même Tour', () => {
    const get = banc.getState;
    get().ensemencerLeTirage(2);
    const { heros: [h1, h2, h3, h4], ennemis: [g1, g2] } = combat(4, 2);
    for (const g of [g1, g2]) {
      g.size = 'enorme';
      g.characteristics['capacite-de-combat'] = 80;
      g.characteristics.force = 45;
      g.weapons = [{ label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }];
    }
    g1.pos = { x: 10, y: 10 };
    g2.pos = { x: 20, y: 10 };
    [h1, h2, h3, h4].forEach((h, i) => {
      h.pos = [{ x: 9, y: 10 }, { x: 11, y: 10 }, { x: 21, y: 10 }, { x: 19, y: 10 }][i];
      h.conditions = [{ id: 'surpris', value: 1 }];
      h.wounds = blessuresDeBase(60, 60, h);
      h.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    });
    aSonTour(g1);
    const touche = { hit: true, cleave: true } as AttackResult;
    autoCleave(get, banc.setState, reluDans(get, g1), reluDans(get, h1), touche);
    draineCascade(get);
    const avant = get().battle!.log.length;
    autoCleave(get, banc.setState, reluDans(get, g2), reluDans(get, h3), touche);
    draineCascade(get);
    expect(get().battle!.balayagesDuTour).toEqual([g1.id, g2.id]);
    expect(get().battle!.log.slice(avant).some((l) => l.kind === 'attaque' && l.actorId === g2.id && l.targetId === h4.id)).toBe(true);
  });
});
