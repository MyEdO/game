// @vitest-environment jsdom
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import { HeroSheet } from './HeroSheet';
import { AdvancementPanel } from './CharacterSheet';

/** Soldat FM 50, Force 30, Intimidation +10, Exténué ; Intimidation sur la Force Mentale (LDB 09 l.294). */
function soldat(): Combatant {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sold', seed: 3 }) as Combatant;
  h.characteristics.force = 30;
  h.characteristics['force-mentale'] = 50;
  h.skills = [...h.skills.filter((s) => s.id !== 'intimidation'), { id: 'intimidation', characteristic: 'force', advances: 10 }];
  h.conditions = [{ id: 'extenue', value: 1 }];
  return h;
}

describe('Fiches — la valeur de Compétence est celle du moteur (#3059)', () => {
  beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  afterEach(() => { demonterRacines(); resetRule('test-intimidation-carac'); });

  it('HeroSheet : Intimidation à FM 50 + 10, Exténué → 50 roulé, sa puce d’État, le libellé de la Caractéristique au survol', () => {
    setRule('test-intimidation-carac', 'FM');
    const h = soldat();
    useGame.setState({ party: [h], battle: null });
    const { container } = monterRacine(<HeroSheet hero={h} header={false} skillsVariant="valeurs" />);
    const ligne = [...container.querySelectorAll('.skill-line')].find((l) => l.querySelector('.sk-name')?.textContent?.trim() === 'Intimidation');
    expect(ligne?.querySelector('.sk-val')?.textContent).toBe('50');
    expect(ligne?.querySelector('.rm-roll-mods')?.textContent).toContain('Exténué');
    expect(ligne?.getAttribute('title')).toBe('Force Mentale 50 + 10');
  });

  it('Avancement : Intimidation à FM 50 + 10 → Niveau de Compétence 60, hors États', () => {
    setRule('test-intimidation-carac', 'FM');
    const html = renderToStaticMarkup(<AdvancementPanel hero={soldat()} />);
    expect(html).toContain('Intimidation <em>60</em>');
  });
});
