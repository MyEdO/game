import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GearAssignList } from './GearAssignList';
import type { LootGear } from '../state/store';
import type { Combatant } from '../engine/types';
import { gearFromEffects } from '../state/combatEffects';

const hero = (id: string, name: string) =>
  ({ id, name, kind: 'hero', wounds: { current: 10, max: 12 }, conditions: [], advantage: 0, weapons: [], skills: [], talents: [], items: [], movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
     characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'force-mentale': 30, sociabilite: 30 } }) as unknown as Combatant;

const render = (gear: LootGear[]) =>
  renderToStaticMarkup(<GearAssignList gear={gear} assignable={[hero('h', 'Hans')]} onAssign={() => {}} />);

describe('GearAssignList (butin attribuable)', () => {
  it('objet CATALOGUÉ à qualités : ses qualités de def rendent des chips, sans les porter sur l’Effet', () => {
    // Bâton de combat (def : Assommante, Défensive) injecté par un simple giveTrapping — aucune qualité
    // sur l'Effet : le bug #384 les faisait disparaître de l'écran de victoire.
    const html = render([{ label: 'Bâton de combat', magic: false, effect: { type: 'giveTrapping', trappingId: 'baton-de-combat' } }]);
    expect(html).toContain('entity-chip');
    expect(html).toContain('Assommante'); // libellé résolu via le registre depuis la def
    expect(html).toContain('Défensive');
    expect(html).not.toContain('>assommante<'); // l'id brut n'est jamais affiché
  });

  it('objet catalogué SANS qualité : aucun chip', () => {
    const html = render([{ label: 'Corde', magic: false, effect: { type: 'giveTrapping', trappingId: 'corde' } }]);
    expect(html).not.toContain('entity-chip');
  });

  it('qualité MAGIQUE portée par l’Effet : rendue en chip, id brut jamais affiché', () => {
    const html = render([{ label: 'Amulette', magic: true, effect: { type: 'giveTrapping', trappingId: 'amulette', qualities: [{ id: 'empaleuse' }], identified: true } }]);
    expect(html).toContain('entity-chip');
    expect(html).toContain('Empaleuse'); // libellé résolu via le registre, pas l'id « empaleuse »
    expect(html).not.toContain('>empaleuse<');
  });

  it('objet catalogué + qualité magique NON identifié : qualités masquées jusqu’à Évaluation', () => {
    const html = render([{ label: 'Hallebarde', magic: true, effect: { type: 'giveTrapping', trappingId: 'hallebarde', qualities: [{ id: 'empaleuse' }], identified: false } }]);
    expect(html).toContain('non identifié');
    expect(html).not.toContain('entity-chip'); // ni def ni magiques tant que non révélé
  });

  it('don de pièces de créature (#1988 B4a-i) : la ligne du butin (`gearFromEffects`) se rend, sans lever', () => {
    const { gear } = gearFromEffects([{ type: 'giveTrapping', trappingId: 'pieces-de-creature', creatureId: 'griffon', count: 3 }]);
    const html = render(gear);
    expect(html).toContain('3× Pièces de créature brutes (Griffon)');
    expect(html).not.toContain('entity-chip');
  });
});
