# Primitives partagées — généré

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-primitives.mjs` (`npm run docs:primitives`) — NE PAS ÉDITER À LA MAIN.
> Source UNIQUE : `src/data/primitives.manifest.json`. Une primitive s'y déclare, ce doc et la matrice d'adoption de
> `docs/systemes.md` en dérivent.

Source UNIQUE des motifs récurrents. **Avant d'écrire un composant, un module, un mot-clef d'op —
et à chaque `Write` sous `src/` — chercher ici, puis greper 2-3 variantes du concept.** On
RÉUTILISE ou on ÉTEND la primitive (général + paramétrable) ; chaque option/bouton nouveau se pose
DANS la primitive, jamais dans une Nᵉ copie. Le hook `scripts/hooks/new-src-file-guard.mjs` le
rappelle au geste : un `.tsx` neuf de `src/ui`/`src/gameIso` est soit une primitive déclarée ici,
soit un écran inscrit à `scripts/hooks/ecrans-ui.json`.

Colonnes : **Besoin** = le motif · **Primitive** = le ou les symboles exportés · **Fichier** = la
source unique · **Périmètre** = où elle est composée · **Verrou** = la garde ou la clause qui la
tient (`—` : aucune garde mécanique, la revue seule).

62 primitives.

| Besoin | Primitive | Fichier | Périmètre | Verrou |
|---|---|---|---|---|
| panneau d’activité ou de service : en-tête, corps défilable, pied fixe (pré-jet, coût, action) | `ActivityPane` | `src/ui/ActivityPane.tsx` | interlude, hub de cité | réflexe avant tout volet en-tête/corps/pied recodé |
| combattant par id — combat-ou-groupe vs en-combat-seulement | `actorIn/inBattleId` | `src/state/combatants.ts` | toute résolution d'acteur | in-battle-find-guard.test.ts |
| tout effet mécanique (soin/état/dégâts/corruption/octroi) | `applyOps/GameOp` | `src/engine/ops.ts` | toute conséquence appliquée à une cible | applyOps unique (aucun effet ad hoc) |
| bande titrée de rubrique : titre, compteur ou jauge ancrés à droite, contenu dessous | `Band` | `src/ui/Band.tsx` | étapes du créateur, bandes de section du registre État de la fiche | réflexe avant tout bandeau de rubrique recodé |
| modificateurs de combat bruts (Avantage×10 + État) | `baseTestMods` | `src/engine/combat.ts` | tout Test de combat | — |
| valeur effective d'une option (base+mods plafonné) + ligne pré-jet | `optionValue/optionPending/testPending` | `src/ui/breakdown.ts` | tout affichage de composition de test avant lancer | — |
| chemin d’évolution d’une carrière en médaillons de niveau | `CareerPath` | `src/ui/CareerPath.tsx` | fiche, créateur, Codex des carrières | — |
| étapes-jets subis influençables + appliers enregistrés par kind | `cascade/registerCascadeApplier` | `src/state/cascade.ts` | toute conséquence différée en série | cascade-consequence-guard.test.ts |
| suspendre puis reprendre la cascade active quand un combat ou une transition s’ouvre en plein vol | `suspendActiveCascade/resumeSuspendedCascade` | `src/state/cascade.ts` | ouverture de combat, transition de scène, teardown de victoire ou de défaite | pile persistée de cascades suspendues, jamais un checkpoint parallèle ni une purge |
| aperçu d’un personnage en pied hors combat, rig réel | `CharacterPreview` | `src/ui/CharacterPreview.tsx` | roster, créateur, fiche, marchand | — |
| cérémonie de tirage du créateur : attente, roulant, rendu, gain de PX en direct | `CreatorDice` | `src/ui/creator/CreatorDice.tsx` | Race, Carrière, Caractéristiques, Signe astral | — |
| gabarit d’étape du créateur : bande d’action requise, zone de choix, zone de description | `CreatorStepFrame` | `src/ui/creator/CreatorStepFrame.tsx` | toutes les étapes du créateur | src/ui/creator/creator-ossature.test.tsx |
| galerie du design system in-app (DEV) : chaque primitive montée vivante avec des données réelles | `DesignGallery` | `src/ui/gallery/DesignGallery.tsx` | référence de goût des primitives d’UI | — |
| cadre de détail de l’élue : nom, chips méta, rubriques, prose scrollable | `DetailFrame` | `src/ui/DetailFrame.tsx` | créateur, pickers, Codex | — |
| cadre-figurine unique : boîte à hauteur fixe, nom et compte dessous, sceau optionnel ; variante hero = présence plein format, prop zoneBadges donnant un badge par HitLocation ancré anatomiquement (l'appelant fournit la donnée par zone, jamais la position) | `FigTile` | `src/ui/FigTile.tsx` | races, carrières, candidats, colonne aside de la fiche | seule définition des classes fig-tile (src/ui/styles/frames.css) ; AUCUNE ambiance CharacterPreview exposée (la tuile porte SA matière) ; réflexe avant tout cadre dans un cadre |
| lookup d'une table d100 par fourchette [min,max] | `findTableEntry` | `src/engine/tables.ts` | toute table à fourchettes RAW | table-lookup-guard.test.ts |
| dispatcher UNIQUE d'effet déclenché (donnée) | `fireTriggers` | `src/state/triggeredEffects.ts` | Trait/Talent/Atout/État pour un Trigger | triggered-effects.test.ts (dispatcher unique) |
| libellé d’attaque gratuite de créature, par freeKind | `FREE_ATTACK_LABEL` | `src/engine/combat.ts` | toute attaque gratuite affichée | — |
| rendu JOUEUR d’une liste de GameOp : chips codex-liées et phrase humanisée | `GameOpChips` | `src/ui/GameOpChips.tsx` | passifs d’entité, effets de signe astral | jamais le résumeur d’atelier opSummary |
| édition d'une liste de GameOp[] | `GameOpEditor` | `src/ui/editor/GameOpEditor.tsx` | sorts, effets déclenchés, passifs, consommables, activités ; repris par EffectList et FlowEditor | no-json-fields.test.ts |
| action dont l’indisponibilité porte sa raison au survol, au focus et au tap | `GatedAction` | `src/ui/GatedAction.tsx` | toute action refusable de la console et des écrans | aria-disabled et jamais disabled ; raison inline seulement sur opt-in |
| registre-par-defs auto-chargé (dépose un fichier → intégré) | `gen-registry (_registry.generated)` | `scripts/gen-registry.mjs` | tout dataset extensible (créatures, tenues, armes, sons, icônes…) | npm run gen && git diff --exit-code |
| grille de sélection en sections par famille ou classe, role listbox et roving tabindex | `GroupedPickGrid` | `src/ui/GroupedPickGrid.tsx` | tout picker groupé | — |
| corps de fiche héros : en-tête figurine, caractéristiques et dérivées, forces seuillées, chips codex | `HeroSheet` | `src/ui/HeroSheet.tsx` | résumé du créateur, écran de groupe | réflexe avant toute fiche de personnage recodée |
| rangée d'influence Chance/Pacte/Résilience/Détermination | `InfluenceRow` | `src/ui/InfluenceRow.tsx` | toute modale de jet influençable ; porte aussi ResilienceButton et DeterminationButton | — |
| icône d'OBJET (silhouette de rig arme/armure/bouclier, sinon glyphe de catégorie) | `ItemIcon` | `src/ui/ItemIcon.tsx` | sac, onglet Combat de la fiche, pickers MediaSelect, hotbar de combat | src/ui/no-emoji-affordance.test.ts |
| barre de remplissage lisse : ton par palier ou teinte continue, dépassement explicite | `LifeBar` | `src/ui/LifeBar.tsx` | vie du portrait, Blessures et Encombrement de la fiche | réflexe avant toute jauge crantée réutilisée en barre de vie : JAMAIS NotchGauge, réservée aux ressources à PALIERS DISCRETS (Coque, Moral, Soute) |
| fabrique de flux de jet + registre spec par kind | `makeRollFlow/FLOWS` | `src/state/rollFlowSpecs.ts` | tout Test interactif joueur | rollflow-no-drift.test.ts, rollFlowWiring.test.ts |
| gabarit maître-détail (liste gauche + détail centre), layout pur sans état | `MasterDetail` | `src/ui/MasterDetail.tsx` | tout écran à sélection dans une liste + détail (interlude, Codex, palettes, pickers) | — |
| sélecteur visuel (déclencheur + popover de rangées média + texte) là où un <select> natif ne peut pas porter d'icône | `MediaSelect` | `src/ui/MediaSelect.tsx` | sélecteurs d'arme/armure de la fiche, menu « Donner » | — |
| carte de menu : sections de grands boutons pleine largeur icône+libellé, séparateurs titrés, interrupteur | `MenuCard/MenuSection/MenuButton/MenuToggle` | `src/ui/MenuCard.tsx` | menu principal hors partie et menu système en jeu (Coopération, Options) | réflexe avant tout bouton ou carte de menu recodé |
| chip de statut métallisé Bronze/Argent/Or avec son échelon | `MetalStatus` | `src/ui/MetalStatus.tsx` | tout affichage de statut social | — |
| axe contrôleur (qui tient, qui pilote, qui est jouée par l'IA) et quorum des sièges requis | `ownsLocally/pilotedByHuman/aiDriven/siegesRequis` | `src/state/netOwnership.ts` | gating de siège/coop | netOwnership.test.ts |
| champ nombre : variantes complet/champ/nu, bornes optionnelles, commit à la frappe ou au geste | `NumberField` | `src/ui/NumberField.tsx` | cascade, réglages de table, atelier du Codex, quantité de marché, dé forcé | réflexe avant toute saisie de nombre brute ; cliquet (xvii) de src/ui/ui-ratchets.test.ts |
| structure de rangées d’un GameOp[] pour le Codex | `opRows` | `src/ui/compendium/opRows.ts` | vue joueur des effets et fiches du compendium | — |
| choix d'options de jet (seg/grid/actions) | `OptionChooser/ChoiceButtons` | `src/ui/OptionChooser.tsx` | tout choix d'options + paire/triplet de boutons de décision | — |
| panneau-paramètre borné ancré à son déclencheur : un clic commit et ferme, Échap annule | `PanneauParametre` | `src/ui/PanneauParametre.tsx` | munition d’une arme, localisation, objets d’une pastille, sort à dissiper | réflexe avant tout tiroir de console recodé ; jamais pour un choix exhaustif |
| carte-parchemin narrative adossée à un tirage : sceau d100, titre, ton | `ParchmentCard` | `src/ui/ParchmentCard.tsx` | interlude, événement de bord en mer, révélation de scène | réflexe avant tout parchemin à sceau recodé |
| collecteur UNIQUE de modificateur PASSIF continu | `passiveMods` | `src/engine/trauma.ts` | trait/mutation/qualité/trauma/maladie/faim/sort | collecteur unique (docs/systeme-passifs.md) |
| rangée-plaque sombre à rivets : préfixe codex, méta centrale, valeur à droite, états élu et roulant | `PlaqueRow/PlaqueGrid` | `src/ui/PlaqueRow.tsx` | registre de caractéristiques, rangées d’allocation | réflexe avant toute rangée de registre recodée |
| règle optionnelle RAW + house-rule taguée | `rule/policy` | `src/engine/policy.ts` | tout arbitrage editable | — |
| affichage d'un personnage (HUD/modale/picker) | `PortraitTile/CharFrame` | `src/ui/PortraitTile.tsx` | toute vignette de personnage | — |
| rendu de prose Markdown verbatim (HTML brut neutralisé) | `Prose` | `src/ui/Prose.tsx` | tout champ de prose RAW | no-html-in-prose.test.ts |
| stepper de quantité moins / centre / plus | `QtyStepper` | `src/ui/QtyStepper.tsx` | panier, quantité en stock, baisse de prix par cran | — |
| rangée de ready-check coop : sièges requis seuls, siège nommé, état prêt/attendu | `ReadyRow` | `src/ui/ReadyRow.tsx` | pause de Round, écran de Victoire, nuit de repos | quorum = siegesRequis (src/state/netOwnership.ts), source unique |
| picker de référence multilangue-safe (par id) | `RefField` | `src/ui/compendium/RefField.tsx` | toute ref id statique du Compendium | CodexRef.test.ts |
| attaque gratuite déclenchée, kind-agnostique | `resolveFreeAttacks` | `src/state/combatFlow.ts` | toute source de Frappe réactive/Assaut féroce/Trait/État | creatureFreeAttacks.test.ts |
| résolution rendu + dispatch backend | `resolveRender/tokenBodyKind` | `src/gameIso/rig/bodyPlan.ts` | tout rendu iso/POV/portrait | eslint.config.js |
| ligne de jet d'un participant (RollShell multi) | `RollRow` | `src/ui/RollRow.tsx` | toute modale de jet multi-contributeurs | — |
| surface DÉRIVÉE des porteurs : tenue × cadence × ordres de traversée → Modale/Visible-MJ/Interne, un seul site | `openRoll/resolveSurface` | `src/state/rollSeam.ts` | porte de résolution de tout Test influençable | roll-seam-exclusivity-guard.test.ts |
| coquille de jet mono/multi (Lancer→Chance→Pacte→Résilience→Appliquer) | `RollShell` | `src/ui/RollShell.tsx` | toute modale de jet, mono (N=1) et multi (N contributeurs) | roll-modal-invariant.test.ts |
| rose des forces : mini-radar gravé à N axes paramétrables | `RoseAxes` | `src/ui/RoseAxes.tsx` | glyphe de figurine, médaillon, rendu plein | axes calculés par axisScore et axesProfile (src/engine/axes.ts) |
| navigation clavier flèches + Home/End d’un groupe, fonction pure sans hook (sites HTML et SVG) | `rovingKeyDown` | `src/ui/rovingFocus.ts` | tablist, listbox, radiogroup | réflexe avant tout clavier de navigation par flèches recodé |
| méta d'en-tête date + bourse | `ScreenMeta` | `src/ui/ScreenMeta.tsx` | en-tête d'écran plein-champ et en-tête du menu système (date seule) | — |
| coquille d'écran plein-champ (voile + en-tête + corps, a11y dialogue) | `ScreenShell` | `src/ui/ScreenShell.tsx` | carte du monde, port/escale, marché, dossier de navire, négoce | aucune modale/écran bespoke (existant) |
| champ de filtre/recherche de liste : le widget, avec useFilteredList (état) et filterByLabel (pur) | `SearchFilterField` | `src/ui/SearchFilterField.tsx` | catalogue, palette, sélecteur | — |
| dégâts/soin de coque, source unique de state.vessel.wounds | `damageHull/healHull/damageVesselHull/healVesselHull` | `src/state/shipDamage.ts` | voyage fluvial/maritime + combat naval | vessel-wounds-write-guard.test.ts |
| onglets (flat/pill/sub/dock) : role tablist, aria-selected, roving tabindex | `Tabs` | `src/ui/Tabs.tsx` | fiche, écran plein-champ, dock repliable, sous-onglets ; styles src/ui/styles/tabs.css | réflexe avant toute liste d’onglets recodée |
| table de négoce : colonnes de stats, prix, action par rangée, groupes de rubrique | `TradeTable` | `src/ui/TradeTable.tsx` | marchand, port, marché terrestre | réflexe avant tout tableau d’achat/vente recodé |
| appui long 450 ms tactile et souris, geste secondaire d’une alvéole | `useLongPress` | `src/ui/useLongPress.ts` | alvéoles de la console de combat | réflexe avant tout minuteur de pression recodé |
| en-tête A→B d'une modale de combat/opposition | `VsHeader` | `src/ui/VsHeader.tsx` | toute confrontation à 2 camps | — |
| sceau de cire et plaque d’élu scellée | `WaxSeal/SealedPlaque` | `src/ui/WaxSeal.tsx` | tuiles de sélection, plaques d’élu | — |
<!-- sources-empreinte: ad75b94b17143977c8d473c75ff8ee612ef4995e (5 fichiers, 0 dossiers) corps: efb09dae0f4d4882f431ad866059fa3b8cf2a3ff -->
