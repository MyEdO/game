# Systèmes implémentés — généré (#298)

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-systemes.mjs` (`npm run docs:systemes`) — NE PAS ÉDITER À LA MAIN.
> Source éditoriale (nom/périmètre/état/ticket) : `src/data/systemes.manifest.json`. Source des primitives :
> `src/data/primitives.manifest.json`. La matrice ci-dessous est CALCULÉE du graphe d'imports réel (closure
> transitive des modules racines déclarés par système) — jamais périmée : re-générer après tout ajout.

**Périmètre mesuré / angles morts** — la closure d'import est calculée par `closureOf` (`scripts/guards/lib/importGraph.mjs`) :
parcours RÉGEX des specifiers `from '…'`/`import('…')`, RÉSOLUS s'ils sont RELATIFS (`./`, `../`) ou sous un alias
de `tsconfig.json` (`@/…`) — un paquet npm n'est jamais suivi (`resolveImport` renvoie `null`), donc invisible ici sans
que la primitive soit hors d'usage. L'inventaire « modules non rattachés » est lui-même borné : SURFACE de
`src/state`/`src/engine` uniquement (`listerDossier` non récursif, `*.test.ts` exclus) — un fichier niché dans un
sous-dossier, ou situé ailleurs (`src/ui`, `src/gameIso`, `src/data`…), n'y apparaît jamais, rattaché ou non.

## Sommaire des systèmes

| Système | État | Modules racines | Ticket |
|---|---|---|---|
| Combat (arène tactique) | complet | `src/state/combatFlow.ts`, `src/state/combatHooks.ts`, `src/state/combatSlice.ts`, `src/state/combatSetup.ts`, `src/engine/combat.ts` | — |
| Magie (incantation, sorts, mésaventures) | complet | `src/engine/magic.ts`, `src/engine/miscast.ts`, `src/engine/overcast.ts`, `src/engine/grimoire.ts`, `src/engine/dispel.ts`, `src/ui/CastModal.tsx` | — |
| Corruption & mutation | complet | `src/engine/corruption.ts`, `src/state/corruptionFlow.ts`, `src/ui/CorruptionModal.tsx` | — |
| Psychologie (P1-P4) | complet | `src/engine/psychology.ts`, `src/state/encounterPsychFlow.ts` | — |
| Voyage terrestre | partiel | `src/state/travelFlow.ts`, `src/engine/travel.ts`, `src/engine/travelStages.ts`, `src/engine/travelTables.ts`, `src/engine/travelEncounter.ts`, `src/ui/TravelRecapModal.tsx`, `src/ui/TravelRolesPanel.tsx` | #298 (openRoll TER : fourche forcedPaceDay dupliquée, travelFlow.ts:368-381) |
| Voyage fluvial | partiel | `src/state/riverVoyageFlow.ts`, `src/engine/riverNavigation.ts` | #267/#268 (asymétrie naufrage fluvial sans checkPartyWiped, riverVoyageFlow.ts:649-651) |
| Voyage maritime | partiel | `src/state/seaVoyageFlow.ts`, `src/engine/seaVoyage.ts`, `src/engine/seaNavigation.ts`, `src/engine/seaWeather.ts`, `src/engine/seaPerils.ts`, `src/ui/SeaVoyageScreen.tsx`, `src/ui/SeaActivitiesModal.tsx` | #298 (openRoll MER : scorbut/épuisement forcés inline, seaVoyageFlow.ts:900-905,968-973) |
| Combat naval tactique | partiel | `src/engine/shipBuild.ts`, `src/engine/shipCritical.ts`, `src/engine/shipMelee.ts`, `src/state/shipManeuver.ts`, `src/state/shipBattery.ts`, `src/state/shipCollision.ts`, `src/state/shipDamage.ts`, `src/state/shipPostes.ts`, `src/ui/ShipBatteryModal.tsx`, `src/ui/ShipManeuverModal.tsx`, `src/ui/ShipDossier.tsx`, `src/ui/ShipSheet.tsx` | #250, #267, #268 (Phase 8, gelé) |
| Bataille de masse / siège | complet | `src/engine/massBattle.ts`, `src/state/massBattleFlow.ts`, `src/engine/activities.ts`, `src/ui/MassBattleView.tsx` | — |
| Interlude / entre-deux | partiel | `src/state/interludeFlow.ts`, `src/engine/activities.ts`, `src/ui/InterludeScreen.tsx` | — |
| Marchand / négoce / cargaison | partiel | `src/state/merchantFlow.ts`, `src/state/portFlow.ts`, `src/state/landMarketFlow.ts`, `src/engine/bargain.ts`, `src/engine/cargo.ts`, `src/engine/landCargo.ts`, `src/ui/MerchantPanel.tsx`, `src/ui/LandMarketView.tsx`, `src/ui/PortView.tsx` | #298 (bargainPct forké portFlow.ts:126≡landMarketFlow.ts:157 ; Marchandage résolu hors modale portFlow.ts:12-14) |
| Équipage / paie / postes | complet | `src/state/shipCrew.ts`, `src/engine/crewMorale.ts`, `src/engine/warMachineCrew.ts`, `src/state/stations.ts`, `src/ui/CrewTestModal.tsx`, `src/ui/ShipRolesPanel.tsx` | — |
| Repos / survie | complet | `src/state/restFlow.ts`, `src/engine/rest.ts`, `src/engine/provisions.ts`, `src/engine/suffocation.ts`, `src/engine/exposure.ts`, `src/engine/waterExposure.ts`, `src/ui/RestModal.tsx` | — |
| Coop en ligne (relay) | complet | `src/state/netFlow.ts`, `src/state/netOwnership.ts`, `src/net/relay.ts`, `src/net/session.ts`, `src/net/intents.ts`, `src/ui/CoopLobby.tsx`, `src/ui/CoopPanels.tsx` | — |
| Éditeur de scène / campagne | complet | `src/state/sceneEdit.ts`, `src/state/validateScene.ts`, `src/state/mapSpec.ts`, `src/ui/editor/Editor.tsx` | — |
| Codex / Compendium | complet | `src/ui/compendium/CompendiumScreen.tsx` | — |

- **Combat (arène tactique)** (`combat`) : Barils combatFlow + hooks universels combatHooks.ts (docs/combat-events-coherence.md).
- **Corruption & mutation** (`corruption`) : docs/systeme-passifs.md.
- **Voyage terrestre** (`voyage-terre`) : fourche forcée d'openRoll à dédupliquer.
- **Voyage maritime** (`voyage-maritime`) : Chantier naval GELÉ (pause structurelle #276) — reprend après le programme #269-#275.
- **Combat naval tactique** (`combat-naval`) : MDG 12-14.
- **Bataille de masse / siège** (`bataille-masse`) : Activités partagées avec interlude (budget max 3 RAW commun).
- **Interlude / entre-deux** (`interlude`) : Refonte UX différée (session dédiée) — backend fini, RAW « assister coûte-t-il un créneau ? » à trancher.
- **Équipage / paie / postes** (`equipage`) : Station+AssignRow (stations.ts) — patron top-down slot+affectation.
- **Repos / survie** (`repos-survie`) : MultiRollList/NightEntry — bilan nuit.
- **Coop en ligne (relay)** (`coop`) : Worker Cloudflare (server/), axe contrôleur pilotedByHuman/aiDriven/humanControlled.
- **Éditeur de scène / campagne** (`editeur`) : Schéma de Scène unique — pas de scène codée en dur (règle stricte 2).
- **Codex / Compendium** (`codex`) : Éditable sans JSON — onglets par domaine.

## Matrice primitives × systèmes (générée)

Colonnes : `combat`=Combat (arène tactique) · `magie`=Magie (incantation, sorts, mésaventures) · `corruption`=Corruption & mutation · `psychologie`=Psychologie (P1-P4) · `voyage-terre`=Voyage terrestre · `voyage-fluvial`=Voyage fluvial · `voyage-maritime`=Voyage maritime · `combat-naval`=Combat naval tactique · `bataille-masse`=Bataille de masse / siège · `interlude`=Interlude / entre-deux · `commerce`=Marchand / négoce / cargaison · `equipage`=Équipage / paie / postes · `repos-survie`=Repos / survie · `coop`=Coop en ligne (relay) · `editeur`=Éditeur de scène / campagne · `codex`=Codex / Compendium.
Cellule = **U** (la primitive est dans la closure d'import du système) ou vide (non détectée directement —
n'exclut pas un usage indirect hors des modules racines déclarés).

| Primitive | combat | magie | corruption | psychologie | voyage-terre | voyage-fluvial | voyage-maritime | combat-naval | bataille-masse | interlude | commerce | equipage | repos-survie | coop | editeur | codex |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `ScreenShell` |  |  |  |  | U |  | U | U |  |  | U |  |  |  | U |  |
| `CadrePied / CadreFermer` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `Planche` |  |  |  |  |  |  |  | U |  |  |  |  |  |  |  |  |
| `Modal` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `BoiteAncree / usePlacementAncre / placerAncre` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `useInfobulle` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `CodexRef / CodexTitre` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `useFocusEmprunte / SURFACE / focusSansIntention / poserFocus / visibleFocusables` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `useDismissLayer / dialogueDuDessus / surfaceFocalisee` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `RollShell` |  | U | U |  | U |  | U | U | U | U | U | U | U |  |  |  |
| `RollRow` |  | U | U |  | U |  | U | U | U | U | U | U | U |  |  |  |
| `makeRollFlow/FLOWS` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `openRoll/resolveSurface` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `OptionChooser/ChoiceButtons` |  | U | U |  | U |  | U | U | U | U | U | U | U |  | U | U |
| `optionValue/optionPending/testPending` |  | U | U |  | U |  | U | U | U | U |  | U |  |  |  |  |
| `InfluenceRow` |  | U | U |  | U |  | U | U | U | U | U | U | U |  |  |  |
| `VsHeader` |  | U |  |  | U |  | U |  | U | U |  |  |  |  |  |  |
| `PortraitTile/CharFrame` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `SearchFilterField` |  |  |  |  |  |  |  |  |  | U |  |  |  |  | U | U |
| `findTableEntry` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `baseTestMods` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `actorIn/inBattleId` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `estDebout/meneurDuMonde/meneurDeboutDuMonde/poserCapDuGroupe` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `applyOps/GameOp` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `GameOpEditor` |  |  |  |  |  |  |  |  |  |  |  |  |  |  | U | U |
| `passiveMods` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `fireTriggers` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `resolveFreeAttacks` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `damageHull/healHull/damageVesselHull/healVesselHull` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `cascade/registerCascadeApplier` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `rule/policy` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `ownsLocally/pilotedByHuman/aiDriven/siegesRequis` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `RefField` |  |  |  |  |  |  |  |  |  |  |  |  |  |  | U | U |
| `Prose` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `resolveRender/tokenBodyKind` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `MasterDetail` |  |  |  |  | U |  | U |  |  | U |  |  |  |  | U | U |
| `ItemIcon` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `MediaSelect` |  |  |  |  |  |  |  |  |  |  |  |  |  |  | U |  |
| `gen-registry (_registry.generated)` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `import.meta.main` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `descendre/enfantsDe` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `coDescendre/ouverts/pasDeDonnee` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `MenuCard/MenuSection/MenuButton/MenuToggle` |  |  |  |  |  |  |  |  | U |  |  |  |  | U |  |  |
| `ScreenMeta` |  |  |  |  | U |  | U | U |  |  | U |  |  |  | U |  |
| `Tabs` |  |  |  |  | U |  | U | U |  | U | U |  |  |  | U | U |
| `rovingKeyDown` |  |  |  |  | U |  | U | U |  | U | U |  |  |  | U | U |
| `useRamenerEnVue / ramenerEnVue` |  |  |  |  | U |  | U |  |  | U |  |  |  |  | U | U |
| `useLongPress` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `CoopInvite / CoopCodeInput / SeatList / CoopAssignRow / CoopBanner` |  |  |  |  |  |  |  |  |  |  |  |  |  | U |  |  |
| `ReadyRow` |  |  |  |  | U |  | U |  | U | U |  |  | U |  |  |  |
| `PanneauParametre` |  |  |  |  | U |  |  | U | U |  |  | U |  |  |  |  |
| `LifeBar` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `TradeTable` |  |  |  |  |  |  |  |  |  |  | U |  |  |  |  |  |
| `ParchmentCard` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `ActivityPane` |  |  |  |  |  |  |  |  |  | U |  |  |  |  |  |  |
| `QtyStepper` |  | U | U |  | U |  | U | U | U | U | U | U | U |  | U | U |
| `NumberField` |  | U | U |  | U |  | U | U | U | U | U | U | U |  | U | U |
| `FREE_ATTACK_LABEL` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `GameOpChips` |  | U | U |  | U |  | U | U | U | U | U | U | U |  | U | U |
| `opRows` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `suspendActiveCascade/resumeSuspendedCascade` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `CreatorDice` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `CharacterPreview` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `GatedAction / classeBouton` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `RoseAxes` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `MetalStatus` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `WaxSeal/SealedPlaque` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `CareerPath` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `FigTile` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `GroupedPickGrid` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `DetailFrame` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `PlaqueRow/PlaqueGrid` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `CreatorStepFrame` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `Band` |  |  |  |  | U |  | U |  | U | U |  |  |  |  | U |  |
| `ReglagesApparence/MonsterPartsFields` |  |  |  |  |  |  |  |  |  |  |  |  |  |  | U | U |
| `HeroSheet` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `DesignGallery` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `Stack/Row/Grid/Split` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `Fleuron/RuleDivider/CornerFlourish/OrnateFrame` |  |  |  |  | U |  | U | U | U | U | U |  |  | U | U | U |
| `NotchGauge` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `WindRose` |  |  |  |  | U |  | U |  |  |  |  |  |  |  |  |  |
| `RollLine` |  | U | U |  | U |  | U | U | U | U | U | U | U |  |  |  |
| `RollPanel` |  | U | U |  | U |  | U | U | U | U | U | U | U |  |  |  |
| `DiceRoll` |  | U | U |  | U |  | U | U | U | U | U | U | U |  |  |  |
| `ForcedRollPicker` |  | U | U |  | U |  | U | U | U | U | U | U | U |  |  |  |
| `RecapLine` |  | U | U |  | U |  | U | U | U | U | U | U | U |  |  |  |
| `MultiRollList` |  |  |  |  | U |  | U |  | U | U |  |  |  |  |  |  |
| `RevealBody` |  |  |  |  | U |  | U |  | U | U |  |  |  |  |  |  |
| `TeamSegments` |  | U | U |  | U |  | U | U | U | U | U | U | U |  |  |  |
| `CombatBanner` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `CombatConsole` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `CombatStartSplash` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `RigPortrait` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `FxChip/EffectChips` |  |  |  |  |  |  |  |  |  | U |  |  |  |  |  |  |
| `SpectatorChip` |  |  |  |  |  |  |  |  | U | U |  |  |  |  |  |  |
| `GearAssignList` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `RewardRecap` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `SceneErrorBoundary` |  |  |  |  |  |  |  |  |  |  |  |  |  |  | U |  |
| `LogDrawer` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `InspectPanel` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `EquipmentPanel` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `MondeDeCampagne` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `GameStage3D/SurcoucheIso` |  |  |  |  |  |  |  |  |  |  |  |  |  |  | U |  |
| `PlaquesDeNom` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `PastilleEntite` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `StateChips` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `InitiativeStrip` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `PartyDock` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `ObjectiveBanner` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `ViewControls` |  |  |  |  |  |  |  |  |  |  |  |  |  |  | U |  |
| `DrBar` |  | U | U |  | U |  | U | U | U | U | U | U | U |  |  |  |
| `Coins` |  |  |  |  | U |  | U | U | U | U | U |  | U |  | U |  |
| `applyAttackResult / jouerLApresCoup / APRES_COUP / SuiteDeCoup / SuiteDeDefense` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `accesBase / brancherBasesSimulees` |  |  |  |  |  |  |  |  |  |  |  |  |  |  | U | U |
| `coupeAuMot` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `posePartagee` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `echapperRegex` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `alternationDe` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `alternationDeRegex` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `espacesExtensibles` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `CLES/communes/vocabulaire` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `PaletteDeclaree/PaletteDeCouchePortee` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `paletteDEspeceSchema` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `declarationsInertes` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `coucheDEspece/TETES_A_PEAU` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `TOKEN_RE/tokensOf/replaceTokens` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `SUFFIXE_DE_ROLE/RoleDeGamme/ROLES_DE_GAMME/gammeDe/baseDeGamme/Gamme/gammes` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `VIEWS/VIEW_LABEL` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `ViewSet/PartArt/ViewArt` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `declaredView/declaredViews/viewEntries/mapViews/foldView/nearestView` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `viewOrFront` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `tableTotale` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `isDrawnView` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `lireDegradeDerive` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `FX_GRADIENT_IDS` |  | U | U |  | U |  | U | U | U | U | U | U | U | U | U | U |
| `SEPARATEUR_DE_CLE/SEPARATEUR_DE_REMEDE/CHAMPS_DE_GROUPE/CHAMP_D_OCCURRENCE/CHAMPS_DE_CLE/CHAMPS_REQUIS/CHAMPS_D_ECHEANCE/CHAMPS_DE_SITE_OBSERVE/EntreeDeSite/Site/Echeance/cleDeSite/groupeDeSite/estEntreeDeSite/estNeuveOuAccrue/sitesEnEntrees/survieDeLecheance` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `FORMAT_MJS/FORMAT_JSON/FORMATS/formatDe/parCleDeSite/lireStockJson/lireEntreesDeSite/texteDeStock/texteEnPlace/entreesRegenerees/comptesParFamille/DECROISSANT/SOUS_LOT/REMESURE/texteRegenere/ecartDeRegeneration/RegenerationDeStock/CollectionRegeneree/PolitiqueDeCroissance` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `regenererStock` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `estEntreeNominative/entreesNominatives` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `threeWay` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `litteralJs` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `ast` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `sAppliqueA/estRetenu` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `scanConstructionsReservees/FORMULE_DE_CHEBYSHEV/ECHAPPEUR_DE_LITTERAL/ECRITURE_DE_STOCK_JSON/CONSTRUCTION_DE_TABLE_TOTALE/recopieDeCanon/cleEnLigne/estAppelDeclare/origineImportee` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `LECTURES_DE_L_ART` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `garde de la clé de site` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `estArtDuRig/PERIMETRE_DES_GARDES/corpusDesGardes/LEGACY_VOCAB_FAMILIES` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `reponsesDuNoeud/testAnnonce/ouvrirDialogue` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `surfaceTientLaMain/SURFACES_HORS_PENDING` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `parUnitesDeCode/parLibelle/replier` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `stockageWeb` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `PlayerText` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| `dataLabel` | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |

## Primitives jamais adoptées par un système déclaré

- `ItemIcon` (src/ui/ItemIcon.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `gen-registry (_registry.generated)` (scripts/gen-registry.mjs) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `import.meta.main` (scripts/guards/lib/pointDEntree.mjs) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `useLongPress` (src/ui/useLongPress.ts) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `CreatorDice` (src/ui/creator/CreatorDice.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `CharacterPreview` (src/ui/CharacterPreview.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `RoseAxes` (src/ui/RoseAxes.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `MetalStatus` (src/ui/MetalStatus.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `CareerPath` (src/ui/CareerPath.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `FigTile` (src/ui/FigTile.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `GroupedPickGrid` (src/ui/GroupedPickGrid.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `DetailFrame` (src/ui/DetailFrame.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `PlaqueRow/PlaqueGrid` (src/ui/PlaqueRow.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `CreatorStepFrame` (src/ui/creator/CreatorStepFrame.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `HeroSheet` (src/ui/HeroSheet.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `DesignGallery` (src/ui/gallery/DesignGallery.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `CombatBanner` (src/ui/CombatBanner.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `CombatConsole` (src/ui/CombatConsole.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `CombatStartSplash` (src/ui/CombatStartSplash.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `GearAssignList` (src/ui/GearAssignList.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `RewardRecap` (src/ui/RewardRecap.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `LogDrawer` (src/ui/LogDrawer.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `InspectPanel` (src/ui/InspectPanel.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `EquipmentPanel` (src/ui/EquipmentPanel.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `MondeDeCampagne` (src/gameIso/stage/MondeDeCampagne.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `PlaquesDeNom` (src/gameIso/stage/PlaquesDeNom.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `PastilleEntite` (src/gameIso/stage/PastilleEntite.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `InitiativeStrip` (src/ui/InitiativeStrip.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `PartyDock` (src/ui/PartyDock.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `ObjectiveBanner` (src/ui/ObjectiveBanner.tsx) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `echapperRegex` (src/lib/regex.ts) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `alternationDe` (src/lib/regex.ts) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `alternationDeRegex` (src/lib/regex.ts) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `espacesExtensibles` (src/lib/regex.ts) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `isDrawnView` (scripts/guards/lib/partViewAudit.ts) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `SEPARATEUR_DE_CLE/SEPARATEUR_DE_REMEDE/CHAMPS_DE_GROUPE/CHAMP_D_OCCURRENCE/CHAMPS_DE_CLE/CHAMPS_REQUIS/CHAMPS_D_ECHEANCE/CHAMPS_DE_SITE_OBSERVE/EntreeDeSite/Site/Echeance/cleDeSite/groupeDeSite/estEntreeDeSite/estNeuveOuAccrue/sitesEnEntrees/survieDeLecheance` (scripts/guards/lib/stock.mjs) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `FORMAT_MJS/FORMAT_JSON/FORMATS/formatDe/parCleDeSite/lireStockJson/lireEntreesDeSite/texteDeStock/texteEnPlace/entreesRegenerees/comptesParFamille/DECROISSANT/SOUS_LOT/REMESURE/texteRegenere/ecartDeRegeneration/RegenerationDeStock/CollectionRegeneree/PolitiqueDeCroissance` (scripts/guards/lib/stockDeSites.mjs) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `regenererStock` (scripts/guards/lib/regenStock.mts) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `estEntreeNominative/entreesNominatives` (scripts/guards/lib/stocksNominatifs.mjs) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `threeWay` (scripts/git-hooks/three-way.mjs) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `litteralJs` (scripts/guards/lib/litteralJs.mjs) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `ast` (scripts/guards/lib/dialecte.mjs) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `sAppliqueA/estRetenu` (scripts/guards/lib/sourceCorpus.mjs) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `scanConstructionsReservees/FORMULE_DE_CHEBYSHEV/ECHAPPEUR_DE_LITTERAL/ECRITURE_DE_STOCK_JSON/CONSTRUCTION_DE_TABLE_TOTALE/recopieDeCanon/cleEnLigne/estAppelDeclare/origineImportee` (scripts/guards/lib/canonUnique.mjs) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `LECTURES_DE_L_ART` (scripts/guards/lib/lecturesDeLArt.ts) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `garde de la clé de site` (src/cle-de-site-guard.test.ts) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).
- `estArtDuRig/PERIMETRE_DES_GARDES/corpusDesGardes/LEGACY_VOCAB_FAMILIES` (scripts/guards/lib/commentPoison.mjs) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).

## Modules `src/state`/`src/engine` non rattachés à un système déclaré

Portée : fichiers top-level (hors `*.test.ts`) non atteints par la closure d'import d'AUCUN système du
manifeste. Informatif — inclut les infra partagées (store, types, helpers transverses) qu'aucun système
unique ne « possède » légitimement ; à trier au fil de l'eau, pas un échec bloquant de ce script.

19 fichier(s) :

- `src/engine/axes.ts`
- `src/engine/mountedManeuvers.ts`
- `src/engine/names.ts`
- `src/engine/spellspec.ts`
- `src/engine/upkeepPorte.testkit.ts`
- `src/state/advancement.ts`
- `src/state/attackRelevance.ts`
- `src/state/cascadeTestKit.ts`
- `src/state/devtools.ts`
- `src/state/houseRules.ts`
- `src/state/jumpMove.ts`
- `src/state/noeudsDeTest.testkit.ts`
- `src/state/offresUtilisables.ts`
- `src/state/preferences.ts`
- `src/state/registreOffres.ts`
- `src/state/scenarioFlow.ts`
- `src/state/sceneEdit.testkit.ts`
- `src/state/turnEconomy.ts`
- `src/state/viewLevel.ts`
<!-- sources-empreinte: c3893e3a66ab04adb121470acb48edbfe2d1719d (1856 fichiers, 2 dossiers) corps: fb07e81636a61145e5b7461b94471f3e00edf129 -->
