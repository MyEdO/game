import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RigPortrait } from './RigPortrait';
import { mutationById } from '../data/mutations';
import type { Combatant } from '../engine/types';

const hero = { id: 'h1', kind: 'hero', name: 'Soldat', career: 'Soldat', appearance: { species: 'humains-reiklander', sex: 'M', build: 0.5, seed: 3 } } as unknown as Combatant;

describe('RigPortrait', () => {
  it('rend un svg avec viewBox cadré + le visage (tête) du rig', () => {
    const html = renderToStaticMarkup(<RigPortrait combatant={hero} ring="#4f8fe0" />);
    expect(html).toContain('class="rig-portrait"');
    expect(html).toContain('viewBox="');
    expect(html).toContain('data-bone="tete"');
  });

  it('montre la mutation de visage du héros (Œil énorme)', () => {
    const mute = { ...hero, id: 'h2', mutations: [mutationById('oeil-enorme')!] } as unknown as Combatant;
    const html = renderToStaticMarkup(<RigPortrait combatant={mute} ring="#4f8fe0" />);
    expect(html).toContain('data-mut="oeil-enorme"');
  });
});
