// @vitest-environment jsdom
/**
 * `TeamSegments` — un NOM cité se coupe entre ses MOTS, jamais dans un mot composé (R-M2,
 * docs/plans/2026-08-16-spec-hud-combat.md:71-74 ; verdict d'écran C1, A5 : « Pierre- / de-Fer »
 * dans le fil d'événements). La mise en page relève du navigateur ; ce contrat garde la STRUCTURE
 * qui la rend possible : chaque mot est une boîte, et la feuille de la primitive la rend insécable.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { TeamSegments } from './TeamSegments';
import { reglesCss, declarations } from '../../scripts/guards/lib/cssCouches.mjs';

describe('TeamSegments — un nom composé ne se coupe qu’entre ses mots', () => {
  it('chaque MOT d’un nom est une boîte insécable ; le texte lu est intact', () => {
    const hote = document.createElement('div');
    hote.innerHTML = renderToStaticMarkup(<TeamSegments segments={[{ text: 'Grunni Pierre-de-Fer', team: 'ally' }, { text: ' frappe.' }]} />);
    const nom = hote.querySelector('.nm-ally')!;
    expect(nom.textContent).toBe('Grunni Pierre-de-Fer');
    const insecables = reglesCss(readFileSync(join(process.cwd(), 'src', 'ui', 'styles', 'team-segments.css'), 'utf8'))
      .filter((r) => declarations(r.corps).some((d) => d.prop === 'white-space' && d.valeur.trim() === 'nowrap'))
      .flatMap((r) => r.selecteurs);
    const mots = [...nom.querySelectorAll('*')].filter((el) => insecables.some((sel) => el.matches(sel))).map((el) => el.textContent);
    expect(mots, 'un mot du nom peut se couper').toEqual(['Grunni', 'Pierre-de-Fer']);
  });
});
