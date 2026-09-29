// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PartyDock } from './PartyDock';
import { createHero } from '../engine/character';

describe('PartyDock', () => {
  const h1 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 3 });
  const h2 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Elsa', seed: 4 });
  h1.id = 'h1'; h2.id = 'h2';

  it('conserve Blessures et États sans porter l’ordre des tours', () => {
    h1.wounds = { current: 11, max: 11 };
    h1.conditions = [{ id: 'assourdi', value: 1 }];
    const html = renderToStaticMarkup(<PartyDock heroes={[h1, h2]} onOpen={() => {}} />);
    expect(html).toContain('party-dock');
    expect(html).toContain('11/11');
    expect(html).toContain('ptile-states');
    expect(html).toContain('pt-state');
    // Ni caret ni portrait agrandi : la carte garde la même géométrie d'une tuile à l'autre (R-M1).
    expect(html).not.toContain('ptile-caret');
    expect(html).not.toMatch(/class="ptile[^"]*\bactive\b/);
  });

  // Planche USER 2026-08-17 (spec §1c-bis, BANDEAU) : « NOM VISIBLE SOUS LA TUILE — la planche
  // l'affiche en permanence, l'interdit "nom au survol" du contrat précédent TOMBE ».
  it('imprime le NOM de chaque héros SOUS sa tuile, et le garde en title/aria-label', () => {
    const html = renderToStaticMarkup(<PartyDock heroes={[h1, h2]} onOpen={() => {}} />);
    expect(html).toContain('title="Gunnar — fiche du personnage"');
    expect(html).toContain('aria-label="Elsa — fiche du personnage"');
    expect(html).toContain('<figcaption><span><span class="nom-mot">Gunnar</span></span></figcaption>');
    expect(html).toContain('<figcaption><span><span class="nom-mot">Elsa</span></span></figcaption>');
    // Balises retirées : ne reste que ce qu'un joueur LIT à l'écran.
    const visible = html.replace(/<[^>]*>/g, ' ');
    expect(visible).toContain('Gunnar');
    expect(visible).toContain('Elsa');
  });

  // Planche USER 2026-08-17 : 1 colonne × 3 cases chiffrées au flanc du portrait, vides dessinées.
  it('chaque tuile porte 3 alvéoles d’État DESSINÉES, chiffrées, que le héros en porte ou non', () => {
    h1.conditions = [{ id: 'hemorragique', value: 3 }];
    h2.conditions = [];
    const html = renderToStaticMarkup(<PartyDock heroes={[h1, h2]} onOpen={() => {}} />);
    // 2 tuiles × 3 cases : le compte ne dépend pas des États portés (« zéro État ne rétrécit pas la
    // carte »).
    expect((html.match(/pt-state|pt-void/g) ?? []).length).toBe(6);
    expect((html.match(/data-reserve/g) ?? []).length).toBe(2);
    // … dont 5 alvéoles VIDES dessinées (2 chez Gunnar qui porte un État, 3 chez Elsa qui n'en a pas).
    expect((html.match(/pt-void/g) ?? []).length).toBe(5);
    // … et l'État porté dit SON chiffre.
    expect(html).toContain('<b class="pt-n">3</b>');
  });

  // Spec §1c-bis BANDEAU (arbitrage user 2026-08-17) : le bandeau ne marque PAS l'acteur du tour —
  // l'ordre du tour et l'actif vivent à la frise d'initiative seule.
  it('ne marque JAMAIS l’acteur du tour : les cartes sont indistinctes, combat en cours ou non', () => {
    const html = renderToStaticMarkup(<PartyDock heroes={[h1, h2]} targeting onOpen={() => {}} />);
    const host = document.createElement('div');
    host.innerHTML = html;
    const figures = [...host.querySelectorAll('.pd-track > figure')];
    expect(figures.length).toBe(2);
    // Aucune carte ne porte d'attribut de SITUATION (l'enveloppe est nue) : rien ne distingue une
    // tuile d'une autre côté marquage.
    for (const fig of figures) expect(fig.getAttributeNames()).toEqual([]);
    // … et les deux boîtes sont rendues à l'identique (même classes, même chrome).
    const chrome = figures.map((f) => f.querySelector('.ptile-wrap')!.getAttribute('class'));
    expect(chrome[0]).toBe(chrome[1]);
  });

  // La plomberie du marqueur est ABSENTE, pas masquée : ni prop, ni attribut, ni règle CSS.
  it('ne porte AUCUNE plomberie de marqueur d’actif (composant, appelant, feuille)', () => {
    const lire = (f: string) => readFileSync(join(process.cwd(), 'src', 'ui', f), 'utf8');
    for (const f of ['PartyDock.tsx', 'CampaignView.tsx', 'styles/party-dock.css']) {
      expect(lire(f), f).not.toMatch(/actingId|data-acting/);
    }
    // La feuille ne vise plus la carte par un attribut de situation (aucun sélecteur d'attribut
    // sur l'enveloppe du bandeau).
    expect(HUD_CSS).not.toMatch(/\.pd-track > figure\[/);
  });
});

// ── SONDES PIXEL du juge vision (2026-08-17) promues en contrats ────────────────────────────────
// La composition de la carte se juge sur la STRUCTURE montée (qui contient quoi) et sur les BOÎTES
// déclarées : aucune sonde DOM ne voyait que le liseré d'actif encerclait le nom, ni que la légende
// réservait deux lignes en permanence.
const HUD_CSS = readFileSync(join(process.cwd(), 'src', 'ui', 'styles', 'party-dock.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const ruleOf = (selector: string) => {
  const hits = [...HUD_CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((b) => b[1].replace(/\s+/g, ' ').trim() === selector);
  expect(hits.length, `règle « ${selector} » : ${hits.length} occurrence(s), attendu 1`).toBe(1);
  return hits[0][2];
};

describe('PartyDock — micro-rendu (sondes pixel du juge vision, 2026-08-17)', () => {
  const g1 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 3 });
  const g2 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Elsa', seed: 4 });
  g1.id = 'g1'; g2.id = 'g2';
  const monter = (props: Parameters<typeof PartyDock>[0]) => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<PartyDock {...props} />);
    return host;
  };

  // B-1 : la planche pose le nom SOUS la boîte, sur le fond du bandeau — la boîte porte seule le
  // chrome (plaque + filet), l'enveloppe reste nue.
  it('B-1 — le nom est HORS de la boîte bordée, qui porte seule le chrome', () => {
    const host = monter({ heroes: [g1, g2], onOpen: () => {} });
    const fig = host.querySelector('figure')!;
    const boite = fig.querySelector('.ptile-wrap')!;
    const nom = fig.querySelector('figcaption')!;
    expect(boite.contains(nom)).toBe(false);
    expect(nom.parentElement).toBe(fig);
    const enveloppe = ruleOf('.pd-track > figure');
    expect(enveloppe).not.toMatch(/(^|[;\s])border\s*:/);
    expect(enveloppe).not.toMatch(/(^|[;\s])background\s*:/);
    const boiteCss = ruleOf('.party-dock .ptile-wrap');
    expect(boiteCss).toMatch(/border\s*:/);
    expect(boiteCss).toMatch(/background\s*:/);
    // Le PAS de défilement (R-M1) reste porté par l'enveloppe : la boîte n'a pas emporté la tuile.
    expect(enveloppe).toMatch(/flex:\s*0 0 var\(--pd-tile\)/);
    expect(enveloppe).toMatch(/scroll-snap-align:\s*start/);
  });

  // Planche USER 2026-08-17 : la colonne d'États est SŒUR du portrait dans la boîte de la carte — À
  // CÔTÉ de lui, plus posée dessus. C'est une STRUCTURE (le DOM monté la porte à toute largeur), pas
  // un texte de règle CSS : la GÉOMÉTRIE qui en découle se mesure au navigateur
  // (`scripts/recette/hud-clickables.mjs` : chaque portrait reçoit son clic).
  it('la colonne d’États est SŒUR du portrait, dans la carte de SON héros', () => {
    g1.conditions = [{ id: 'hemorragique', value: 2 }];
    g2.conditions = [];
    const host = monter({ heroes: [g1, g2], onOpen: () => {} });
    const boites = [...host.querySelectorAll('.ptile-wrap')];
    expect(boites.length, 'une boîte par héros').toBe(2);
    for (const boite of boites) {
      const portrait = boite.querySelector(':scope > .ptile');
      const etats = boite.querySelector(':scope > .ptile-states');
      expect(portrait, 'le portrait est un enfant DIRECT de la boîte').not.toBeNull();
      expect(etats, 'la colonne d’États est un enfant DIRECT de la boîte, comme lui').not.toBeNull();
      expect(portrait!.contains(etats!), 'la colonne ne vit pas DANS le portrait').toBe(false);
    }
  });

  // B-2 : `height: 2.6em` réservait DEUX lignes à toute légende, portées ou non.
  it('B-2 — la légende suit son contenu, une ligne au minimum, tuiles alignées par le haut', () => {
    const legende = ruleOf('.pd-track > figure > figcaption');
    expect(legende).not.toMatch(/(^|[;\s])height\s*:/);
    expect(legende).toMatch(/min-height:\s*1\.3em/);
    // Deux lignes AU PLUS (R-M2 : coupe entre mots, `coupeAuMot`), jamais une ellipse au caractère.
    expect(legende).not.toMatch(/text-overflow|line-clamp/);
    // Les cartes s'alignent par le HAUT de leur boîte : une légende plus courte ne remonte rien.
    expect(ruleOf('.pd-track')).toMatch(/align-items:\s*flex-start/);
  });
});
