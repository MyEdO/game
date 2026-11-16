/**
 * LA BARRE MATÉRIALISÉE À L'OUVERTURE DU TOUR (#3935, variante B) : `fireTurnStartTriggers`, le point unique que jouent
 * `advanceTurn` et l'ouverture du Round, écrit dans le combattant qui devient actif chaque entrée qu'il possède au premier
 * emplacement rapide libre. Fiche `user-arbitrage-barre-materialisee-et-sans-pages`.
 */
import { describe, it, expect } from 'vitest';
import { fireTurnStartTriggers } from './turnHooks';
import { retirerDeBarre } from '../dispositionConsole';
import type { Combatant, ItemInstance } from '../../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

const lanceur = (spells: string[]): Combatant =>
  (blessuresSurLeProfil({
    id: 'h1', name: 'h1', kind: 'heros', advantage: 0, conditions: [], talents: [], activeEffects: [], groups: [],
    wounds: blessuresDeBase(10),
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 35, agilite: 40, dexterite: 45, intelligence: 40, 'force-mentale': 45, sociabilite: 30 },
    skills: [], weapons: [], items: [], spells, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  })) as unknown as Combatant;

const objet = (uid: string, trappingId: string | undefined): ItemInstance => ({ uid, trappingId, label: uid }) as ItemInstance;

/** Ouvre le tour de `c` par la couture du jeu. */
const ouvrirSonTour = (c: Combatant): void => {
  const battle = { combatants: [c], log: [] };
  fireTurnStartTriggers((() => ({ battle })) as never, (() => {}) as never, c);
};

const rangs = (c: Combatant) => Array.from({ length: 12 }, (_, i) => (c.barre?.capacites && i in c.barre.capacites ? c.barre.capacites[i]?.cle ?? null : 'libre'));

describe('la barre matérialisée à l’ouverture du tour', () => {
  it('le cas canonique : quatre sorts, une potion portée, bue, un sort appris, rien ne glisse', () => {
    const c = lanceur(['flechette', 'alerte', 'bruits', 'choc']);
    ouvrirSonTour(c);
    expect(c.barre?.capacites, 'les quatre sorts aux rangs 0 à 3, dans l’ordre de ses sorts').toEqual({
      0: { actionId: 'incantation', cle: 'sort-flechette' },
      1: { actionId: 'incantation', cle: 'sort-alerte' },
      2: { actionId: 'incantation', cle: 'sort-bruits' },
      3: { actionId: 'incantation', cle: 'sort-choc' },
    });

    c.items = [objet('it-1', 'potion-de-guerison'), objet('it-2', 'potion-de-guerison'), objet('it-3', undefined)];
    ouvrirSonTour(c);
    expect(c.barre?.capacites?.[4], 'la potion au rang 4, une case par modèle').toEqual({ actionId: 'usage-objet', cle: 'q-objet-potion-de-guerison' });
    expect(rangs(c).slice(5), 'rien d’autre ne s’écrit').toEqual(Array(7).fill('libre'));
    const avant = rangs(c);

    c.items = [];
    ouvrirSonTour(c);
    expect(rangs(c), 'la potion bue, sa case reste à son rang, rien ne bouge').toEqual(avant);

    c.spells = [...c.spells!, 'conservation'];
    ouvrirSonTour(c);
    expect(rangs(c).slice(0, 6), 'le sort appris au premier rang libre, jamais avant une case existante').toEqual([
      'sort-flechette', 'sort-alerte', 'sort-bruits', 'sort-choc', 'q-objet-potion-de-guerison', 'sort-conservation',
    ]);
  });

  it('au-delà de six emplacements, rien ne s’écrit', () => {
    const c = lanceur(['flechette', 'alerte', 'bruits', 'choc', 'conservation', 'amitie-animale', 'arme-aethyrique']);
    ouvrirSonTour(c);
    expect(rangs(c), 'six sorts aux six emplacements, le septième nulle part').toEqual([
      'sort-flechette', 'sort-alerte', 'sort-bruits', 'sort-choc', 'sort-conservation', 'sort-amitie-animale', ...Array(6).fill('libre'),
    ]);
  });

  it('une case vidée par le joueur n’est pas re-remplie', () => {
    const c = lanceur(['flechette', 'alerte']);
    ouvrirSonTour(c);
    Object.assign(c, retirerDeBarre(c, { zone: 'capacites', index: 0 }));
    c.spells = [...c.spells!, 'bruits'];
    ouvrirSonTour(c);
    expect(rangs(c).slice(0, 2), 'le rang vidé reste vide, sa voisine à son rang').toEqual([null, 'sort-alerte']);
    expect(rangs(c), 'le sort appris va à un rang libre').toContain('sort-bruits');
  });
});
