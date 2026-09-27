import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimatedRigToken } from './AnimatedRigToken';
import type { Combatant } from '../engine/types';

const hero = {
  id: 'h1', name: 'Test', kind: 'hero', career: 'Soldat',
  appearance: { species: 'humains-reiklander', sex: 'M', build: 0.5 },
} as unknown as Combatant;

describe('AnimatedRigToken', () => {
  it('rend le rig du combattant (os nommés)', () => {
    const html = renderToStaticMarkup(
      <svg>
        <AnimatedRigToken combatant={hero} />
      </svg>,
    );
    expect(html).toContain('data-bone=');
  });
});
