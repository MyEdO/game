// MARQUEURS STRUCTURELS POSSÉDÉS (#1318 P8/D10, #1920) — la table unique « classe → composant qui la
// pose ». Deux gardes la lisent : `src/ui/primitive-owners-guard.test.ts` (côté MARKUP : personne
// d'autre ne pose la classe) et `src/ui/css-modules-guard.test.ts` §5.3 (côté FEUILLE : personne
// d'autre ne la vise). Pur `.mjs` : lu par les deux sans importer un fichier de test.

/**
 * Marqueur → fichier(s) PROPRIÉTAIRE(S), chemin depuis `src/ui/`. Justification par primitive : chaque
 * classe listée est posée par le composant de la table `docs/primitives.md` et par lui seul ; la
 * recopier ailleurs, c'est refaire à la main la structure qu'il rend (en-tête/corps/pied,
 * piste+remplissage, tuile+lueur, rangée+colonnes…).
 * @type {Record<string, string[]>}
 */
export const OWNERS = {
  // ScreenShell — coquille d'écran plein-champ : voile + en-tête + barre d'outils + corps borné.
  'worldmap-overlay': ['ScreenShell.tsx'],
  'worldmap-head': ['ScreenShell.tsx'],
  'worldmap-head-actions': ['ScreenShell.tsx'],
  'screen-toolbar': ['ScreenShell.tsx'],
  'screen-colonne': ['ScreenShell.tsx'],

  // Modal — cadre de modale : voile, boîte en colonne, tête, titre, corps défilant ; le bandeau sujet
  // est son sous-composant `ModalSubject`.
  'modal-overlay': ['Modal.tsx'],
  'modal': ['Modal.tsx'],
  'modal-tete': ['Modal.tsx'],
  'modal-title': ['Modal.tsx'],
  'modal-body': ['Modal.tsx'],
  'modal-subject': ['ModalSubject.tsx'],

  // Cadre — le pied (`CadrePied`) et la croix (`CadreFermer`) des trois cadres (`Modal`,
  // `EmbeddedShell`, `ScreenShell`), qui les COMPOSENT.
  'cadre-pied': ['Cadre.tsx'],
  'cadre-fermer': ['Cadre.tsx'],

  // Planche — lecteur passif en deux colonnes (fiche, feuille de navire) : squelette et défileur unique.
  'sheet-layout': ['Planche.tsx'],
  'sheet-aside': ['Planche.tsx'],
  'sheet-main': ['Planche.tsx'],
  'sheet-tabbody': ['Planche.tsx'],

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

  // MasterDetail — gabarit de layout liste GAUCHE + détail CENTRE, composé sur `Split`/`Stack`
  // (couche LAYOUT) : la seule classe qui lui reste en propre est la géométrie de son rail.
  'master-detail-list': ['MasterDetail.tsx'],

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

  // RollShell — zone embarquée d'une étape (`EmbeddedShell`).
  'rs-embedded': ['RollShell.tsx'],

  // SearchFilterField — champ de filtre de liste.
  'search-filter': ['SearchFilterField.tsx'],
  'pal-search-row': ['SearchFilterField.tsx'],

  // ScreenMeta — méta d'en-tête date+bourse, partagée écran plein-champ / menu système.
  'hud-clock': ['ScreenMeta.tsx'],
  'port-purse': ['ScreenMeta.tsx'],
};

/**
 * Les CADRES (#1920) : `Modal` (et son bandeau `ModalSubject`), `EmbeddedShell` (RollShell.tsx) et
 * `ScreenShell`, avec leurs gestes partagés (`Cadre.tsx`). Leurs classes sont gardées des DEUX côtés, feuille comprise, PLACEMENT compris
 * (`css-modules-guard.test.ts` §5.3 étendue) : un hôte qui ré-agence un cadre le rend différent
 * d'un écran à l'autre.
 */
export const CADRES = ['Cadre.tsx', 'Modal.tsx', 'ModalSubject.tsx', 'RollShell.tsx', 'ScreenShell.tsx'];
