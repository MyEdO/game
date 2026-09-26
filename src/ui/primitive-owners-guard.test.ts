import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * Garde structurelle #1318 P8/D10 — les MARQUEURS STRUCTURELS (classes racines distinctives des
 * primitives de `docs/primitives.md`) sont la PROPRIÉTÉ du fichier de leur
 * primitive. Même patron qu'`aria-primitive-guard` (rôle → fichier propriétaire), appliqué au markup :
 * `gallery-exhaustive` garantit le SPÉCIMEN (la primitive existe et est montée), jamais l'USAGE — rien
 * ne rougissait quand un écran RECOPIAIT le markup au lieu de composer la primitive.
 *
 * COMPOSITION vs RECOPIE — seule la RECOPIE rougit : un écran qui monte `<ActivityPane>` reçoit
 * `.activity-pane*` PAR la primitive (aucune occurrence dans sa source, donc aucun hit ici) ; un écran
 * qui écrit lui-même `className="activity-pane-desc"` a recopié le markup. Un modificateur d'appelant
 * passé en prop `className` (`<Tabs className="port-tabs">`) n'est pas un marqueur.
 *
 * PORTÉE MESURÉE — 86 marqueurs, 20 fichiers propriétaires ; le scan couvre les `.tsx` de `src/ui`
 * (récursif, hors fichiers de test). Hors `src/ui`, le stock de ces marqueurs est mesuré VIDE au
 * 2026-08-16 (sonde sur tous les `.tsx` de `src` : 0 occurrence) — étendre le scan le jour où un
 * marqueur y apparaîtra.
 *
 * CALIBRAGE — seules les classes appartenant à un COMPOSANT de la table sont gatées. Les primitives
 * CSS GLOBALES de `styles.css` (`.bar`, `.panel-grid`, `.layout-sidebar`, `.btn`, `.chip`, `.seg`,
 * `.modal-actions`, textures `.tx-*` d'`ornaments.css`) sont FAITES pour être posées partout : les
 * gater serait du bruit, elles restent hors table.
 */

const UI = 'src/ui';

/** Les composants de `src/ui`, hors tests — chemin DEPUIS `src/ui/`, la forme des tables ci-dessous. */
function composants(): { chemin: string; code: string }[] {
  return readCorpus([UI], { exts: ['.tsx'] }).map(({ rel, text }) => ({
    chemin: rel.slice(UI.length + 1),
    code: text,
  }));
}

/** Une classe citée en commentaire (JSDoc de renvoi vers la primitive) n'est pas une pose de markup.
 *  Les commentaires sont blanchis (et non supprimés) pour préserver la numérotation de lignes. */
const blank = (m: string) => m.replace(/[^\n]/g, ' ');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/.*$/gm, blank);

/**
 * Marqueur → fichier(s) PROPRIÉTAIRE(S). Justification par primitive : chaque classe listée est posée
 * par le composant de la table `docs/primitives.md` et par lui seul ; la recopier ailleurs, c'est refaire à la
 * main la structure qu'il rend (en-tête/corps/pied, piste+remplissage, tuile+lueur, rangée+colonnes…).
 */
const OWNERS: Record<string, string[]> = {
  // ScreenShell — coquille d'écran plein-champ : voile + en-tête + barre d'outils + corps borné.
  'worldmap-overlay': ['ScreenShell.tsx'],
  'worldmap-head': ['ScreenShell.tsx'],
  'worldmap-head-actions': ['ScreenShell.tsx'],
  'screen-toolbar': ['ScreenShell.tsx'],
  'screen-body': ['ScreenShell.tsx'],

  // MenuCard — carte de menu (principal ET système) : en-tête, titre, pile de grands boutons.
  'menu-card': ['MenuCard.tsx'],
  'menu-card-head': ['MenuCard.tsx'],
  'menu-card-title': ['MenuCard.tsx'],
  'menu-card-meta': ['MenuCard.tsx'],
  'menu-card-sub': ['MenuCard.tsx'],
  'menu-buttons': ['MenuCard.tsx'],
  'menu-toggle': ['MenuCard.tsx'],
  'menu-link': ['MenuCard.tsx'],

  // FigTile — cadre-figurine UNIQUE (#430/#431) ; `frames.css` porte déjà « SEULE définition ».
  'fig-tile': ['FigTile.tsx'],
  'fig-row': ['FigTile.tsx'],
  'fig-tile-fig': ['FigTile.tsx'],
  'fig-tile-name': ['FigTile.tsx'],
  'fig-tile-sub': ['FigTile.tsx'],
  'fig-tile-seal': ['FigTile.tsx'],
  'fig-zone-badges': ['FigTile.tsx'],
  'fig-zone-badge': ['FigTile.tsx'],

  // PlaqueRow — rangée-plaque à rivets (préfixe/label/nom/méta/valeur) + sa grille 2 colonnes.
  'plaque-row': ['PlaqueRow.tsx'],
  'plaque-grid': ['PlaqueRow.tsx'],
  'plaque-prefix': ['PlaqueRow.tsx'],
  'plaque-label': ['PlaqueRow.tsx'],
  'plaque-name': ['PlaqueRow.tsx'],
  'plaque-meta': ['PlaqueRow.tsx'],
  'plaque-value': ['PlaqueRow.tsx'],
  'plaque-fx': ['PlaqueRow.tsx'],

  // ActivityPane — panneau d'activité : en-tête, corps DÉFILABLE, pied FIXE (pré-jet/coût/actions).
  'activity-pane': ['ActivityPane.tsx'],
  'activity-pane-head': ['ActivityPane.tsx'],
  'activity-pane-body': ['ActivityPane.tsx'],
  'activity-pane-desc': ['ActivityPane.tsx'],
  'activity-pane-blocked': ['ActivityPane.tsx'],
  'activity-pane-foot': ['ActivityPane.tsx'],
  'activity-pane-terms': ['ActivityPane.tsx'],
  'activity-pane-detail': ['ActivityPane.tsx'],
  'activity-pane-actions': ['ActivityPane.tsx'],

  // TradeTable — table de négoce (colonnes de stats + prix + action par rangée + rubriques).
  'trade-table': ['TradeTable.tsx'],
  'trade-row': ['TradeTable.tsx'],

  // ParchmentCard — carte-parchemin narrative (sceau d100 + titre + corps). NB : la TEXTURE
  // `.tx-parchment` (ornaments.css) est globale et reste hors table — seule la CARTE est gatée.
  'parchment-card': ['ParchmentCard.tsx'],
  'parchment-card-body': ['ParchmentCard.tsx'],
  'parchment-card-title': ['ParchmentCard.tsx'],
  'parchment-seal': ['ParchmentCard.tsx'],

  // Band — bande titrée de rubrique (barre bois/laiton + ancrage droit).
  'creator-band': ['Band.tsx'],
  'creator-band-head': ['Band.tsx'],
  'creator-band-right': ['Band.tsx'],

  // MasterDetail — gabarit de layout liste GAUCHE + détail CENTRE.
  'master-detail': ['MasterDetail.tsx'],
  'master-detail-list': ['MasterDetail.tsx'],
  'master-detail-detail': ['MasterDetail.tsx'],

  // Tabs — le bouton d'onglet (roving tabindex + aria-selected vivent dans la primitive).
  'tab-btn': ['Tabs.tsx'],

  // LifeBar — barre de remplissage LISSE (piste + remplissage + libellé/valeur).
  'life-bar': ['LifeBar.tsx'],
  'life-bar__track': ['LifeBar.tsx'],
  'life-bar__fill': ['LifeBar.tsx'],
  'life-bar__label': ['LifeBar.tsx'],
  'life-bar__value': ['LifeBar.tsx'],

  // QtyStepper — stepper [−][centre][+] (moissonné de MerchantPanel). `.btn-step` en est EXCLU :
  // c'est la PEAU de bouton carré 24px de la couche atomique, catalogué en propre à `docs/charte-ui.md`
  // et porté aussi par des boutons hors stepper (✕ d'une rangée de panier) ; ce qui fait la primitive,
  // c'est la STRUCTURE `.cart-step` + `.cart-n`, gatée ici.
  'cart-step': ['QtyStepper.tsx'],
  'cart-n': ['QtyStepper.tsx'],

  // GroupedPickGrid — grille de sélection en sections (listbox + roving tabindex).
  'gpg-grid': ['GroupedPickGrid.tsx'],
  'gpg-section': ['GroupedPickGrid.tsx'],
  'gpg-row': ['GroupedPickGrid.tsx'],
  'gpg-heading': ['GroupedPickGrid.tsx'],

  // DetailFrame — cadre de détail (nom + chips méta + prose scrollable).
  'detail-frame': ['DetailFrame.tsx'],
  'detail-frame-head': ['DetailFrame.tsx'],
  'detail-frame-name': ['DetailFrame.tsx'],
  'detail-frame-sub': ['DetailFrame.tsx'],
  'detail-frame-meta': ['DetailFrame.tsx'],
  'detail-frame-prose': ['DetailFrame.tsx'],

  // HeroSheet — corps de fiche héros (bande d'en-tête + caracs + dérivées).
  'hero-sheet': ['HeroSheet.tsx'],
  'hero-sheet-head': ['HeroSheet.tsx'],
  'hero-sheet-id': ['HeroSheet.tsx'],
  'hero-sheet-stats': ['HeroSheet.tsx'],
  'hero-sheet-derived': ['HeroSheet.tsx'],

  // PortraitTile — tuile de portrait (visage + jauge + caret d'activation).
  'ptile': ['PortraitTile.tsx'],
  'ptile-wrap': ['PortraitTile.tsx'],
  'ptile-face': ['PortraitTile.tsx'],
  'ptile-gauge': ['PortraitTile.tsx'],
  'ptile-caret': ['PortraitTile.tsx'],

  // CreatorStepFrame — gabarit d'étape du créateur (bande d'action / choix / desc).
  'creator-step': ['creator/CreatorStepFrame.tsx'],
  'creator-step-choice': ['creator/CreatorStepFrame.tsx'],
  'creator-step-desc': ['creator/CreatorStepFrame.tsx'],

  // RollShell — chrome de la modale de jet (rail défilant, variante encastrée).
  'rs-scroll': ['RollShell.tsx'],
  'rs-embedded': ['RollShell.tsx'],

  // SearchFilterField — champ de filtre de liste.
  'search-filter': ['SearchFilterField.tsx'],
  'pal-search-row': ['SearchFilterField.tsx'],

  // ScreenMeta — méta d'en-tête date+bourse, partagée écran plein-champ / menu système.
  'hud-clock': ['ScreenMeta.tsx'],
  'port-purse': ['ScreenMeta.tsx'],
};

/**
 * Stock hors-propriétaire : VIDE (2026-08-16). Les 12 recopies mesurées à la pose de la garde ont été
 * migrées dans la MÊME vague (V10) — sous-composants de primitive (`MenuCardHead`, `DetailIdentity`,
 * `EmbeddedShell`), slot ajouté (`ActivityPane lead`), composition directe (`MenuCard`, `ScreenMeta`,
 * `DetailFrame`) et classes propres pour les sites qui n'étaient PAS la primitive (`.cart-step-cell`,
 * `.btn-sq`, `.market-carrier`). La garde reste sans baseline : toute recopie NEUVE rougit.
 */
const BASELINE: Record<string, string[]> = {};

const MARKERS = Object.keys(OWNERS);
const STRING_LITERAL = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g;

/** Marqueurs posés en LITTÉRAL de classe (attribut ou variable de classe), avec leur ligne. */
function markersIn(src: string): { marker: string; line: number }[] {
  const out: { marker: string; line: number }[] = [];
  let m: RegExpExecArray | null;
  STRING_LITERAL.lastIndex = 0;
  while ((m = STRING_LITERAL.exec(src))) {
    const text = m[1] ?? m[2] ?? m[3] ?? '';
    if (text === '') continue;
    const line = src.slice(0, m.index).split('\n').length;
    for (const marker of MARKERS) {
      if (new RegExp(`(?<![\\w-])${marker}(?![\\w-])`).test(text)) out.push({ marker, line });
    }
  }
  return out;
}

describe('#1318 P8/D10 — marqueurs structurels = propriété des primitives (recopie de markup bloquée)', () => {
  const found = composants().map(({ chemin, code }) => ({ path: chemin, hits: markersIn(stripComments(code)) }));

  it('aucune recopie de marqueur hors du fichier propriétaire au-delà du stock mesuré', () => {
    const offenders: string[] = [];
    for (const { path, hits } of found) {
      for (const { marker, line } of hits) {
        if (OWNERS[marker].includes(path)) continue;
        if (BASELINE[path]?.includes(marker)) continue;
        offenders.push(
          `${path}:${line} → "${marker}" recopié — composer ${OWNERS[marker].join(' / ')} au lieu de réécrire son markup`,
        );
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('la baseline est DÉCROISSANTE — aucune entrée périmée', () => {
    const live = new Set(
      found.flatMap(({ path, hits }) => hits.filter((h) => !OWNERS[h.marker].includes(path)).map((h) => `${path}|${h.marker}`)),
    );
    const stale = Object.entries(BASELINE)
      .flatMap(([path, marks]) => marks.map((m) => `${path}|${m}`))
      .filter((k) => !live.has(k))
      .map((k) => `${k.replace('|', ' → ')} : recopie disparue, RETIRER l'entrée de BASELINE`);
    expect(stale, stale.join('\n')).toEqual([]);
  });

  it('chaque primitive propriétaire pose bien son marqueur (table non périmée)', () => {
    const posed = new Set(found.flatMap(({ path, hits }) => hits.map((h) => `${path}|${h.marker}`)));
    const dead = Object.entries(OWNERS)
      .filter(([marker, owners]) => !owners.some((o) => posed.has(`${o}|${marker}`)))
      .map(([marker, owners]) => `"${marker}" : plus posé par ${owners.join(' / ')} — table OWNERS à mettre à jour`);
    expect(dead, dead.join('\n')).toEqual([]);
  });
});
