/**
 * Primitive `<Prose>` : rend le Markdown des descriptions (règle 5), neutralise le HTML brut, et
 * n'auto-lie le vocabulaire de règles QUE sur une prose PORTÉE (#1392 Lot E). `mdToText` en extrait
 * un texte brut (tooltips).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Prose, mdToText } from './Prose';
import { CODEX } from './compendium/registry';

/** Porteur d'essai : une entrée réelle, un chemin réel — jamais un porteur fantôme. */
const PORTEUR = { type: 'regles', id: 'soutien', chemin: 'desc' };

describe('Prose — rendu Markdown', () => {
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
