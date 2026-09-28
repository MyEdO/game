// @vitest-environment jsdom
/**
 * `EntityChoice` — une entrée d'avancement lue sur sa STRUCTURE (#1988) : « A ou B » (`pick: 1`), « n parmi »
 * (`pick > 1`), option de tirage. Le compte « n parmi » se lit à la MÊME clé de catalogue que le texte
 * d'`advancementLabel` (`ref.parmi`). La donnée ne porte aucun `pick > 1` : la ref est construite.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntityChoice } from './EntityChip';
import { advancementLabel, careerLevels, type AdvancementRef } from '../data';
import { fr } from '../i18n/messages/fr';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const catalogue = fr as Record<string, string>;
const livre = { ...catalogue };
afterEach(() => { Object.assign(catalogue, livre); });

const rendu = (advancement: AdvancementRef): string =>
  renderToStaticMarkup(<EntityChoice category="talents" advancement={advancement} />);
/** Les séparateurs rendus entre les chips (`.chip-ou`), dans l'ordre. */
const separateurs = (html: string): string[] => [...html.matchAll(/<em class="chip-ou">([^<]*)<\/em>/g)].map((m) => m[1]);

describe('EntityChoice : « A ou B » et « n parmi » sur la structure', () => {
  const deuxParmi: AdvancementRef = { pick: 2, of: [{ id: 'guide-fluvial' }, { id: 'bonnes-jambes' }, { id: 'sixieme-sens' }] };

  it('`pick > 1` : le joueur lit « 2 parmi : » en tête, puis un chip par option, sans « ou »', () => {
    const html = rendu(deuxParmi);
    expect(separateurs(html)).toEqual(['2 parmi :']);
    for (const nom of ['Guide fluvial', 'Bonnes jambes', 'Sixième sens']) expect(html).toContain(`>${nom}<`);
  });

  it('`pick: 1` : les options sont séparées par « ou », sans compte', () => {
    const html = rendu({ pick: 1, of: [{ id: 'guide-fluvial' }, { id: 'bonnes-jambes' }] });
    expect(separateurs(html)).toEqual(['ou']);
  });

  it('le compte suit `ref.parmi`, la clé du texte d’`advancementLabel`', () => {
    catalogue['ref.parmi'] = '{n} among:';
    expect(separateurs(rendu(deuxParmi))).toEqual(['2 among:']);
    expect(advancementLabel('talents', deuxParmi)).toBe('2 among: Guide fluvial, Bonnes jambes, Sixième sens');
  });

  it('une option sans id (tirage) est une pastille nue, jamais un lien inventé', () => {
    const html = rendu({ pick: 1, of: [{ id: 'guide-fluvial' }, { random: 1 }] });
    expect(html).toContain('<span class="entity-chip plain">Talent aléatoire</span>');
  });
});

describe('EntityChoice : une option par IDENTITÉ, pas par id seul', () => {
  it('`alchimiste-2` (Métier forgeron | orfèvre, même id) se rend sans erreur de clé React', () => {
    const niveau = careerLevels.find((l) => l.id === 'alchimiste-2');
    const avancement = niveau?.skills.find((a) => 'pick' in a && a.of.some((o) => 'id' in o && o.id === 'metier'));
    expect(avancement, 'la donnée ne porte plus le cas réel : re-pointer ce test').toBeDefined();
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hote = document.createElement('div');
    const racine = createRoot(hote);
    try {
      act(() => { racine.render(<EntityChoice category="skills" advancement={avancement!} />); });
      expect(erreurs.mock.calls.map((c) => c.map(String).join(' '))).toEqual([]);
      expect(hote.textContent).toBe('Métier (Forgeron)ouMétier (Orfèvre)');
    } finally {
      act(() => { racine.unmount(); });
      erreurs.mockRestore();
    }
  });
});
