import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { ScreenShell } from './ScreenShell';
import { declarations, reglesCss } from '../../scripts/guards/lib/cssCouches.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * #1993 F1 — à 360 px, le corps d'un écran borné défile sous l'en-tête et la barre d'outils ANCRÉS,
 * jamais le voile ni la page : l'overlay Narratif (839 px de contenu pour 780 visibles) laissait
 * « Ajouter un stade » et la source d'un PNJ hors d'atteinte. jsdom ne met rien en page : on verrouille
 * la STRUCTURE et la RÈGLE qui rendent le contenu atteignable ; la preuve au pixel se rejoue au kit CDP
 * (`scripts/recette/lib.mjs`). Un canevas (`body='full'`) compose son rail : garde `sitesRailHorsCanevas`
 * (`css-modules-guard.test.ts`).
 */
const VOILE = /^<div role="dialog" aria-modal="true"[^>]*\sclass="worldmap-overlay">/;

const regle = (feuille: string, selecteur: string) => {
  const decl = reglesCss(readFileSync(new URL(`./styles/${feuille}`, import.meta.url), 'utf8'))
    .filter((r) => r.selecteurs.includes(selecteur) && r.media === null)
    .flatMap((r) => declarations(r.corps));
  return (prop: string) => decl.filter((d) => d.prop === prop).pop()?.valeur ?? null;
};

describe('ScreenShell — le corps défile sous l’en-tête ancré', () => {
  for (const body of ['centered', 'centered-wide'] as const) {
    const colonne = `<div class="screen-colonne"${body === 'centered-wide' ? ' data-large="true"' : ''}>`;
    const rail = `<div class="screen-scroll">${colonne}<p id="contenu">contenu</p></div></div>`;

    it(`body='${body}' : le contenu vit dans \`.screen-scroll > .screen-colonne\`, l’en-tête, la barre d’outils et la bande hors du rail`, () => {
      const html = renderToStaticMarkup(
        <ScreenShell title="Titre" onClose={() => {}} body={body} tabs={<span>onglets</span>} backdrop="inconnu">
          <p id="contenu">contenu</p>
        </ScreenShell>,
      );
      expect(html, 'le voile ouvre le rendu').toMatch(VOILE);
      const ouverture = html.indexOf(rail);
      expect(ouverture, 'le rail porte la colonne, qui porte le contenu, et rien d’autre').toBeGreaterThan(-1);
      const avant = html.slice(0, ouverture);
      for (const ancre of ['worldmap-head', 'screen-toolbar', 'scene-backdrop']) {
        expect(avant, `${ancre} précède le rail, hors de lui`).toContain(ancre);
      }
      expect(html.slice(ouverture), 'sans pied, le rail est le DERNIER enfant du voile').toBe(`${rail}</div>`);
    });

    it(`body='${body}' : le pied \`CadrePied\` suit le rail, HORS de lui, dans la même colonne`, () => {
      const html = renderToStaticMarkup(
        <ScreenShell title="Titre" onClose={() => {}} body={body} footer={<button type="button">Valider</button>}>
          <p id="contenu">contenu</p>
        </ScreenShell>,
      );
      const ouverture = html.indexOf(rail);
      expect(ouverture, 'le rail porte le seul contenu').toBeGreaterThan(-1);
      const apres = html.slice(ouverture + rail.length);
      expect(apres.startsWith(colonne), 'le pied vit dans la colonne du corps, après le rail').toBe(true);
      expect(apres, 'le pied est le `CadrePied`').toMatch(/^<div class="screen-colonne"[^>]*><div class="(?:[^"]* )?cadre-pied(?: [^"]*)?"/);
      expect(apres.endsWith('<button type="button">Valider</button></div></div></div>'), 'le pied est le DERNIER enfant du voile').toBe(true);
    });
  }

  it("body='full' : la coquille ne pose pas de rail, le canevas occupe le reste du voile", () => {
    const html = renderToStaticMarkup(
      <ScreenShell title="Titre" onClose={() => {}} tabs={<span>onglets</span>}>
        <p id="contenu">contenu</p>
      </ScreenShell>,
    );
    expect(html).toMatch(VOILE);
    expect(html, 'un canevas compose son propre rail').not.toContain('screen-scroll');
    expect(html, 'le canevas est le DERNIER enfant du voile').toMatch(/<\/div><p id="contenu">contenu<\/p><\/div>$/);
  });

  it('la règle du rail : il prend le reste de la hauteur du voile et défile', () => {
    const voile = regle('screen-shell.css', '.worldmap-overlay');
    expect(voile('display'), 'le voile est une colonne flex : le rail y prend le reste').toBe('flex');
    expect(voile('flex-direction')).toBe('column');
    const rail = regle('layout.css', '.screen-scroll');
    expect(rail('flex')).toBe('1');
    expect(rail('overflow-y')).toBe('auto');
  });

  it('aucun défilement posé sur le VOILE — ni `.worldmap-overlay`, ni une classe passée à `<ScreenShell className>`', () => {
    const classesDuVoile = new Set(['worldmap-overlay']);
    for (const { rel, text } of readCorpus(['src/ui'], { exts: ['.tsx'] })) {
      for (const m of text.matchAll(/<ScreenShell\b/g)) {
        // Attributs de PREMIER niveau de la balise ouvrante : le contenu des `{…}` (titre en JSX) n'en est pas.
        let prof = 0;
        let tete = '';
        for (let i = m.index! + m[0].length; i < text.length; i++) {
          const c = text[i];
          if (c === '{') prof++;
          else if (c === '}') prof--;
          else if (c === '>' && prof === 0) break;
          if (prof === 0) tete += c;
        }
        const cls = /\bclassName="([^"]+)"/.exec(tete)?.[1];
        for (const c of cls?.split(/\s+/) ?? []) classesDuVoile.add(c);
        expect(tete, `${rel} : \`className\` de la coquille calculé — la garde ne le lirait pas`).not.toMatch(/\bclassName=(?!")/);
      }
    }
    const fautifs: string[] = [];
    for (const { rel, text } of readCorpus(['src/ui'], { exts: ['.css'] })) {
      for (const r of reglesCss(text)) {
        const voile = r.selecteurs.filter((s: string) => classesDuVoile.has(s.replace(/^\./, '')) && /^\.[\w-]+$/.test(s));
        if (!voile.length) continue;
        for (const d of declarations(r.corps)) {
          if (/^overflow(-y)?$/.test(d.prop)) fautifs.push(`${rel} : ${voile.join(', ')} { ${d.prop}: ${d.valeur} }`);
        }
      }
    }
    expect(fautifs, 'le voile défile en entier (en-tête compris) : le corps de la coquille défile déjà').toEqual([]);
  });
});
