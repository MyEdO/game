// @vitest-environment jsdom
/**
 * Primitive `<Prose>` : rend le Markdown des descriptions (règle 5), neutralise le HTML brut, et
 * n'auto-lie le vocabulaire de règles QUE sur une prose PORTÉE (#1392 Lot E). `mdToText` en extrait
 * un texte brut (tooltips).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Prose, mdToText } from './Prose';
import { CODEX } from './compendium/registry';
import { TeamSegments, type TeamSegment } from './TeamSegments';

/** Porteur d'essai : une entrée réelle, un chemin réel — jamais un porteur fantôme. */
const PORTEUR = { type: 'regles', id: 'soutien', chemin: 'desc' };

describe('Prose — annotations du Markdown complet', () => {
  const rendre = (segments: TeamSegment[]) => {
    const md = segments.map(s => s.text).join('');
    const element = document.createElement('div');
    const markup = renderToStaticMarkup(<TeamSegments segments={segments} />);
    expect(markup).not.toMatch(/<p\b[^>]*>\s*<(?:p|div|ul|ol|table)\b/);
    expect(markup).not.toMatch(/<span\b[^>]*>\s*<p\b/);
    element.innerHTML = markup;
    const simple = document.createElement('div');
    simple.innerHTML = renderToStaticMarkup(<Prose md={md} />);
    expect(element.textContent).toBe(simple.textContent);
    expect(segments.map(s => s.text).join('')).toBe(md);
    expect(element.querySelector('p p, p div, p ul, span p')).toBeNull();
    return element;
  };
  it('trois segments traversent un seul strong et conservent les deux tons', () => {
    const element = rendre([{ text: '**Gunnar', team: 'ally' }, { text: ' et ' }, { text: 'Rolf**', team: 'enemy' }]);
    expect(element.querySelectorAll('strong')).toHaveLength(1);
    expect(element.querySelector('strong .nm-ally')?.textContent).toBe('Gunnar');
    expect(element.querySelector('strong .nm-foe')?.textContent).toBe('Rolf');
  });
  it('le lien garde son href et le nom toné', () => {
    const element = rendre([{ text: '[Gunnar](https://example.com)', team: 'ally' }]);
    expect(element.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    expect(element.querySelector('a .nm-ally')?.textContent).toBe('Gunnar');
  });
  it('une entité avant le nom ne déplace pas son annotation', () => {
    const element = rendre([{ text: '&amp; ' }, { text: 'Gunnar', team: 'ally' }]);
    expect(element.textContent).toBe('& Gunnar');
    expect(element.querySelector('.nm-ally')?.textContent).toBe('Gunnar');
  });
  it('une frontière au milieu d’une entité ou d’un échappement ne colore pas le token invisible', () => {
    expect(rendre([{ text: '&' }, { text: 'amp', team: 'enemy' }, { text: ';' }]).querySelector('b')).toBeNull();
    expect(rendre([{ text: '\\' }, { text: '*', team: 'enemy' }]).querySelector('b')).toBeNull();
  });
  it('le code et les retours CRLF gardent leur texte sans annotation de code', () => {
    const element = rendre([{ text: '`Gunnar`\r\n\r\n```\r\nRolf\r\n```', team: 'ally' }]);
    expect(element.querySelectorAll('code')).toHaveLength(2);
    expect(element.querySelector('code b, pre b')).toBeNull();
  });
  it('la cellule de table GFM conserve le nom allié', () => {
    const element = rendre([{ text: '| Nom |\n| --- |\n| ' }, { text: 'Gunnar', team: 'ally' }, { text: ' |\n' }]);
    expect(element.querySelector('td .nm-ally')?.textContent).toBe('Gunnar');
  });
  it('les annotations précèdent l’auto-liage explicite sans le supprimer', () => {
    const markup = renderToStaticMarkup(<Prose md="Esquive" annotations={[{ text: 'Esquive', team: 'ally' }]} porteur={PORTEUR} />);
    const element = document.createElement('div'); element.innerHTML = markup;
    expect(element.querySelector('.nm-ally .codex-ref')).not.toBeNull();
    expect(element.textContent).toBe('Esquive');
  });
});

describe('Prose — rendu Markdown', () => {
  it('les liens Markdown gardent href, annotation et la matière partagée de Prose', () => {
    const md = '[Gunnar](https://example.com)';
    const html = renderToStaticMarkup(<Prose md={md} annotations={[{ text: md, team: 'ally' }]} />);
    const root = document.createElement('div');
    root.innerHTML = html;
    expect(root.querySelector('a')?.className).toBe('prose-link');
    expect(root.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    expect(root.querySelector('a .nm-ally')?.textContent).toBe('Gunnar');
  });
  it('compact garde les blocs, liens, listes, annotations et le même rendu Markdown', () => {
    const md = '**Gunnar** accompagne [Rolf](https://example.com).\n\nUne autre phrase.\n\n- Premier repère\n- Second repère\n\n| Nom |\n| --- |\n| Gunnar |';
    const annotations: TeamSegment[] = [{ text: '**Gunnar**', team: 'ally' }, { text: ' accompagne ' }, { text: '[Rolf](https://example.com)', team: 'enemy' }, { text: md.slice('**Gunnar** accompagne [Rolf](https://example.com)'.length) }];
    const simple = document.createElement('div');
    simple.innerHTML = renderToStaticMarkup(<Prose md={md} annotations={annotations} />);
    const compact = document.createElement('div');
    const markup = renderToStaticMarkup(<Prose md={md} annotations={annotations} compact />);
    compact.innerHTML = markup;
    const corps = compact.querySelector('.prose-compact');
    expect(corps?.innerHTML).toBe(simple.innerHTML);
    expect(compact.querySelectorAll('.prose-compact')).toHaveLength(1);
    expect(corps?.querySelectorAll(':scope > p')).toHaveLength(2);
    expect(corps?.querySelectorAll('li')).toHaveLength(2);
    expect(corps?.querySelector('table')).not.toBeNull();
    expect(corps?.querySelector('strong .nm-ally')?.textContent).toBe('Gunnar');
    expect(corps?.querySelector('a .nm-foe')?.textContent).toBe('Rolf');
    expect(corps?.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    expect(simple.querySelector('.prose-compact')).toBeNull();
    expect(markup).not.toMatch(/<p\b[^>]*>\s*<(?:p|div|ul|ol|table)\b/);
    expect(annotations.map(s => s.text).join('')).toBe(md);
  });

  it('TeamSegments active compact sur la prose entière', () => {
    const html = renderToStaticMarkup(<TeamSegments segments={[{ text: '**Gunnar', team: 'ally' }, { text: ' rejoint Rolf**.', team: 'enemy' }]} />);
    expect(html).toContain('class="prose-compact"');
    expect(html.match(/<strong>/g)).toHaveLength(1);
    expect(html).toContain('<b class="nm-ally">Gunnar</b>');
  });

  it('rend gras / italique', () => {
    const html = renderToStaticMarkup(<Prose md="**gras** et *ital*." />);
    expect(html).toContain('<strong>gras</strong>');
    expect(html).toContain('<em>ital</em>');
  });

  it('sépare les paragraphes (`\\n\\n`)', () => {
    const html = renderToStaticMarkup(<Prose md={'Premier.\n\nSecond.'} />);
    expect(html.match(/<p>/g)?.length).toBe(2);
  });

  it('NEUTRALISE le HTML brut (pas de dangerouslySetInnerHTML)', () => {
    const html = renderToStaticMarkup(<Prose md={'<script>alert(1)</script> texte'} />);
    expect(html).not.toContain('<script>');
    expect(html).toContain('texte');
  });
});

describe('Prose — le liage exige un PORTEUR (contrat #1392)', () => {
  const MD = "Un test d'Esquive en combat.";

  it('AVEC porteur : la mention du vocabulaire de règles devient un CodexRef', () => {
    const html = renderToStaticMarkup(<Prose md={MD} porteur={PORTEUR} />);
    expect(html).toContain('codex-ref');
    expect(html).toContain('Esquive');
  });

  it('SANS porteur : le texte est rendu NU — aucun appariement de libellé', () => {
    const html = renderToStaticMarkup(<Prose md={MD} />);
    expect(html).not.toContain('codex-ref');
    expect(html).toContain('Esquive');
  });

  it("n'auto-lie pas vers SOI (le porteur porte l'id de l'entrée rendue)", () => {
    const html = renderToStaticMarkup(
      <Prose md="La compétence Esquive." porteur={{ type: 'skills', id: 'esquive', chemin: 'desc' }} />,
    );
    expect(html).not.toContain('codex-ref');
  });

  it('absorbe la parenthèse de spécialisation ADJACENTE en une seule mention (fiche = libellé de base)', () => {
    const html = renderToStaticMarkup(<Prose md="Un Test de Savoir (Histoire) est requis." porteur={PORTEUR} />);
    expect(html).toContain('codex-ref');
    expect(html).toContain('Savoir (Histoire)');
  });
});

/** Nombre de blocs d'exergue rendus (`.prose-exergue`, un par couple citation+attribution). */
const exergues = (html: string): number => (html.match(/class="prose-exergue"/g) ?? []).length;
const descDe = (categorie: string, id: string): string => {
  const item = CODEX.find((c) => c.key === categorie)?.items.find((i) => i.id === id);
  if (!item?.desc) throw new Error(`entrée sans desc : ${categorie}/${id}`);
  return item.desc;
};

describe('Prose — plugin EXERGUE, borné par la prop (#1392)', () => {
  const COUPLE = '« Une citation. »\n\n– Un témoin';

  it('un couple citation + attribution devient UN bloc parchemin, À SA PLACE', () => {
    const html = renderToStaticMarkup(<Prose md={`Avant.\n\n${COUPLE}\n\nAprès.`} exergues />);
    expect(exergues(html)).toBe(1);
    // À sa place : le bloc est APRÈS « Avant. » et AVANT « Après. ».
    expect(html.indexOf('Avant.')).toBeLessThan(html.indexOf('prose-exergue'));
    expect(html.indexOf('prose-exergue')).toBeLessThan(html.indexOf('Après.'));
  });

  it('la citation en italique (`*« … »*`) compte aussi — le prédicat porte sur le TEXTE du paragraphe', () => {
    const html = renderToStaticMarkup(<Prose md={'*« Citée. »*\n\n*– Un marin*'} exergues />);
    expect(exergues(html)).toBe(1);
  });

  it('une citation SANS attribution suivante reste un paragraphe', () => {
    const html = renderToStaticMarkup(<Prose md={'« Citée. »\n\nSuite du récit.'} exergues />);
    expect(exergues(html)).toBe(0);
  });

  it('SANS la prop : aucun bloc, quoi que dise la prose', () => {
    const html = renderToStaticMarkup(<Prose md={`Avant.\n\n${COUPLE}`} />);
    expect(exergues(html)).toBe(0);
  });

  it('sites RÉELS : `careers/agitateur` rend 2 exergues, `careers/duelliste` 3, `careers/chevalier-errant` 0', () => {
    expect(exergues(renderToStaticMarkup(<Prose md={descDe('careers', 'agitateur')} exergues />))).toBe(2);
    expect(exergues(renderToStaticMarkup(<Prose md={descDe('careers', 'duelliste')} exergues />))).toBe(3);
    // NÉGATIF sur un site réel : une carrière dont la prose n'a pas de couple citation/attribution
    // ne doit rien encadrer — le prédicat ne fabrique pas d'exergue là où il n'y en a pas.
    expect(exergues(renderToStaticMarkup(<Prose md={descDe('careers', 'chevalier-errant')} exergues />))).toBe(0);
  });

  it('une EXERGUE ne lie RIEN : la citation est la voix du livre, pas du texte de règle', () => {
    // Même mot de vocabulaire des deux côtés : dans le couple, et dans un paragraphe ordinaire.
    const md = ['« On y apprend l’Esquive. »', '– Un vétéran', 'Un test d’Esquive en combat.'].join('\n\n');
    const html = renderToStaticMarkup(<Prose md={md} porteur={PORTEUR} exergues />);
    expect(exergues(html)).toBe(1);
    const debut = html.indexOf('prose-exergue');
    const fin = html.indexOf('</div>', html.indexOf('parchment-card-body'));
    const dedans = html.slice(debut, fin);
    const dehors = html.slice(0, debut) + html.slice(fin);
    expect(dedans).toContain('Esquive'); // le mot EST bien dans le bloc…
    expect(dedans).not.toContain('codex-ref'); // … mais rien n'y est lié.
    expect(dehors).toContain('codex-ref'); // hors du bloc, le liage reste actif.
  });

  it('site RÉEL sans la prop : la prose des Ogres ne rend AUCUN parchemin (ses « Points de vue » sont des sections de livre)', () => {
    const ogres = CODEX.find((c) => c.key === 'races')?.items.find((i) => i.id.startsWith('ogre'));
    expect(ogres?.desc, 'entrée de race ogre introuvable').toBeTruthy();
    expect(exergues(renderToStaticMarkup(<Prose md={ogres!.desc!} />))).toBe(0);
  });
});

describe('mdToText — Markdown → texte brut', () => {
  it('retire les marqueurs d\'emphase et normalise les espaces', () => {
    expect(mdToText('**a** *b*\n\nc')).toBe('a b c');
  });
  it('réduit un lien à son texte', () => {
    expect(mdToText('voir [la règle](http://x) ici')).toBe('voir la règle ici');
  });
  it('rend une table GFM rangée par rangée, sans séparatrice ni barres verticales', () => {
    const table = '| Difficulté | Modificateur |\n|---|---|\n| **Viser** | +20 |\n|  | –10 |';
    expect(mdToText(`Intro.\n\n${table}`)).toBe('Intro. Difficulté — Modificateur ; Viser — +20 ; –10 ;');
  });
});
