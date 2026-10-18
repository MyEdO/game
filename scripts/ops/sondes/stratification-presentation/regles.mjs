// RÈGLES DE RANGEMENT de la stratification de la présentation (#2792) : DONNÉES, lues par
// `stratifier.mjs` (`ranger`) et par `sonde.mjs`.
//
// `CATEGORIES` : les quatre catégories du ticket #2792, libellé et colonne « Un moteur tiers la
// remplace ? » verbatim du tableau « À produire ».
//
// `REGLES` : liste ORDONNÉE — la PREMIÈRE règle dont le `motif` correspond au chemin (relatif POSIX à
// la racine du dépôt) gagne. `categorie` est un id de `CATEGORIES`, ou `'douteux'` : le fichier est
// alors mesuré à part, sous sa `famille`, jamais forcé dans une catégorie. `raison` dit pourquoi,
// `preuve` cite les `fichier:ligne` qui l'établissent. Ajouter une règle = ajouter une ligne ici, à
// son rang.

/** @typedef {'moteur-generique' | 'interface-wfrp' | 'orchestration-regles' | 'outillage'} IdCategorie */
/** @typedef {{ motif: RegExp, categorie: IdCategorie | 'douteux', famille?: string, raison: string, preuve: string }} Regle */

/** @type {ReadonlyArray<Readonly<{ id: IdCategorie, libelle: string, remplace: string }>>} */
export const CATEGORIES = Object.freeze([
  Object.freeze({ id: 'moteur-generique', libelle: 'Moteur de jeu générique', remplace: 'oui' }),
  Object.freeze({ id: 'interface-wfrp', libelle: 'Interface de règles WFRP', remplace: 'non (réécrite dans le moteur cible)' }),
  Object.freeze({ id: 'orchestration-regles', libelle: 'Orchestration de règles', remplace: 'non (reste en TypeScript à côté de `src/engine`)' }),
  Object.freeze({ id: 'outillage', libelle: 'Outillage', remplace: "à trancher par l'épique" }),
])

/** @type {ReadonlyArray<Readonly<Regle>>} */
export const REGLES = Object.freeze([
  {
    motif: new RegExp(String.raw`^src/(state|ui|gameIso)/(.*/)?[^/]*(-guard|-ratchet|-lint)\.test\.tsx?$|^src/gameIso/(renderer-no-hardcoded-color|rig/composition-rig-garde|rig/parts/monster/rig-part-views|rig/parts/tenues/(palette-literal|part-view-format))\.test\.ts$|^src/state/(frontiere-state-gameiso|netownership-import-isole|rollflow-no-drift|pilote-cascade)\.test\.ts$|^src/ui/(component-conformance|atelier-conformance|css-valeur-en-test|no-emoji-affordance|no-phantom-icon|placeholder-charte|prose-sites|rule-action-wiring|roll-row-styles|tab-systems|ui-ratchets|noms-accessibles-uniques|console-no-title-only|editor/no-datalist|compendium/no-json-fields)\.test\.tsx?$|^src/(gameIso/backends/webgl/(materiau-plan-transparent|mutateurs-signales)|gameIso/builders/matieres-en-donnee|gameIso/stage/anim-css-branchee|state/(combat-event-emission-coverage|condition-event-counter|guest-surface-class)|ui/(echap-couture-unique|raccourcis-registre))\.test\.ts$`),
    categorie: 'outillage',
    raison: 'Gardes de dépôt (garde structurelle, cliquet à stock, lint de source) : outillage de développement dans les trois zones, quel que soit le code gardé.',
    preuve: 'src/state/frontiere-state-gameiso.test.ts:2 (« garde STRUCTURELLE ») ; src/state/pilote-cascade.test.ts:2 (« garde de cliquet ») ; src/gameIso/rig/parts/tenues/palette-literal.test.ts:2 ; src/gameIso/rig/composition-rig-garde.test.ts:2 (« GARDE ») ; src/ui/ui-ratchets.test.ts ; src/ui/echap-couture-unique.test.ts:2 (« GARDE DÉCROISSANTE ») ; src/state/guest-surface-class.test.ts:2 (« GARDE DE CLASSE »)',
  },
  {
    motif: new RegExp(String.raw`^src/(state|ui|gameIso)/(.*/)?[^/]*(\.testkit|\.fixture|\.bench|TestKit)\.tsx?$|^src/gameIso/stage/banc-volumique(\.test)?\.ts$`),
    categorie: 'outillage',
    raison: 'Soutien de test PARTAGÉ (kits, fixtures, bancs de mesure, harnais de banc) : servi à plusieurs sujets de plusieurs zones, outillage de développement ; les tests eux-mêmes suivent leur sujet.',
    preuve: 'src/state/pieces.fixture.ts (importé par 8 tests de src/gameIso/stage) ; src/state/sceneEdit.testkit.ts (tests de state, gameIso/builders, ui/editor) ; src/gameIso/stage/banc-volumique.ts:2 (« importé UNIQUEMENT par des fichiers .test. ») ; src/gameIso/stage/versionDataset.bench.ts:2 (« BANC »)',
  },
  {
    motif: new RegExp(String.raw`^src/state/(devtools|devtoolsTimers|scenarioFlow|editorAutosave|editeurBridge|projectLibrary|mapQC|planDefects|validateScene)(\.|-)`),
    categorie: 'outillage',
    raison: 'devtools/__wfrp, lancement de scénario de test, outils d\'éditeur (autosave, pont clavier, bibliothèque de projets), QC de carte, validation de scène pour l\'éditeur',
    preuve: 'src/state/scenarioFlow.ts:1-4 ; src/state/editorAutosave.ts:1-5 ; src/state/planDefects.ts:1-6 ; src/state/mapQC.ts:2 (« Harnais QC de cartes »)',
  },
  {
    motif: new RegExp(String.raw`^src/state/(documentDeProjet|parseProject-porte)\.test\.`),
    categorie: 'outillage',
    raison: 'Tests de la porte de projet de l\'éditeur.',
    preuve: 'noms ; src/state/projectLibrary.ts (parseProject)',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/rig/qc-contrat(\.test)?\.ts$`),
    categorie: 'outillage',
    raison: 'Contrat du harnais de mesure QC de volume (scripts/qc), module pur d\'outillage.',
    preuve: 'src/gameIso/rig/qc-contrat.ts:1-4',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/stage/(DebugOverlay|pickProbe)\.`),
    categorie: 'outillage',
    raison: 'Sonde et overlay de recette/debug (__wfrp.labels, sonde de picking sans clic), pas du jeu.',
    preuve: 'src/gameIso/stage/DebugOverlay.tsx:2 ; src/gameIso/stage/pickProbe.ts:2',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/catalog/planche-qc-`),
    categorie: 'outillage',
    raison: 'Contrats de la planche QC du mobilier (instrument de QC, galeries QC).',
    preuve: 'src/gameIso/catalog/planche-qc-cuisson.test.ts:2 (« PLANCHE QC ») ; src/gameIso/catalog/planche-qc-cap-identite.test.ts:2',
  },
  {
    motif: new RegExp(String.raw`^src/ui/(errorCollector|ErrorCollectorBanner|SceneErrorBoundary|TestScenariosScreen)[.-]`),
    categorie: 'outillage',
    raison: 'Collecte d\'erreurs DEV et écran de scénarios de test.',
    preuve: 'src/ui/errorCollector.ts imports ../../package.json ; src/ui/App.tsx importe TestScenariosScreen',
  },
  {
    motif: new RegExp(String.raw`^src/state/(asciiMap|mapSpec|mapSpec-seating|sceneToAscii|sceneEdit|stairFlight|encounterAuthoring|entityId|traceLayer|traceCalibration)(\.test)?\.tsx?$`),
    categorie: 'moteur-generique',
    raison: 'Authoring de carte (exemple du ticket pour moteur-generique) : ASCII <-> Scene, compilateur MapSpec, mutations pures de Scene, volée d\'escalier, génération d\'id, calque de décalque de l\'éditeur.',
    preuve: 'src/state/mapSpec.ts:1-8 ; src/state/sceneToAscii.ts:1-6 ; src/state/sceneEdit.ts:1-4 ; src/state/traceLayer.ts:5 (« aide d\'AUTHORING »)',
  },
  {
    motif: new RegExp(String.raw`^src/ui/editor/(EditorCanvas|Palette|TraceLayerPanel|editorLayers|lowerLayerGabarit|lampMarker|propDefaults|useEditorView|editorState|editor-layers|editor-stair-flight|editor-walls-height|palette-empreinte|traceLayer-export-safety|editeur-monde-volumique|editor-monde-sous-filet)[.-]`),
    categorie: 'moteur-generique',
    raison: 'Authoring de carte isométrique (canvas, palette, calques, vue, calque de décalque) : même classe que src/state/mapSpec et src/gameIso/authoring, que l\'éditeur du moteur tiers remplace (exemple « authoring de carte » du ticket).',
    preuve: 'src/ui/editor/EditorCanvas.tsx:3-7 (« Canvas SVG iso de l\'éditeur ») ; imports ../../gameIso/authoring/floorsSvg, ../../state/sceneEdit',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/authoring/`),
    categorie: 'moteur-generique',
    raison: 'Peintres SVG d\'authoring de carte (murs, sols, toits, details).',
    preuve: 'src/gameIso/authoring/project.ts:2 ; src/gameIso/authoring/wallsSvg.ts:2',
  },
  {
    motif: new RegExp(String.raw`^src/state/(keybindings|keybindingsPrefs|round-start-keybind|dismissStack|resoudreEchap)(\.|-)|^src/ui/(useDismissLayer|useGameKeyboard|useGamepad)[.-]|^src/ui/(echap-|dialogue-touches|wrap-keyboard-vs-cursor|marche-tenue-clavier|raccourcis-)`),
    categorie: 'interface-wfrp',
    raison: 'Saisie clavier/manette et pile d\'Échap : la table d\'actions et l\'échelle d\'Échap (intent-cancel → toggle-menu) sont propres à WFRP, même classe que l\'état d\'affichage/saisie propre à WFRP (modalArbiter, hotbarBridge, combatCursor) ; les deux côtés (state, ui) forment une seule classe. Les gardes echap-couture-unique et raccourcis-registre sont prises avant, par la règle des gardes.',
    preuve: 'src/state/keybindings.ts:308-409 ; src/state/resoudreEchap.ts:1-11 (pile puis « ÉCHELLE MÉTIER du registre ») ; src/ui/useGamepad.ts:1-4 (dispatche runBindingById) ; src/ui/useDismissLayer.ts imports ../state/resoudreEchap',
  },
  {
    motif: new RegExp(String.raw`^src/state/(vision|visionState)(\.|-)`),
    categorie: 'orchestration-regles',
    raison: 'Brouillard de guerre : moteur pur de visibilité et de champ de lumière couplé à Scene, lu par les règles (découverte de porte secrète, combatFlow) ; même classe que lineOfSight.ts.',
    preuve: 'src/state/vision.ts:2 ; src/state/visionState.ts:1-15',
  },
  {
    motif: new RegExp(String.raw`^src/state/(rooms|roomPortals)(\.|-)`),
    categorie: 'moteur-generique',
    raison: 'Pièces : zone intérieure authorée et ses portails, requête spatiale lue par l\'état et par le rendu ; même classe que path.ts.',
    preuve: 'src/state/rooms.ts:1-16',
  },
  {
    motif: new RegExp(String.raw`^src/state/(stageYaw|stagePan|stageWalk|stageGestes|lacet-libre)(\.|-)`),
    categorie: 'moteur-generique',
    raison: 'gestes vivants de la caméra du stage (lacet, panoramique, marche tenue) hors store et hors partie',
    preuve: 'src/state/stagePan.ts:1-8 ; src/state/stageGestes.ts:1-6',
  },
  {
    motif: new RegExp(String.raw`^src/state/(path|path-[a-z-]+|dir8|sceneMemo|relief|wallIndex|decorIndex|bus|visibility|viewLevel|entreeEnScene)(\.test)?\.tsx?$`),
    categorie: 'moteur-generique',
    raison: 'Pathfinding sur grille, orientation 8 directions, mémoïsation de scène, relief, index spatiaux, bus d\'évènements ; politique de visibilité et étage affiché consommés par les seuls rendus ; rendez-vous de fin de cuisson du monde.',
    preuve: 'src/state/path.ts:1-5 ; src/state/visibility.ts:2 (importeurs : gameIso/backends, gameIso/catalog seulement) ; src/state/viewLevel.ts:2 (importeurs : gameIso/stage ×3, devtools) ; src/state/entreeEnScene.ts:2-6 (importeurs : gameIso/stage/GameStage3D, devtools)',
  },
  {
    motif: new RegExp(String.raw`^src/state/(refusVisible|registreOffres|offreRendue|offresUtilisables|recapLine|fixedDieMark|dialogueLibelle|dialogueHistory|identites|hotbarBridge|localIntent|modalArbiter|mapHover|codexFocus|combatCursor|preferences|dispositionConsole|revealStep)(\.|-)`),
    categorie: 'interface-wfrp',
    raison: 'État d\'affichage/saisie propre à WFRP : pastilles d\'offres, refus visible, arbitre de modales et carte inerte sous modale, curseur de combat, intention locale, pont console, libellés de dialogue, préférences.',
    preuve: 'src/state/offreRendue.ts:1-4 ; src/state/modalArbiter.ts:1-6 ; src/state/mapHover.ts:1-13 (modalHolds) ; src/state/hotbarBridge.ts:1-5',
  },
  {
    motif: new RegExp(String.raw`^src/state/`),
    categorie: 'orchestration-regles',
    raison: 'défaut dossier : store, combatFlow, rollFlowFactory/Specs, rollSeam, upkeep, flux de voyage/mer/auberge/port, IA, sorts, spawn, scène (schéma) et leurs tests de règles ; dériveurs d\'actions offertes (usable, aretes, gesteDArete) lus par l\'exécuteur.',
    preuve: 'src/state/store.ts (45 refs engine) ; src/state/combatFlow.ts (88) ; src/state/rollFlowSpecs.ts (23) ; src/state/usable.ts:2 (importé par store.ts, combatSlice.ts, sceneRules.ts) ; src/state/gesteDArete.ts:2-4 (« Lu par l\'ACTION … et par l\'AFFICHAGE »)',
  },
  {
    motif: new RegExp(String.raw`^src/ui/(icons|backdrops)/|^src/ui/(Ornaments|WaxSeal|GlobalSvgDefs)[.-]`),
    categorie: 'douteux',
    famille: 'contenu-art',
    raison: 'Contenu d\'art (defs SVG d\'icônes, décors, fleurons et sceau dessinés main) : à refaire dans le format d\'asset du moteur, ni mécanisme ni règle ; même classe que les defs de src/gameIso.',
    preuve: 'src/ui/icons/index.ts:1 ; src/ui/Ornaments.tsx:1 ; src/ui/WaxSeal.tsx:1',
  },
  {
    motif: new RegExp(String.raw`^src/ui/(Cadre|Planche|Band)[.-]|^src/ui/planche\.test`),
    categorie: 'moteur-generique',
    raison: 'Cadres sans notion WFRP (aucun import engine/data) : mécanisme de Panel/Container du moteur, même classe que Layout.',
    preuve: 'src/ui/Cadre.tsx:1-2 ; src/ui/Planche.tsx:1-2',
  },
  {
    motif: new RegExp(String.raw`^src/ui/ModalSubject[.-]`),
    categorie: 'interface-wfrp',
    raison: 'Bandeau sujet de modale : portrait du combattant (engine/types Combatant).',
    preuve: 'src/ui/ModalSubject.tsx:1-4',
  },
  {
    motif: new RegExp(String.raw`^src/ui/(Modal|ScreenShell|ParchmentCard)[.-]|^src/ui/modal-shell-non-jet\.test`),
    categorie: 'douteux',
    famille: 'cadre-fenetre',
    raison: 'Modale, coquille d\'écran et carte parchemin : Window/Popup/Panel de moteur fournissent le mécanisme, mais leur squelette est lié à WFRP (bandeau sujet-combattant, engine/types, monnaie, narratif de campagne).',
    preuve: 'src/ui/Modal.tsx:1 imports ../engine/types, ./ModalSubject ; src/ui/ScreenShell.tsx imports ../engine/money, ../state/campaignNarratif',
  },
  {
    motif: new RegExp(String.raw`^src/ui/compendium/CodexRef[.-]|^src/ui/styles/codex-ref\.css$`),
    categorie: 'interface-wfrp',
    raison: 'Affordance de règle en jeu (référence Codex cliquable dans les jets, fiches, Prose), et sa feuille.',
    preuve: 'src/ui/ChanceButtons.tsx:2 ; 32 importeurs de CodexRef hors compendium (tests exclus)',
  },
  {
    motif: new RegExp(String.raw`^src/ui/compendium/(registry|relations)[.-]`),
    categorie: 'douteux',
    famille: 'codex-en-jeu',
    raison: 'Compendium=outillage, mais ces deux modules servent aussi en jeu (liage Codex dans Prose) : deux catégories tiennent.',
    preuve: 'src/ui/Prose.tsx imports ./compendium/relations',
  },
  {
    motif: new RegExp(String.raw`^src/ui/styles/(base|components|layout|tabs|frames|modal|cadre|ornaments|band|infobulle|boite-ancree|screen-shell|planche|gauges|media-select)\.css$|^src/ui/styles\.css$`),
    categorie: 'douteux',
    famille: 'theme-visuel',
    raison: 'Feuilles de thème (tokens, primitives, cadres) : un Theme de moteur remplace le mécanisme CSS, mais la matière visuelle est à reconstruire.',
    preuve: 'src/ui/styles.css, src/ui/styles/layout.css (matière de Layout.tsx:1-4)',
  },
  {
    motif: new RegExp(String.raw`^src/ui/styles/(editor|compendium|codex-edit|gallery|error-boundary)\.css$`),
    categorie: 'outillage',
    raison: 'Feuilles de l\'atelier, du Compendium, de la galerie et du collecteur d\'erreurs.',
    preuve: 'src/ui/gallery/registry.tsx:1-3 ; src/ui/ErrorCollectorBanner.tsx imports ./errorCollector',
  },
  {
    motif: new RegExp(String.raw`^src/ui/(editor|compendium|gallery)/`),
    categorie: 'outillage',
    raison: 'Atelier de scène/campagne, Compendium et galerie du design system : outils d\'édition et de développement.',
    preuve: 'src/ui/gallery/registry.tsx:1-3 ; src/ui/editor/Editor.tsx ; src/ui/compendium/CompendiumScreen.tsx',
  },
  {
    motif: new RegExp(String.raw`^src/ui/(Icon|SceneBackdrop|Layout|Tabs|TabbedEntry|BoiteAncree|Infobulle|QtyStepper|NumberField|PlageField|ListRow|MediaSelect|NotchGauge|LifeBar|PlaqueRow|MasterDetail|SearchFilterField|MapCanvas|rovingFocus|focus|useLongPress|pointerCaps|useRamenerEnVue|worldMapViewport|persistedAtom|useClesDeRangees)[.-]|^src/ui/(MapCanvas-pinch-race|MasterDetail-hauteur|MasterDetail-scroll-edge)`),
    categorie: 'moteur-generique',
    raison: 'Widget/mécanisme sans notion WFRP, que Control/Container/Tooltip/Popup/SpinBox/Camera2D/InputMap du moteur fournissent (aucun import engine/data). Icon et SceneBackdrop : rendu d\'un fragment d\'image par id avec repli (TextureRect).',
    preuve: 'src/ui/Layout.tsx:1-4 (Stack/Row/Grid/Split) ; src/ui/MapCanvas.tsx:1-6 (pan/zoom/pinch) ; src/ui/BoiteAncree.tsx:1-5 ; src/ui/rovingFocus.ts:1-5 ; src/ui/Icon.tsx:4-7 ; src/ui/SceneBackdrop.tsx:4-8',
  },
  {
    motif: new RegExp(String.raw`^src/ui/styles/(.*)\.css$`),
    categorie: 'interface-wfrp',
    raison: 'Feuille propre à un écran ou composant WFRP (jet, fiche, créateur, combat, voyage…).',
    preuve: 'src/ui/styles/roll-shell.css ; src/ui/styles/hero-sheet.css',
  },
  {
    motif: new RegExp(String.raw`^src/ui/creator/`),
    categorie: 'interface-wfrp',
    raison: 'Assistant de création de personnage WFRP (draft, étapes, roue céleste).',
    preuve: 'src/ui/creator/draft.ts imports engine/adresseDeCreation, careerSlots',
  },
  {
    motif: new RegExp(String.raw`^src/ui/jetProps/`),
    categorie: 'interface-wfrp',
    raison: 'Hooks qui composent les props des modales de jet à partir du store et du moteur.',
    preuve: 'src/ui/jetProps/useAttackJetProps.tsx imports ../RollLine, ../../state/rollFlowSpecs',
  },
  {
    motif: new RegExp(String.raw`^src/ui/[^/]+\.(ts|tsx)$`),
    categorie: 'interface-wfrp',
    raison: 'Écran, modale, panneau ou vue-modèle de présentation WFRP (RollShell, OptionChooser, fiche, jets, voyage, marchand…) et ses tests.',
    preuve: 'src/ui/RollShell.tsx ; src/ui/OptionChooser.tsx ; src/ui/buildParticipantRows.tsx imports engine/crewMorale',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/stage/(AimOverlay|Telegraphs|ZdeTemplate|CrewTooltip|PastilleEntite|PlaquesDeNom|MoveOverlays|AreteOverlay|TokenChromeOverlay|movePreview|highlightLayer|SansWebgl|useHoverTargeting)\.|^src/gameIso/stage/(pastille-entite|plaque-nom)\.css$|^src/gameIso/stage/(pastille-entite|plaques-de-nom|chrome-jeton|apercu-cout-du-geste|sans-webgl-message)[.-]`),
    categorie: 'interface-wfrp',
    raison: 'Overlays React de jeu propres a WFRP (ciblage, gabarit de zone LDB 47, telegraphes IA, pastille de geste, plaques de nom, chrome PV/etats, surbrillance de combat, message sans WebGL). Ciblage au survol (réticule, carte de jet du faisable, grisage hors LdV), même classe que src/state/combatCursor.',
    preuve: 'src/gameIso/stage/ZdeTemplate.tsx:2 (LDB 47) ; src/gameIso/stage/AimOverlay.tsx:2 ; src/gameIso/stage/PastilleEntite.tsx:2 ; src/gameIso/stage/useHoverTargeting.ts:2-6',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/stage/`),
    categorie: 'moteur-generique',
    raison: 'Monde volumique three.js, camera, projection, picking, pointeur, lumieres, billboards, boucle de frames, bancs de test de rendu.',
    preuve: 'src/gameIso/stage/GameStage3D.tsx:2 (import three) ; src/gameIso/stage/projection.ts:2 ; src/gameIso/stage/pickResolve.ts:2',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/backends/`),
    categorie: 'moteur-generique',
    raison: 'Backend de rendu three.js (maillages, atlas, instancing, raycast, meteo, textures).',
    preuve: 'src/gameIso/backends/webgl/ (66 fichiers) ; src/gameIso/backends/webgl/instancePools.ts',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/builders/`),
    categorie: 'moteur-generique',
    raison: 'Geometrie PURE de scene (murs, toits, sols, props, jetons), camera-free.',
    preuve: 'src/gameIso/stage/layers.tsx:2 (builders/walls camera-free) ; src/gameIso/builders/walls.ts',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/detail/`),
    categorie: 'moteur-generique',
    raison: 'Expansion PURE de recettes de detail de surface (appareillage, bardeaux) en primitives UV.',
    preuve: 'src/gameIso/detail/expand.ts:2 ; src/gameIso/detail/courses.ts:2',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/pov/`),
    categorie: 'moteur-generique',
    raison: 'Caméra première personne pure, billboards et voiles d\'écran d\'ambiance.',
    preuve: 'src/gameIso/pov/camera.ts:2 ; src/gameIso/pov/SurcouchePov.tsx:2',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/fx/(FxLayer\.tsx|useCombatFx\.ts|conditionFloats\.test\.ts)$`),
    categorie: 'interface-wfrp',
    raison: 'Flottants typés, icones d\'etats et halos d\'incantation de combat WFRP pilotes par le bus.',
    preuve: 'src/gameIso/fx/useCombatFx.ts:2 ; src/gameIso/fx/FxLayer.tsx:2',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/fx/`),
    categorie: 'moteur-generique',
    raison: 'Pistes d\'animation d\'acteur et courbe de marche (animation generique).',
    preuve: 'src/gameIso/fx/walkPose.ts:2 ; src/gameIso/fx/animTracks.ts:2',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/catalog/(decor|facades)/(.*defs/|_registry\.generated|index\.ts$)`),
    categorie: 'douteux',
    famille: 'contenu-art',
    raison: 'CONTENU d\'art SVG des décors et façades, et leur registre id → def (même classe que src/ui/icons/index.ts et src/gameIso/rig/parts/*/index.ts).',
    preuve: 'src/gameIso/catalog/decor/defs/chaise.ts:1-20 ; src/gameIso/catalog/decor/index.ts:2 (« DÉRIVÉ du registre defs/ »)',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/catalog/`),
    categorie: 'moteur-generique',
    raison: 'Resolution de catalogues de rendu (terrain, ambiance, materiaux, repli visible) et leurs tests.',
    preuve: 'src/gameIso/catalog/ambiance.ts:1-5 ; src/gameIso/catalog/missing.ts:1',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/rig/.*/defs/`),
    categorie: 'douteux',
    famille: 'contenu-art',
    raison: 'CONTENU d\'art vectoriel (creatures, tenues, coiffures, armes, navires, engins, gabarits...) que le moteur ne fournit pas.',
    preuve: 'src/gameIso/rig/creatures/defs/Cheval.ts:1-15 ; src/gameIso/rig/ship/defs/caraque.ts:1-10',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/rig/(creatures|parts/(appendages|armour|bodies|capes|elements|eyes|hairstyles|heads|monster|prosthesis|shields|tenues|weapons|wings))/`),
    categorie: 'douteux',
    famille: 'contenu-art',
    raison: 'Index/types/tests du CONTENU d\'art (registres de creatures, kits de parts) et golden masters de rendu : le moteur ne les fournit pas.',
    preuve: 'src/gameIso/rig/creatures/defs/Cheval.ts:1 ; src/gameIso/rig/golden/biped-golden.test.ts:1-12',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/rig/quadruped/(heads|manes|tails|harnais)/|^src/gameIso/rig/quadruped/(boeufCompile|chevalCompile|partArt|quadParts)\.ts$`),
    categorie: 'douteux',
    famille: 'contenu-art',
    raison: 'Kits d\'art de quadrupedes (tetes, cranieres, queues, harnais) et dessins compiles.',
    preuve: 'src/gameIso/rig/creatures/defs/Cheval.ts:7-10',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/rig/(races|plans)/|^src/gameIso/rig/gabarits/`),
    categorie: 'douteux',
    famille: 'contenu-art',
    raison: 'Registres de races/gabarits/plans (donnees WFRP de morphologie) : ni fourni par un moteur ni UI.',
    preuve: 'src/gameIso/rig/races/index.ts:3 ; src/gameIso/rig/bodyPlan.ts:1-8',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/rig/(engin|land|ship|swarm)/`),
    categorie: 'douteux',
    famille: 'contenu-art',
    raison: 'Composeurs + artkits dedies a des familles d\'art WFRP (navires, engins de siege, chariots, nuees).',
    preuve: 'src/gameIso/rig/ship/defs/caraque.ts:9-10',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/rig/parts/(career|equipment|combatantVisuals|injuries|traitVisuals|cosmetic|monstrous|weaponForms|tirageIndividuel|dorsal)\.|^src/gameIso/rig/(appearance|enemyProfile)\.ts$|^src/gameIso/rig/(enemyProfile|enemyRender|tirage-individuel|palettes-declarees|plan-species-vocabulaire|siege-rig-resolution).*\.test\.tsx?$`),
    categorie: 'interface-wfrp',
    raison: 'Colle propre a WFRP : etat de Combatant / carriere / blessures / traits / equipement -> apparence a rendre.',
    preuve: 'src/gameIso/rig/parts/combatantVisuals.ts:1-10 ; src/gameIso/rig/enemyProfile.ts:1-8 ; src/gameIso/rig/appearance.ts:1-5',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/rig/`),
    categorie: 'moteur-generique',
    raison: 'Runtime de rig/squelette/animation : os, cinematique, poses, facing, composite par os, composeurs, palette, clips.',
    preuve: 'src/gameIso/rig/kinematics.ts:1-14 ; src/gameIso/rig/composite.ts:1-12 ; src/gameIso/rig/anim/tween.ts',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/(TargetReticle|TokenChromeMarks|TopoScene|SurcoucheIso)\.|^src/gameIso/(combatNarration|effectIcons|groundPose|highlightTints|teamColors|sizeScale|topoMarkers)\.|^src/gameIso/(reticule-teinte|token-chrome-alveoles|TopoScene)[.-]|^src/gameIso/toise\.test\.ts$`),
    categorie: 'interface-wfrp',
    raison: 'Affichage propre aux regles WFRP : reticule de ciblage, chrome PV/etats, narration de combat, icones d\'etats, teintes d\'arene, couleurs d\'equipe, echelle par Taille LDB 85, minimap de stations, surcouche d\'interaction du plateau.',
    preuve: 'src/gameIso/sizeScale.ts:2 (LDB 85) ; src/gameIso/TokenChromeMarks.tsx:2 ; src/gameIso/effectIcons.ts:2 ; src/gameIso/SurcoucheIso.tsx:2',
  },
  {
    motif: new RegExp(String.raw`^src/gameIso/[^/]+$`),
    categorie: 'moteur-generique',
    raison: 'Jetons rig, sprites SVG, ombrage, conversion iso, viewport, animations de plan : rendu et animation generiques.',
    preuve: 'src/gameIso/RigToken.tsx:2 ; src/gameIso/shade.ts:2 ; src/gameIso/iso.ts:2',
  },
].map((r) => Object.freeze(r)))
