import { describe, it, expect } from 'vitest';
import { crewPosteOf } from './shipPostes';
import { chooseEnemyAction, type EnemyTurnInput } from './ai';
import { itemFromTrappingById } from '../engine/items';
import { emptyScene } from './scene';
import type { Combatant, ShipPoste } from '../engine/types';

/**
 * #196 — un servant PNJ (`ai: true`) membre du crew d'un poste d'engin de siège ACTIF (bélier, batterie de
 * siège) doit TENIR SA FORMATION : c'est le mouvement du POSTE (poussée du chef) qui le déplace, jamais une
 * charge individuelle. `crewPosteOf` (shipPostes.ts, source unique — pas de flag miroir sur le `Combatant`)
 * alimente `EnemyTurnInput.holdsFormation`, qui plafonne le Mouvement effectif à 0 dans `chooseEnemyAction` :
 * plus aucune approche/charge n'est ÉNUMÉRÉE, mais un ennemi déjà ADJACENT reste attaquable (mêlée sans
 * Mouvement). Contrôle négatif : un PNJ IA non-crew charge normalement (comportement inchangé).
 */

const CHARS = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const mkServant = (id: string, pos: { x: number; y: number }): Combatant =>
  ({
    id, label: id, kind: 'enemy', side: 'ally', ai: true, characteristics: CHARS,
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [{ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos,
  }) as unknown as Combatant;

const mkHull = (poste: ShipPoste, pos = { x: 5, y: 10 }): Combatant =>
  ({
    id: 'hull', label: 'Bélier', kind: 'enemy', side: 'ally', pos, conditions: [], weapons: [],
    inert: true, wounds: { current: 0, max: 0 }, advantage: 0, postes: [poste],
  }) as unknown as Combatant;

const mkPoste = (crewIds: string[] = []): ShipPoste =>
  ({ item: itemFromTrappingById('belier-ade2')!, crewIds });

const mkEnemyHero = (id: string, x: number, y: number): Combatant =>
  ({
    id, label: id, kind: 'hero', pos: { x, y }, conditions: [], weapons: [], skills: [], talents: [],
    characteristics: { ...CHARS, endurance: 30 }, wounds: { current: 12, max: 12 }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  }) as unknown as Combatant;

const input = (enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput => ({
  enemy, heroes, scene: emptyScene(20, 20),
  blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)),
  movement: enemy.movement as number, spells: [], ...extra,
});

describe('#196 — crewPosteOf (source unique, pas de flag miroir)', () => {
  it('retourne le poste+hull pour un id présent dans crewIds d’un poste dont la coque est active', () => {
    const poste = mkPoste(['chef', 'servant-1']);
    const hull = mkHull(poste);
    expect(crewPosteOf('servant-1', [hull])?.poste).toBe(poste);
    expect(crewPosteOf('servant-1', [hull])?.hull.id).toBe('hull');
  });

  it('undefined si l’id ne fait le crew d’AUCUN poste', () => {
    const poste = mkPoste(['chef']);
    const hull = mkHull(poste);
    expect(crewPosteOf('etranger', [hull])).toBeUndefined();
  });

  it('undefined si la coque du poste est hors d’action (poste INACTIF)', () => {
    const poste = mkPoste(['servant-1']);
    const hull = mkHull(poste);
    (hull as unknown as { dead: boolean }).dead = true;
    expect(crewPosteOf('servant-1', [hull])).toBeUndefined();
  });
});

describe('#196 — tenue de formation IA', () => {
  it('un servant du crew, ennemi HORS de portée, ne charge PAS (aucun move) — reste en formation', () => {
    const poste = mkPoste(['chef', 'servant-1']);
    const hull = mkHull(poste);
    const servant = mkServant('servant-1', { x: 5, y: 11 });
    const ennemiLointain = mkEnemyHero('cible', 5, 2); // loin, hors de portée de mêlée
    const action = chooseEnemyAction(input(servant, [ennemiLointain], { holdsFormation: !!crewPosteOf('servant-1', [hull, servant]) }));
    expect(action.kind).toBe('end'); // ne s'approche ni ne charge : tient sa case
  });

  it('CONTRÔLE NÉGATIF : un PNJ IA non-crew, dans la MÊME situation, charge normalement (move vers la cible)', () => {
    const servant = mkServant('libre', { x: 5, y: 11 });
    const ennemiLointain = mkEnemyHero('cible', 5, 2);
    const action = chooseEnemyAction(input(servant, [ennemiLointain])); // holdsFormation absent
    expect(action.kind).toBe('move'); // comportement inchangé : approche/charge
  });

  it('cas ENGAGÉ : le servant du crew, avec un ennemi déjà ADJACENT, attaque DEPUIS sa case (pas de move)', () => {
    const poste = mkPoste(['chef', 'servant-1']);
    const hull = mkHull(poste);
    const servant = mkServant('servant-1', { x: 5, y: 11 });
    const ennemiAdjacent = mkEnemyHero('cible', 5, 10); // adjacent (Chebyshev 1)
    const action = chooseEnemyAction(input(servant, [ennemiAdjacent], { holdsFormation: !!crewPosteOf('servant-1', [hull, servant]) }));
    expect(action.kind).toBe('melee');
    expect(action).toMatchObject({ targetId: 'cible' });
  });

  it('poste devenu INACTIF (coque hors d’action) : `holdsFormation` calculé à false → comportement IA normal', () => {
    const poste = mkPoste(['chef', 'servant-1']);
    const hull = mkHull(poste);
    (hull as unknown as { dead: boolean }).dead = true;
    const servant = mkServant('servant-1', { x: 5, y: 11 });
    const ennemiLointain = mkEnemyHero('cible', 5, 2);
    const holdsFormation = !!crewPosteOf('servant-1', [hull, servant]);
    expect(holdsFormation).toBe(false);
    const action = chooseEnemyAction(input(servant, [ennemiLointain], { holdsFormation }));
    expect(action.kind).toBe('move'); // n'est plus tenu à la formation → charge de nouveau
  });
});
