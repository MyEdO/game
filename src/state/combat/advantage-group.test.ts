import { describe, it, expect, afterEach } from 'vitest';
import { campGain, campSpend, spendableAdvantage, reversalStealOne, reconcileAdvantageToPool, creditOpposingAdvantage, roundEndAdvantageTransfer, startAdvantagePools } from '../../noyau/combat/advantagePool';
import { fireTurnStartTriggers } from '../../noyau/combat/turnHooks';
import { setRule, resetRule } from '../../engine/policy';
import { baseTestMods } from '../../engine/combat';
import type { Combatant } from '../../engine/types';
import type { AdvantagePools } from '../../engine/advantagePool';
import { creatures } from '../../data';
import { traitsDuPorteur } from '../../engine/statEntry';
import { porteurDuProfil } from '../../noyau/monde/spawn';

const mk = (id: string, kind: Combatant['kind'], over: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, kind, advantage: 0, conditions: [], talents: [], activeEffects: [], groups: [],
    wounds: { current: 10, max: 10, base: 10 },
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 35, agilite: 40, dexterite: 45, intelligence: 40, 'force-mentale': 45, sociabilite: 30 },
    skills: [], weapons: [], items: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  }) as unknown as Combatant;

interface FakeBattle { combatants: Combatant[]; advantagePools?: AdvantagePools; log: unknown[] }
const makeGet = (combatants: Combatant[], advantagePools?: AdvantagePools) => {
  const battle: FakeBattle = { combatants, advantagePools, log: [] };
  return { get: (() => ({ battle })) as never, set: (() => {}) as never, battle };
};

afterEach(() => resetRule('combat-aa-avantage-groupe'));

describe('campGain — mode Livre de base (défaut) : per-combattant, INCHANGÉ', () => {
  it('ne crédite QUE le combattant ciblé ; aucune réserve créée', () => {
    const a = mk('h1', 'hero');
    const b = mk('h2', 'hero');
    const { get, battle } = makeGet([a, b]);
    campGain(get, a, 2);
    expect(a.advantage).toBe(2);
    expect(b.advantage).toBe(0);
    expect(battle.advantagePools).toBeUndefined();
  });
});

describe('campGain — mode « Avantage de groupe » : réserve du camp (AA 11 l.11-13)', () => {
  it('un gain d’un héros va dans la réserve des alliés et se projette sur tout le camp', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h1', 'hero');
    const b = mk('h2', 'hero');
    const e = mk('e1', 'enemy');
    const { get, battle } = makeGet([a, b, e]);
    campGain(get, a, 1);
    campGain(get, b, 2); // même camp → même réserve cumulée
    expect(battle.advantagePools).toEqual({ allies: 3, foes: 0 });
    expect(a.advantage).toBe(3); // projection
    expect(b.advantage).toBe(3);
    expect(e.advantage).toBe(0); // camp adverse intact
  });

  it('les LECTEURS d’Avantage lisent la réserve du camp de l’acteur (baseTestMods)', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h1', 'hero');
    const e = mk('e1', 'enemy');
    const { get } = makeGet([a, e]);
    campGain(get, a, 2);
    expect(baseTestMods(a)).toBe(20); // 2 Avantages de camp × 10
    expect(baseTestMods(e)).toBe(0);
  });

  it('génération d’un PNJ hostile → réserve des adversaires (Redoutable via reconcile)', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h1', 'hero');
    const e = mk('e1', 'enemy');
    const { get, battle } = makeGet([a, e], { allies: 0, foes: 0 });
    // l’op `topUpAdvantage` (Redoutable) a complété l’Avantage de l’ennemi jusqu’à l’Indice sur la projection…
    e.advantage = 3;
    reconcileAdvantageToPool(get, e); // …on relève la réserve adverse en conséquence
    expect(battle.advantagePools).toEqual({ allies: 0, foes: 3 });
    expect(e.advantage).toBe(3);
  });
});

describe('campSpend — dépense d’Avantage (symétrique de campGain)', () => {
  it('mode Livre de base : débite l’Avantage du SEUL combattant (aucune réserve)', () => {
    const a = mk('h1', 'hero', { advantage: 3 });
    const { get, battle } = makeGet([a]);
    campSpend(get, a, 2);
    expect(a.advantage).toBe(1);
    expect(battle.advantagePools).toBeUndefined();
  });

  it('mode groupe : débite la RÉSERVE du camp et re-projette (jamais sous 0)', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h1', 'hero');
    const b = mk('h2', 'hero');
    const e = mk('e1', 'enemy');
    const { get, battle } = makeGet([a, b, e], { allies: 3, foes: 1 });
    campSpend(get, a, 2); // dépense côté alliés → mirror projette la réserve sur tout le monde
    expect(battle.advantagePools).toEqual({ allies: 1, foes: 1 });
    expect(a.advantage).toBe(1); // projection alliés
    expect(b.advantage).toBe(1);
    expect(e.advantage).toBe(1); // camp adverse intact
    campSpend(get, a, 5); // sur-dépense → planché à 0
    expect(battle.advantagePools).toEqual({ allies: 0, foes: 1 });
  });

  it('spendableAdvantage : réserve du camp (groupe) vs Avantage individuel (LDB)', () => {
    const a = mk('h1', 'hero', { advantage: 4 });
    const e = mk('e1', 'enemy');
    const noPools = makeGet([a, e]);
    expect(spendableAdvantage(noPools.battle, a)).toBe(4); // LDB : individuel
    setRule('combat-aa-avantage-groupe', true);
    const { battle } = makeGet([a, e], { allies: 2, foes: 5 });
    expect(spendableAdvantage(battle, a)).toBe(2); // réserve alliés
    expect(spendableAdvantage(battle, e)).toBe(5); // réserve adverses
  });
});

describe('Distraire (LDB 10 l.364) — le distrait ne génère plus d’Avantage', () => {
  it('campGain refuse tout gain tant que distractedRounds > 0', () => {
    const a = mk('h1', 'hero', { distractedRounds: 2 });
    const { get } = makeGet([a]);
    campGain(get, a, 3);
    expect(a.advantage).toBe(0); // aucun gain (LDB : ni pour lui, ni pour sa réserve)
  });

  it('mode groupe : un distrait ne crédite pas la réserve de son camp', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h1', 'hero', { distractedRounds: 1 });
    const b = mk('h2', 'hero');
    const { get, battle } = makeGet([a, b], { allies: 0, foes: 0 });
    campGain(get, a, 2); // a est distrait → rien
    expect(battle.advantagePools).toEqual({ allies: 0, foes: 0 });
    campGain(get, b, 2); // b n’est pas distrait → crédite
    expect(battle.advantagePools).toEqual({ allies: 2, foes: 0 });
  });
});

describe('reconcileAdvantageToPool — bidirectionnel (octroi/dépense par op)', () => {
  it('une projection abaissée hors `campSpend` ABAISSE la réserve du camp', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h1', 'hero');
    const b = mk('h2', 'hero');
    const { get, battle } = makeGet([a, b], { allies: 0, foes: 0 });
    campGain(get, a, 4); // réserve alliés = 4, projetée sur a ET b
    expect(a.advantage).toBe(4);
    expect(b.advantage).toBe(4);
    a.advantage = 1; // 3 dépensés DIRECTEMENT sur la projection d’un allié
    reconcileAdvantageToPool(get, a);
    expect(battle.advantagePools).toEqual({ allies: 1, foes: 0 }); // réserve abaissée
    expect(b.advantage).toBe(1); // re-projeté sur tout le camp
  });
});

describe('Renversement (variante AA 13 l.92-98) — vole 1 dans la réserve adverse', () => {
  it('déplace 1 Avantage de la réserve adverse vers la sienne, projeté', () => {
    setRule('combat-aa-avantage-groupe', true);
    const thief = mk('h1', 'hero');
    const victim = mk('e1', 'enemy');
    const { get, battle } = makeGet([thief, victim], { allies: 1, foes: 2 });
    const stole = reversalStealOne(get, thief, victim);
    expect(stole).toBe(true);
    expect(battle.advantagePools).toEqual({ allies: 2, foes: 1 });
    expect(thief.advantage).toBe(2);
    expect(victim.advantage).toBe(1);
  });

  it('réserve adverse vide → simple +1 (pas de vol)', () => {
    setRule('combat-aa-avantage-groupe', true);
    const thief = mk('h1', 'hero');
    const victim = mk('e1', 'enemy');
    const { get, battle } = makeGet([thief, victim], { allies: 0, foes: 0 });
    const stole = reversalStealOne(get, thief, victim);
    expect(stole).toBe(false);
    expect(battle.advantagePools).toEqual({ allies: 1, foes: 0 });
  });
});

describe('roundEndAdvantageTransfer — domination de fin de Round (AA 11 l.44)', () => {
  it('le camp majoritaire prend 1 Avantage à l’autre + reprojette', () => {
    setRule('combat-aa-avantage-groupe', true);
    const combatants = [mk('h1', 'hero'), mk('h2', 'hero'), mk('e1', 'enemy')];
    const { get, battle } = makeGet(combatants, { allies: 1, foes: 2 });
    void get;
    roundEndAdvantageTransfer(battle);
    expect(battle.advantagePools).toEqual({ allies: 2, foes: 1 }); // alliés majoritaires (2 c.1)
    expect(combatants[0].advantage).toBe(2); // projection alliés
    expect(combatants[2].advantage).toBe(1); // projection adverses
  });
});

describe('creditOpposingAdvantage — fournisseur ctx.onOpposingAdvantage (Redoutable AA, MDG 16 l.13)', () => {
  it('mode groupe : crédite la réserve ADVERSE de `n` et re-projette', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h1', 'hero');
    const e = mk('e1', 'enemy', { advantage: 3 }); // l'op appelante venait d'écrire cette projection AVANT de créditer l'adverse
    const { get, battle } = makeGet([a, e], { allies: 0, foes: 3 });
    creditOpposingAdvantage(get, e, 3);
    expect(battle.advantagePools).toEqual({ allies: 3, foes: 3 }); // + Indice (3) côté alliés (camp OPPOSÉ de la créature)
    expect(a.advantage).toBe(3);
  });

  it('hors mode groupe : no-op (pas de réserve — la clause n’existe QUE sous les règles AA)', () => {
    const a = mk('h1', 'hero');
    const e = mk('e1', 'enemy');
    const { get, battle } = makeGet([a, e]);
    creditOpposingAdvantage(get, e, 3);
    expect(battle.advantagePools).toBeUndefined();
    void a;
  });

  it('n ≤ 0 : no-op', () => {
    setRule('combat-aa-avantage-groupe', true);
    const e = mk('e1', 'enemy');
    const { get, battle } = makeGet([e], { allies: 0, foes: 0 });
    creditOpposingAdvantage(get, e, 0);
    expect(battle.advantagePools).toEqual({ allies: 0, foes: 0 });
  });
});

describe('Redoutable — clause AA bout-en-bout (op topUpAdvantage{feedOpposingPool} → ctx.onOpposingAdvantage, via fireTurnStartTriggers)', () => {
  it('début de tour : regain propre jusqu’à l’Indice + génération PLEINE pour la réserve adverse', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h1', 'hero');
    const e = mk('e1', 'enemy', { traits: [{ id: 'redoutable', value: 3 }], advantage: 0 });
    const { get, set, battle } = makeGet([a, e], { allies: 0, foes: 0 });
    fireTurnStartTriggers(get, set, e);
    expect(e.advantage).toBe(3); // regain propre (op topUpAdvantage) jusqu'à l'Indice
    expect(battle.advantagePools).toEqual({ allies: 3, foes: 3 }); // + Indice plein côté alliés (camp OPPOSÉ)
    expect(a.advantage).toBe(3); // projection
  });

  it('garde-fou Empêtré/Inconscient/Surpris (MDG 16 l.11) : op gatée par la donnée → RIEN ne part au camp adverse, MÊME avec Avantage déjà plein (le cas que le proxy `c.advantage >= indice` ratait)', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h1', 'hero');
    // Avantage déjà À l'Indice (le proxy `c.advantage >= indice` aurait crédité la réserve adverse ici).
    const e = mk('e1', 'enemy', { traits: [{ id: 'redoutable', value: 3 }], advantage: 3, conditions: [{ id: 'surpris', value: 1 }] });
    const { get, set, battle } = makeGet([a, e], { allies: 0, foes: 3 });
    fireTurnStartTriggers(get, set, e);
    expect(e.advantage).toBe(3); // inchangé (Surpris bloque le regain, déjà à l'Indice de toute façon)
    expect(battle.advantagePools).toEqual({ allies: 0, foes: 3 }); // RIEN n'est parti côté alliés — la garde gate NATURELLEMENT la clause
  });

  it('hors mode groupe : aucune réserve créée (non-régression)', () => {
    const a = mk('h1', 'hero');
    const e = mk('e1', 'enemy', { traits: [{ id: 'redoutable', value: 3 }], advantage: 0 });
    const { get, set, battle } = makeGet([a, e]);
    fireTurnStartTriggers(get, set, e);
    expect(e.advantage).toBe(3); // regain propre per-combattant (LDB), toujours câblé
    expect(battle.advantagePools).toBeUndefined();
  });

  it('créature sans Trait Redoutable : no-op', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h1', 'hero');
    const e = mk('e1', 'enemy', { advantage: 3 });
    const { get, set, battle } = makeGet([a, e], { allies: 0, foes: 3 });
    fireTurnStartTriggers(get, set, e);
    expect(battle.advantagePools).toEqual({ allies: 0, foes: 3 });
  });
});

// La clause d'Avantage de groupe est conditionnée au MODULE DE RÈGLES (MDG 16 l.13 : « Si vous utilisez
// les règles d'Avantage de groupe du supplément Aux Armes ! »), jamais au livre d'origine du PORTEUR :
// l'entrée `redoutable` est UNIQUE et ses porteurs la subissent à l'identique quelle que soit leur
// provenance, sous le seul gate `groupAdvantage()`.
describe('Redoutable — la clause AA suit le MODULE de règles, pas le livre du porteur', () => {
  const porteurs = creatures.filter((c) => (c.traits ?? []).some((t) => t.id === 'redoutable'));
  const carriersByBook = (book: string) => porteurs.filter((c) => c.source?.book === book);
  /** Provenances RÉELLES des porteurs, DÉRIVÉES de la donnée : ce banc porte sur la PLURALITÉ des
   *  livres d'origine, jamais sur une liste de livres recopiée (#1825). */
  const LIVRES_PORTEURS = [...new Set(porteurs.map((c) => c.source?.book).filter((b): b is string => !!b))];

  it('les porteurs de PLUSIEURS livres pointent tous l’entrée UNIQUE `redoutable` (aucun `redoutable-mdg`)', () => {
    expect(creatures.some((c) => (c.traits ?? []).some((t) => t.id === 'redoutable-mdg'))).toBe(false);
    // La PLURALITÉ des provenances est ce qui donne son sens au banc : sans elle, les volets
    // paramétrés ci-dessous n'éprouveraient qu'un seul livre et la clause pourrait le suivre.
    expect(LIVRES_PORTEURS.length).toBeGreaterThan(1);
  });

  it.each(LIVRES_PORTEURS)(
    'un porteur %s nourrit la réserve ADVERSE quand le module AA est actif',
    (book) => {
      setRule('combat-aa-avantage-groupe', true);
      const carrier = carriersByBook(book)[0];
      const indice = traitsDuPorteur(carrier.traits ?? [], porteurDuProfil(carrier.id, carrier.char)).find((t) => t.id === 'redoutable')!.value ?? 1;
      const a = mk('h1', 'hero');
      const e = mk(carrier.id, 'enemy', { traits: [{ id: 'redoutable', value: indice }], advantage: 0 });
      const { get, set, battle } = makeGet([a, e], { allies: 0, foes: 0 });
      fireTurnStartTriggers(get, set, e);
      expect(e.advantage).toBe(indice); // regain propre jusqu'à l'Indice
      expect(battle.advantagePools).toEqual({ allies: indice, foes: indice }); // Indice PLEIN au camp opposé
    },
  );

  it.each(LIVRES_PORTEURS)(
    'un porteur %s ne nourrit RIEN quand le module AA est inactif (mode Livre de base)',
    (book) => {
      const carrier = carriersByBook(book)[0];
      const indice = traitsDuPorteur(carrier.traits ?? [], porteurDuProfil(carrier.id, carrier.char)).find((t) => t.id === 'redoutable')!.value ?? 1;
      const a = mk('h1', 'hero');
      const e = mk(carrier.id, 'enemy', { traits: [{ id: 'redoutable', value: indice }], advantage: 0 });
      const { get, set, battle } = makeGet([a, e]);
      fireTurnStartTriggers(get, set, e);
      expect(e.advantage).toBe(indice); // regain propre per-combattant (LDB), toujours câblé
      expect(battle.advantagePools).toBeUndefined(); // aucune réserve : la clause AA n'existe pas hors module
      expect(a.advantage).toBe(0);
    },
  );
});

describe('startAdvantagePools — positionnement initial auto-dérivé', () => {
  it('Surnombre calculé sur les combattants actifs (AA 11 l.60-62)', () => {
    const all = [mk('h1', 'hero'), mk('h2', 'hero'), mk('h3', 'hero'), mk('e1', 'enemy')];
    expect(startAdvantagePools(all, false)).toEqual({ allies: 3, foes: 0 }); // ×3 → +3 aux alliés
  });

  it('Surprise (embuscade) → +2 aux adversaires', () => {
    const all = [mk('h1', 'hero'), mk('e1', 'enemy')];
    expect(startAdvantagePools(all, true)).toEqual({ allies: 0, foes: 2 });
  });
});

describe('startAdvantagePools — marqueurs de rencontre (Menace/Manœuvrabilité/Terrain, AA 11 l.53-65)', () => {
  it('Manœuvrabilité (+2, l.4158) crédite le camp marqué', () => {
    const all = [mk('h1', 'hero'), mk('e1', 'enemy')];
    expect(startAdvantagePools(all, false, { maneuverability: 'party' })).toEqual({ allies: 2, foes: 0 });
  });

  it('Menace « très dangereuse » (+3, l.4160) crédite le camp qui EST la menace', () => {
    const all = [mk('h1', 'hero'), mk('e1', 'enemy')];
    expect(startAdvantagePools(all, false, { threat: { camp: 'enemies', tier: 'tresDangereuse' } })).toEqual({ allies: 0, foes: 3 });
  });

  it('Menace « extrême » (+5, l.4161) côté alliés (ex. Trait de créature allié)', () => {
    const all = [mk('h1', 'hero'), mk('e1', 'enemy')];
    expect(startAdvantagePools(all, false, { threat: { camp: 'party', tier: 'extreme' } })).toEqual({ allies: 5, foes: 0 });
  });

  it('Terrain léger (+1, l.4166, heavy absent)', () => {
    const all = [mk('h1', 'hero'), mk('e1', 'enemy')];
    expect(startAdvantagePools(all, false, { terrain: { camp: 'enemies' } })).toEqual({ allies: 0, foes: 1 });
  });

  it('Terrain lourd (+2, l.4167)', () => {
    const all = [mk('h1', 'hero'), mk('e1', 'enemy')];
    expect(startAdvantagePools(all, false, { terrain: { camp: 'party', heavy: true } })).toEqual({ allies: 2, foes: 0 });
  });

  it('se cumule avec le Surnombre auto-dérivé (circonstances distinctes, AA 11 l.51)', () => {
    const all = [mk('h1', 'hero'), mk('h2', 'hero'), mk('h3', 'hero'), mk('e1', 'enemy')]; // Surnombre ×3 → +3 alliés
    expect(startAdvantagePools(all, false, { threat: { camp: 'enemies', tier: 'dangereuse' } })).toEqual({ allies: 3, foes: 1 });
  });
});
