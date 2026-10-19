/**
 * LOT 4 — CONTEXTE D'ESCOUADE & COORDINATION (déterministe, sans dé). Trois comportements émergents :
 *  (a) FEU CONCENTRÉ — l'IA converge sur la cible que ses alliés ENCADRENT (surnombre RAW : meilleure
 *      proba de toucher → plus de dégâts attendus). Parité du décompte avec `combatFlow.ts:425` vérifiée.
 *  (b) ÉVITEMENT du DANGER — entre deux cases d'approche équidistantes, l'IA choisit la MOINS exposée à
 *      la menace des héros (danger-map).
 *  (c) `squad` OPTIONNEL — sans escouade, l'action est STRICTEMENT identique au Lot 3.
 * Pur : `chooseEnemyAction` est déterministe ; on donne des Caractéristiques RÉELLES pour que les
 * espérances de dégâts (`expectedDamage`) soient chiffrables (≠ tests à `{} as never`).
 */
import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type EnemyAction, type EnemyTurnInput } from './ai';
import { outnumberMod } from '../engine/combat';
import { emptyScene } from './scene';
import type { Combatant, Weapon } from '../engine/types';
import { ligneDeRegle } from '../engine/reglesChiffrees';

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const RANGED: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [] };
// Arme à COURTE portée (6 m) : les bandes de portée varient sur quelques cases → différentiel de
// danger exploitable entre deux cases d'approche voisines (≠ Arc range 60 où tout est « Bout portant »).
const SHORTBOW: Weapon = { label: 'Fronde', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 6, qualities: [] };

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 };
const ARMOUR = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id, kind, pos,
    wounds: { current: 12, max: 12 }, weapons: [MELEE],
    characteristics: { ...CHARS }, advantage: 0, conditions: [], armour: { ...ARMOUR },
    skills: [], talents: [], movement: 4,
    ...opts,
  } as Combatant;
}

const scene = emptyScene(20, 20);

function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [], ...extra };
}

const tidOf = (a: EnemyAction): string | undefined =>
  (a as { targetId?: string }).targetId ?? (a as { thenTargetId?: string }).thenTargetId;

describe('Lot 4 — FEU CONCENTRÉ (surnombre RAW)', () => {
  it('deux cibles équivalentes au contact : l’IA vise CELLE qu’un allié encadre déjà (surnombre +20)', () => {
    // Enemy au centre, deux héros identiques tous deux au contact (mêlée). Un allié de l'enemy est adjacent
    // au héros « encadré » → surnombre 2c1 (+20 au toucher) sur lui → meilleure espérance de dégâts.
    const e = mk('e', 'enemy', { x: 10, y: 10 }, { weapons: [MELEE] });
    const flanked = mk('flanked', 'hero', { x: 11, y: 10 }); // contact à l'est
    const alone = mk('alone', 'hero', { x: 9, y: 10 }); // contact à l'ouest, sans allié près
    const ally = mk('ally', 'enemy', { x: 12, y: 10 }); // adjacent à `flanked` (combatDistance 1)
    const a = chooseEnemyAction(input(e, [flanked, alone], { squad: [ally] }));
    expect(a.kind).toBe('melee');
    expect(tidOf(a)).toBe('flanked'); // le surnombre fait pencher le feu concentré sur la cible encadrée
  });

  it('sans escouade, les deux cibles équivalentes restent départagées comme au Lot 3 (PAS « flanked »)', () => {
    // Contrôle : SANS `squad`, aucun surnombre → les cibles sont équivalentes ; le tie-break déterministe
    // (id de cible ↑) choisit « alone » (a < f). Le test (a) ci-dessus DÉVIE bien ce choix grâce à l'escouade.
    const e = mk('e', 'enemy', { x: 10, y: 10 }, { weapons: [MELEE] });
    const flanked = mk('flanked', 'hero', { x: 11, y: 10 });
    const alone = mk('alone', 'hero', { x: 9, y: 10 });
    const a = chooseEnemyAction(input(e, [flanked, alone]));
    expect(a.kind).toBe('melee');
    expect(tidOf(a)).toBe('alone'); // tie-break par id (≠ « flanked ») → l'escouade est bien la cause de (a)
  });

  it('parité du DÉCOMPTE avec combatFlow.ts:425 : 1 allié adjacent + l’attaquant = 2c1 → +20 (et 2 alliés → +40)', () => {
    // L'IA réutilise `outnumberMod(adj + 1)` où `adj` = alliés à combatDistance ≤ 1 (MÊME filtre que la
    // résolution combatFlow.ts:425, qui inclut l'attaquant). On vérifie ici la fonction partagée.
    expect(outnumberMod(1 + 1)).toEqual(ligneDeRegle('superiorite-numerique', 'deux-contre-un')); // 1 allié + attaquant
    expect(outnumberMod(2 + 1)).toEqual(ligneDeRegle('superiorite-numerique', 'trois-contre-un')); // 2 alliés + attaquant
    expect(outnumberMod(0 + 1)).toBeNull(); // attaquant seul → pas de surnombre
  });
});

describe('Lot 4 — ÉVITEMENT du DANGER (danger-map)', () => {
  it('entre deux cases d’approche équidistantes, l’IA choisit la MOINS exposée à un archer héros', () => {
    // L'enemy (mêlée, M=5) ne peut atteindre QUE `prey` ce tour (l'archer est hors de portée d'approche →
    // pas une cible de mêlée jouable). Il l'aborde par l'une de deux cases de contact équidistantes : la case
    // EST (11,15) est plus proche de l'archer (bande de portée plus dangereuse) que la case OUEST (9,15) →
    // la danger-map fait préférer l'ouest. `prey` désarmé : seule la menace de l'archer pèse sur les cases.
    const e = mk('e', 'enemy', { x: 10, y: 10 }, { weapons: [MELEE], movement: 5 });
    const prey = mk('prey', 'hero', { x: 10, y: 15 }, { weapons: [] });
    // Archer à courte portée placé au SUD-EST, HORS de portée d'approche de l'enemy (chebyshev 6 > M+1=6
    // d'adjacence) → il ne peut pas être visé en mêlée ; il ne fait que MENACER certaines cases d'arrivée.
    const archer = mk('archer', 'hero', { x: 13, y: 16 }, { weapons: [SHORTBOW] });
    const a = chooseEnemyAction(input(e, [prey, archer], { squad: [] }));
    expect(a.kind).toBe('move');
    if (a.kind === 'move') {
      expect(tidOf(a)).toBe('prey'); // la proie est la seule cible de mêlée atteignable ce tour
      // …abordée par la case ÉLOIGNÉE de l'archer (ouest), pas par la case proche (est) plus exposée.
      expect(a.to.x).toBeLessThan(prey.pos!.x);
    }
  });
});

describe('Lot 4 — squad OPTIONNEL : parité Lot 3', () => {
  it('sans `squad`, l’action est identique à un appel équivalent SANS le champ (comportement Lot 3)', () => {
    const mkInput = (extra: Partial<EnemyTurnInput>): EnemyTurnInput => {
      const e = mk('e', 'enemy', { x: 10, y: 10 }, { weapons: [RANGED], movement: 4 });
      const dangerous = mk('dangerous', 'hero', { x: 10, y: 13 }, {
        weapons: [{ label: 'Hache lourde', type: 'melee', damage: { plusBF: true, flat: 10 }, qualities: [] }],
      });
      const soft = mk('soft', 'hero', { x: 10, y: 16 }, { wounds: { current: 8, max: 12 } });
      return input(e, [dangerous, soft], extra);
    };
    const withoutField = chooseEnemyAction(mkInput({}));
    const withUndefined = chooseEnemyAction(mkInput({ squad: undefined }));
    const withEmpty = chooseEnemyAction(mkInput({ squad: [] }));
    expect(withUndefined).toEqual(withoutField);
    expect(withEmpty).toEqual(withoutField); // escouade vide ≡ pas d'escouade (surnombre/cohésion neutres)
  });
});
