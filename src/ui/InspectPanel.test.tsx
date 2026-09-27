import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InspectPanel } from './InspectPanel';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { creatureToCombatant } from '../state/spawn';
import { findCreatureById } from '../data';

/** L'inspection rend le statbloc COMPLET via le composant partagé du Codex (CodexSections) +
 *  une tête vivante (nom, PB, psychologie, États). On vérifie la présence des données clés. */
describe('InspectPanel', () => {
  const render = (c: Parameters<typeof InspectPanel>[0]['combatant']) =>
    renderToStaticMarkup(<InspectPanel combatant={c} onClose={() => {}} />);

  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', rng: makeRNG(3) });

  it('nom, PB (WoundsBadge courant/max) et statbloc (caractéristiques partagées)', () => {
    const html = render(hero);
    expect(html).toContain('Gunnar');
    expect(html).toContain('wounds-badge'); // PB via la primitive unifiée
    expect(html).toContain(`${hero.wounds.current}/${hero.wounds.max}`);
    expect(html).toContain('Caractéristiques'); // titre de section partagé avec le Codex
    expect(html).toContain('CC'); // une caractéristique dans la grille
    expect(html).toContain('Taille');
  });

  it('ennemi du bestiaire : « – » pour une carac inexistante, traits cliquables (CodexRef)', () => {
    const wolf = creatureToCombatant(findCreatureById('loup')!, 'e1', { x: 0, y: 0 });
    const html = render(wolf);
    expect(html).toContain('–'); // carac « – » (Schéma des Profils, LDB 76)
    expect(html).toContain('Vision nocturne'); // trait
    expect(html).toContain('codex-ref'); // trait enrobé en CodexRef (lien vers la fiche)
    expect(html).toContain('Traits'); // section partagée
    expect(html).toContain('Armes'); // arme dérivée du trait (Morsure)
  });

  it('badge Lanceur de sorts + section Sorts si l’ennemi connaît des sorts', () => {
    const caster = creatureToCombatant(findCreatureById('mutant')!, 'e1', { x: 0, y: 0 }, { spells: ['flechette'] });
    const html = render(caster);
    expect(html).toContain('Lanceur de sorts');
    expect(html).toContain('Sorts');
  });

  it('COQUE ennemie (#240) : inspecte l’objet visible (Coque + Proue-idole #221), PAS le statbloc-personnage', () => {
    const serpent = {
      id: 'serpent', label: 'Le Serpent de Sel', kind: 'npc', bodyShape: 'vehicule',
      creatureId: 'loup-imperial', conditions: [], wounds: { current: 60, max: 80 },
      upgrades: [{ id: 'proue-idole-de-stromfels' }],
    } as unknown as Parameters<typeof InspectPanel>[0]['combatant'];
    const html = render(serpent);
    expect(html).toContain('Le Serpent de Sel');
    expect(html).toContain('Coque');
    expect(html).toContain('60/80');
    expect(html).toContain('Proue-idole de Stromfels');
    expect(html).not.toContain('Caractéristiques'); // pas de grille de caracs pour une coque
  });
});
