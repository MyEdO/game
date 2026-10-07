/**
 * `RecapLine` gagne la CAPACITÉ de porter une issue de combat NARRÉE (#1078 LOT A1, décision
 * utilisateur « RecapLine unique ») : le pont `recapLineOfEvent` reverse la narration existante
 * (`narrateEvent`) dans le vocabulaire structuré, sans composer un seul mot de texte.
 *
 * PARITÉ mesurée contre le rendu du JOURNAL lui-même (`NarratedSegments`, ce que compose `LogDrawer`) :
 * même texte, même coloration par camp. Les modales de jet, elles, rendent seulement la donnée
 * (#1078 LOT B1) — un écart de narration entre le journal et l'issue se voit ICI.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecapLineRow } from './RecapLine';
import { NarratedSegments } from './NarratedLine';
import { TeamSegments } from './TeamSegments';
import { recapLineOfEvent, recapLinesOfEvents } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';

const combatants = [
  { id: 'h1', label: 'Gustav', kind: 'hero' },
  { id: 'e1', label: 'Rat géant', kind: 'enemy' },
];

/** Texte NU d'un rendu (balises retirées, espaces normalisés) — la comparaison porte sur ce que le
 *  joueur LIT, pas sur le markup (les deux renderers ont volontairement des enveloppes distinctes). */
function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

const SAMPLE = [
  ev('attack', 'Gustav frappe Rat géant : 5 Blessures', 'h1', 'e1'),
  ev('damage', 'Rat géant mord Gustav : 3 Blessures', 'e1', 'h1'),
  ev('crit', 'Gustav inflige un coup critique à Rat géant', 'h1', 'e1'),
  ev('condition', 'Gustav gagne Sonné', 'h1'),
  ev('info', 'Round 2', undefined),
];

describe('recapLineOfEvent — parité de TEXTE avec la ligne de journal', () => {
  for (const e of SAMPLE) {
    it(`« ${e.text} » : même texte des deux côtés`, () => {
      const journal = plainText(renderToStaticMarkup(<NarratedSegments event={e} combatants={combatants} />));
      const recap = plainText(renderToStaticMarkup(<RecapLineRow line={recapLineOfEvent(e, combatants)} />));
      expect(recap).toBe(journal);
      expect(recap).toContain(e.text);
    });
  }
});

describe('recapLineOfEvent — la COULEUR DE CAMP est préservée', () => {
  it('le héros est allié, la créature ennemie — mêmes classes que le journal', () => {
    // Les enveloppes diffèrent volontairement (le journal a sa gouttière `.jr-ic`/`.jr-tx`) : la
    // parité porte sur le TEXTE lu et le COMPTE de noms colorés, jamais sur le markup.
    const e = SAMPLE[0];
    const html = renderToStaticMarkup(<RecapLineRow line={recapLineOfEvent(e, combatants)} />);
    expect(html).toContain('class="nm-ally">Gustav<');
    expect(html).toContain('class="nm-foe">Rat géant<');
    const journal = renderToStaticMarkup(<NarratedSegments event={e} combatants={combatants} />);
    expect(html.match(/nm-ally/g)?.length).toBe(journal.match(/nm-ally/g)?.length);
    expect(html.match(/nm-foe/g)?.length).toBe(journal.match(/nm-foe/g)?.length);
  });

  it('sans combattants fournis : un seul segment neutre, aucun nom coloré', () => {
    const line = recapLineOfEvent(SAMPLE[0]);
    expect(line.segments).toEqual([{ text: SAMPLE[0].text }]);
    expect(renderToStaticMarkup(<RecapLineRow line={line} />)).not.toContain('nm-');
  });

  it('la concaténation des segments REND le texte plat (`text` reste la source des surfaces sans couleur)', () => {
    for (const line of recapLinesOfEvents(SAMPLE, combatants)) {
      expect(line.segments!.map((s) => s.text).join('')).toBe(line.text);
    }
  });
});

describe('RecapLineRow — Markdown avec et sans segments', () => {
  it('le récap de voyage sans segments rend le gras', () => {
    const html = renderToStaticMarkup(<RecapLineRow line={{ text: 'La **pluie** ralentit la colonne', tone: 'bad' }} />);
    expect(html).toContain('<strong>pluie</strong>');
    expect(html).not.toContain('**');
    expect(html).toContain('recap-line bad');
    expect(html).toContain('class="row recap-line bad"');
    expect(html).toContain('data-align="start"');
    expect(html).toContain('data-gap="xs"');
    expect(html).toContain('data-wrap="no"');
    expect(html).toContain('class="prose-compact"');
  });
  it('le journal et le récap gardent le même Markdown et les mêmes tons', () => {
    const segments = [{ text: '**' }, { text: 'Gustav', team: 'ally' as const }, { text: '** rencontre ' }, { text: 'Rat géant', team: 'enemy' as const }];
    const text = segments.map(s => s.text).join('');
    const journal = renderToStaticMarkup(<TeamSegments segments={segments} />);
    const recap = renderToStaticMarkup(<RecapLineRow line={{ text, segments }} />);
    expect(plainText(recap)).toBe(plainText(journal));
    for (const html of [journal, recap]) {
      expect(html).toContain('<strong><b class="nm-ally">Gustav</b></strong>');
      expect(html).toContain('<b class="nm-foe">Rat géant</b>');
      expect(html).not.toContain('**');
    }
  });
});
