// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGame } from '../state/store';
import { traits } from '../data';
import { InspectPanel } from './InspectPanel';
import { createHero } from '../engine/character';
import { creatureToCombatant } from '../noyau/monde/spawn';
import { findCreatureById } from '../data';

/** L'inspection rend le statbloc COMPLET via le composant partagé du Codex (CodexSections) +
 *  une tête vivante (nom, PB, psychologie, États). On vérifie la présence des données clés. */
describe('InspectPanel', () => {
  const render = (c: Parameters<typeof InspectPanel>[0]['combatant']) =>
    renderToStaticMarkup(<InspectPanel combatant={c} onClose={() => {}} />);

  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 3 });

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

describe('InspectPanel — la Cible d’individu d’un Trait psy (EDOC 11 l.648 ; #3045)', () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let root: Root | null = null;
  afterEach(() => { act(() => root?.unmount()); root = null; useGame.setState(useGame.getInitialState(), true); });
  const trait = traits.find((t) => t.specsSource === 'ciblesPsy')!;
  const inspecter = (arg: string): string => {
    const pnj = { ...creatureToCombatant(findCreatureById('loup')!, 'pnj', { x: 0, y: 0 }), traits: [{ id: trait.id, arg }] };
    const el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
    act(() => root!.render(<InspectPanel combatant={pnj} onClose={() => {}} />));
    const texte = document.body.textContent ?? '';
    el.remove();
    return texte;
  };

  it('le statbloc nomme l’individu visé, jamais son id', () => {
    useGame.setState({ battle: { combatants: [{ id: 'kirstin', label: 'Dame Kirstin' }] } as never });
    const texte = inspecter('@kirstin');
    expect(texte).toContain(`${trait.label} (Dame Kirstin)`);
    expect(texte).not.toContain('@kirstin');
  });

  it('un individu sans nom connu se dit « une personne de la scène »', () => {
    const texte = inspecter('@absent');
    expect(texte).toContain(`${trait.label} (une personne de la scène)`);
    expect(texte).not.toContain('@absent');
  });
});
