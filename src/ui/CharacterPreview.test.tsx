import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharacterPreview } from './CharacterPreview';
import type { Appearance } from '../engine/authoringAppearance';
import { asRigSpeciesId } from '../gameIso/rig/appearance';
import { pregen, PREGEN } from '../data/pregens';

const app: Appearance = { species: asRigSpeciesId('humain'), sex: 'F', build: 0.5, seed: 3 };

describe('CharacterPreview (rendu headless)', () => {
  it('rend le rig depuis une apparence brute, SANS <defs> local (`defsGlobaux()` montés au niveau App)', () => {
    const html = renderToStaticMarkup(<CharacterPreview appearance={app} career="soldat" size="sm" ambiance="panel" />);
    expect(html).toContain('class="rig"');
    expect(html).toContain('data-bone="torse"');
    expect(html).toContain('data-bone="tete"');
    expect(html).not.toContain('<defs');
    expect(html).toContain('charprev-sm');
    expect(html).toContain('charprev-amb-panel');
  });

  it("dérive apparence + équipement d'un héros : l'arme du pré-tiré influe sur le rendu", () => {
    const hero = pregen(PREGEN.soldat);
    expect(hero.weapons.length).toBeGreaterThan(0); // prérequis du test : le soldat est armé
    const armed = renderToStaticMarkup(<CharacterPreview hero={hero} />);
    expect(armed).toContain('data-bone="torse"');
    expect(armed).toContain('data-bone="arme"'); // groupe d'arme rendu
    // Même héros désarmé → plus d'os d'arme : l'équipement du Combatant pilote bien le rig.
    const disarmed = renderToStaticMarkup(<CharacterPreview hero={{ ...hero, weapons: [] }} />);
    expect(disarmed).not.toContain('data-bone="arme"');
  });
});
