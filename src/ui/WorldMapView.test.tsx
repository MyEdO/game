import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { WorldMapView } from './WorldMapView';
import { declarations, reglesCss } from '../../scripts/guards/lib/cssCouches.mjs';

/**
 * Recette « impossible de cliquer sur la carte » — rendu STATIQUE sur la VRAIE carte de campagne
 * (état initial du store = projet Arène ; en SSR zustand sert le snapshot initial, d'où les seams
 * `hereSceneId`/`initialRouteId`). On verrouille l'AFFORDANCE : destinations reliées cerclées et
 * cliquables (curseur), routes elles-mêmes cliquables (large zone), lieux hors d'atteinte estompés
 * et explicatifs, panneau de départ complet quand une route est choisie.
 */
describe('WorldMapView — carte de campagne cliquable et lisible', () => {
  it('au Bourg : « Vous êtes ici », Futaie/Felsbach cliquables (cerclées), Tourbière estompée (aide)', () => {
    const html = renderToStaticMarkup(<WorldMapView hereSceneId="arene-hub" />);
    expect(html).toContain('Vous êtes ici');
    expect(html).toContain('Cliquez une destination CERCLÉE');
    expect(html).toContain('cursor:pointer'); // destinations reliées (et leurs routes)
    expect(html).toContain('pointer-events="stroke"'); // routes : large zone de clic invisible
    expect(html).toContain('cursor:help'); // la Tourbière (non reliée au Bourg) explique au clic
    expect(html).toContain('opacity="0.55"'); // … et se voit estompée
    expect(html).toContain('La Vieille Futaie');
    expect(html).toContain('Felsbach');
  });

  it('route sélectionnée (Bourg → Futaie) : panneau de départ — itinéraire, 18 km, marche forcée, Partir', () => {
    const html = renderToStaticMarkup(<WorldMapView hereSceneId="arene-hub" initialRouteId="route-futaie" />);
    expect(html).toContain('Le Bourg de l’Arène');
    expect(html).toContain('La Vieille Futaie');
    expect(html).toContain('18 km');
    expect(html).toContain('Marche forcée');
    expect(html).toContain('Partir');
  });
});

/**
 * #1117 (recette 3, bloquant) — les commandes du panneau latéral (« Rythme normal / Forcer +1 M »,
 * `.wm-modes`) étaient INJOIGNABLES : `elementFromPoint` résolvait sur le SVG de la carte à toutes les
 * coordonnées du bouton. `.map-canvas-frame` porte un `aspect-ratio` ; sous une cellule de grille plus
 * plate que ce ratio (empilement ≤900px), il débordait de `.worldmap-canvas` et recouvrait le panneau.
 * jsdom ne fait PAS de layout : on ne peut pas mesurer le recouvrement ici — on verrouille la RÈGLE
 * qui le rend impossible (le calque carte est borné à sa cellule).
 * Vérification NAVIGATEUR complémentaire (docs/recette-navigateur.md) : fenêtre < 901px de large,
 * carte du monde, route de mer sélectionnée → `document.elementFromPoint(cx, cy)` sur le bouton
 * « Forcer +1 M » doit rendre CE bouton, jamais un nœud de `.map-canvas-frame`.
 */
describe('carte du monde — le calque carte ne déborde pas sur le panneau (#1117)', () => {
  const css = readFileSync(new URL('./styles/world-meta.css', import.meta.url), 'utf8');

  it('`.worldmap-canvas` BORNE son contenu (sinon le cadre à ratio recouvre le panneau)', () => {
    const bloc = /\.worldmap-canvas\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(bloc, 'la règle existe').toBeTruthy();
    expect(bloc, 'le calque carte est borné à sa cellule de grille').toMatch(/overflow:\s*hidden/);
  });

  it('les commandes de cadence sont bien RENDUES dans le panneau (pas dans le canevas)', () => {
    const html = renderToStaticMarkup(<WorldMapView hereSceneId="arene-hub" initialRouteId="route-futaie" />);
    const panelStart = html.indexOf('worldmap-panel');
    expect(panelStart, 'le panneau existe').toBeGreaterThan(-1);
    // Le canevas est rendu AVANT le panneau : toute commande `.wm-modes` vit après son ouverture.
    const modes = html.indexOf('wm-modes');
    if (modes > -1) expect(modes).toBeGreaterThan(html.indexOf('worldmap-canvas'));
  });
});

/**
 * #1117 (recette 4) — panneau de route OUVERT, les commandes de zoom (Zoomer/Dézoomer/Recentrer)
 * devenaient incliquables : `elementFromPoint` résolvait l'aside, rendue APRÈS dans le DOM et sans
 * contexte d'empilement local côté carte. jsdom ne fait pas de layout : on verrouille la RÈGLE.
 * Vérification NAVIGATEUR : fenêtre ~850px, carte du monde, SÉLECTIONNER une route (panneau ouvert),
 * puis `document.elementFromPoint` au centre de « Zoomer » → doit rendre le bouton, jamais l'aside.
 */
describe('carte du monde — les commandes de zoom restent atteignables panneau ouvert (#1117)', () => {
  const css = readFileSync(new URL('./styles/world-meta.css', import.meta.url), 'utf8');

  it('le cadre carte ISOLE son empilement et les commandes de zoom y montent', () => {
    const frame = /\.map-canvas-frame\s*\{[^}]*isolation:\s*isolate[^}]*\}/.test(css);
    const zoom = /\.wm-zoom\s*\{[^}]*z-index:\s*\d+[^}]*\}/.test(css);
    expect(frame, '`.map-canvas-frame` crée son contexte d’empilement').toBe(true);
    expect(zoom, '`.wm-zoom` porte un z-index dans ce contexte').toBe(true);
  });
});

/**
 * #1117 — la GÉOMÉTRIE de cet écran, aux deux régimes. ≥901px : deux colonnes, le canevas PUIS
 * l'aside borné (`world-meta.css`), l'aside étiré sur la hauteur et défilant dans la sienne.
 * ≤900px : une seule colonne, garantie par la PRIMITIVE `Split` que l'écran compose — une surface
 * superposée à la carte serait incliquable, quel que soit son `z-index`.
 * Vérification NAVIGATEUR : fenêtre ~850px ET ~360px, route SÉLECTIONNÉE (panneau ouvert),
 * `document.elementFromPoint` au centre de « Zoomer » → le bouton ; le panneau reste lisible dessous.
 */
describe('carte du monde — la géométrie de ses deux régimes (#1117)', () => {
  const layout = reglesCss(readFileSync(new URL('./styles/layout.css', import.meta.url), 'utf8'));
  const ecran = reglesCss(readFileSync(new URL('./styles/world-meta.css', import.meta.url), 'utf8'));
  /** Dernière valeur déclarée pour `prop` sur `selecteur`, dans le contexte `media` (`null` = 1er niveau). */
  const valeur = (
    regles: { selecteurs: string[]; corps: string; media: string | null }[],
    selecteur: string, media: string | null, prop: string,
  ) => regles
    .filter((r) => r.selecteurs.includes(selecteur) && r.media === media)
    .flatMap((r) => declarations(r.corps))
    .filter((d) => d.prop === prop)
    .pop()?.valeur ?? null;
  const html = renderToStaticMarkup(<WorldMapView hereSceneId="arene-hub" initialRouteId="route-futaie" />);

  it('≥901px : deux colonnes — le canevas, puis l’aside BORNÉ', () => {
    expect(html.indexOf('worldmap-canvas'), 'le canevas est le PREMIER enfant').toBeLessThan(html.indexOf('worldmap-side'));
    expect(html, 'la colonne bornée est donc la SECONDE (`side="end"`)').toContain('data-side="end"');
    const mq = '@media (min-width: 901px)';
    expect(valeur(ecran, '.worldmap-layout', mq, '--aside'), 'l’écran pose SA largeur de colonne bornée par la variable que `Split` consomme')
      .toBe('min(400px, 40vw)');
    expect(valeur(ecran, '.worldmap-layout', mq, 'grid-template-columns'), 'les colonnes appartiennent à `Split`').toBe(null);
    expect(valeur(layout, ".split[data-side='end']", null, 'grid-template-columns'), 'la primitive lit `--aside`').toContain('var(--aside');
  });

  it('≥901px : l’aside s’ÉTIRE sur la hauteur et défile dans la sienne', () => {
    expect(html, 'l’écran demande des colonnes de même hauteur').toContain('data-align="stretch"');
    expect(valeur(layout, ".split[data-align='stretch']", null, 'align-items'), 'la primitive sert `align="stretch"`').toBe('stretch');
    const mq = '@media (min-width: 901px)';
    expect(valeur(ecran, '.worldmap-layout > aside.worldmap-side', mq, 'align-self')).toBe('stretch');
    expect(valeur(ecran, '.worldmap-layout > aside.worldmap-side', mq, 'overflow-y'), 'elle défile dans SA hauteur').toBe('auto');
  });

  it('≤900px : la PRIMITIVE empile en une colonne', () => {
    expect(html, 'l’écran déclare sa cassure à la primitive').toContain('data-stack-below="900"');
    expect(valeur(layout, ".split[data-stack-below='900']", '@media (max-width: 900px)', 'grid-template-columns')).toBe('minmax(0, 1fr)');
  });

  it('l’écran de carte ne REDÉCLARE pas la règle de la primitive', () => {
    expect(valeur(ecran, '.worldmap-layout', '@media (max-width: 900px)', 'grid-template-columns'),
      'l’empilement appartient à `Split`').toBe(null);
  });
});
