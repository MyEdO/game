// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { GearAssignList } from './GearAssignList';
import type { LootGear } from '../state/store';
import type { Combatant } from '../engine/types';
import { useGame } from '../state/store';

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

  it('qualité MAGIQUE portée par l’Effet (objet custom) : rendue en chip, id brut jamais affiché', () => {
    const html = render([{ label: 'Amulette', magic: true, effect: { type: 'giveTrapping', custom: 'Amulette', qualities: ['empaleuse'], identified: true } }]);
    expect(html).toContain('entity-chip');
    expect(html).toContain('Empaleuse'); // libellé résolu via le registre, pas l'id « empaleuse »
    expect(html).not.toContain('>empaleuse<');
  });

  it('objet catalogué + qualité magique NON identifié : qualités masquées jusqu’à Évaluation', () => {
    const html = render([{ label: 'Hallebarde', magic: true, effect: { type: 'giveTrapping', trappingId: 'hallebarde', qualities: ['empaleuse'], identified: false } }]);
    expect(html).toContain('non identifié');
    expect(html).not.toContain('entity-chip'); // ni def ni magiques tant que non révélé
  });
});

describe('GearAssignList — Évaluer / Détecter suivent qui peut tenter le Test (LDB 09 l.30)', () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const inconnu: LootGear = { label: 'Hallebarde', magic: true, effect: { type: 'giveTrapping', trappingId: 'hallebarde', qualities: ['empaleuse'], identified: false } };
  /** Monté au client : le groupe se lit au store (`useGame`), comme à l'écran de victoire. */
  const geste = (party: Combatant[], label: 'Évaluer' | 'Détecter', id: string) => {
    useGame.setState({ party });
    const hote = document.createElement('div');
    const root = createRoot(hote);
    act(() => root.render(<GearAssignList gear={[inconnu]} assignable={party} onAssign={() => {}} onAppraise={() => {}} />));
    const bouton = [...hote.querySelectorAll('button')].find((b) => b.textContent === label);
    const etat = { rendu: !!bouton, ferme: bouton?.getAttribute('aria-disabled') ?? null, raison: hote.querySelector(`#${id}-reason`)?.textContent ?? null };
    act(() => root.unmount());
    return etat;
  };

  it('un héros avec une Augmentation en Évaluation : « Évaluer » est offert', () => {
    const base = hero('h', 'Hans');
    const h = { ...base, characteristics: { ...base.characteristics, intelligence: 30 }, skills: [{ id: 'evaluation', characteristic: 'intelligence', advances: 5 }] } as Combatant;
    expect(geste([h], 'Évaluer', 'gear-eval-0')).toEqual({ rendu: true, ferme: null, raison: null });
  });

  it('personne qui l’ait : « Évaluer » est fermé, sa raison NOMMÉE', () => {
    expect(geste([hero('h', 'Hans')], 'Évaluer', 'gear-eval-0')).toEqual({ rendu: true, ferme: 'true', raison: 'Personne dans le groupe ne peut tenter le Test d’Évaluation.' });
  });

  it('un héros porte le Talent Détection d’artefact (LDB 10 l.336) : « Détecter » est offert', () => {
    const h = { ...hero('h', 'Hans'), talents: [{ talentId: 'detection-d-artefact', times: 1 }] } as unknown as Combatant;
    expect(geste([h], 'Détecter', 'gear-detect-0')).toEqual({ rendu: true, ferme: null, raison: null });
  });

  it('personne ne porte le Talent : « Détecter » est fermé, sa raison nomme le Talent', () => {
    expect(geste([hero('h', 'Hans')], 'Détecter', 'gear-detect-0')).toEqual({ rendu: true, ferme: 'true', raison: "Personne dans le groupe ne peut tenter « Détection d'artefact »." });
  });
});
