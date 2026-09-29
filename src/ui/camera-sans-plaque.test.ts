/**
 * COMPOSITION DES DEUX PLAQUES D'OUTILS (spec `docs/plans/2026-08-16-spec-hud-combat.md`, zones 6 et
 * 11, §1c-ter « une plaque unique, jamais des éléments épars ») : la caméra se pilote au GESTE
 * (glisser, molette, pincer) et au CLAVIER (registre `state/keybindings`) sur l'écran de jeu ;
 * l'ÉDITEUR garde sa plaque `ViewControls` (outil d'authoring à la souris).
 *
 * Contrats POSITIFS et EXHAUSTIFS sur la composition (le fichier source, pas un rendu : c'est le
 * MONTAGE qui est en jeu, et un rendu de `CampaignView` traîne tout le store de partie derrière lui) :
 * en COMBAT le rail porte le journal ET l'ouvreur de dossier de navire, et RIEN d'autre ; hors combat
 * le rail n'est pas monté du tout et le journal rejoint la rangée d'ouvreurs du pont.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('commandes de vue — hors du jeu, dans l’éditeur', () => {
  it('l’ÉDITEUR la monte toujours (son cycle de rotation par cran lui est local)', () => {
    const editor = src('./editor/EditorCanvas.tsx');
    expect(editor).toContain('<ViewControls');
    expect(editor).toMatch(/import\s+\{[^}]*ViewControls[^}]*\}/);
  });

  it('le rail d’outils est monté EN COMBAT et porte le journal + le dossier de navire, rien d’autre', () => {
    const campaignView = src('./CampaignView.tsx');
    // Le rail est gaté sur le mode bataille : hors combat, la plaque du bas est le pont d'exploration.
    // Il est la surface de la zone `outils` de la couche HUD (#1919).
    expect(campaignView).toMatch(/mode === 'battle' && \(\s*\n\s*<Stack data-zone="outils"[^>]*>\s*\n\s*<Stack\b[^>]*className="hud-rail skin-bois"/s);
    const rail = campaignView.slice(campaignView.indexOf('className="hud-rail skin-bois"'));
    const corps = rail.slice(0, rail.indexOf('</Stack>'));
    expect(corps).toContain('<LogDrawer');
    // L'ouvreur du dossier porte la peau « tôle vissée » PARTAGÉE (components.css).
    expect(corps).toMatch(/className="worldmap-btn skin-tole"\s*\n\s*data-ton="laiton"/);
    // EXHAUSTIF : le seul composant du rail est le tiroir (l'`Icon` est celle du bouton de dossier).
    expect(corps.match(/<[A-Z][A-Za-z]*/g)).toEqual(['<Icon', '<LogDrawer']);
  });

  it('hors combat, le tiroir-journal est passé au PONT d’exploration (slot `journal`)', () => {
    const campaignView = src('./CampaignView.tsx');
    const dock = campaignView.slice(campaignView.indexOf('<ExplorationDock'));
    expect(dock.slice(0, dock.indexOf('/>'))).toContain('journal={<LogDrawer');
  });
});
