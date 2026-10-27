# « Une nuit à l'Opéra » (NADJ) — état d'implémentation

Ticket: #3006

_Mis à jour 2026-07-05 — plan encore ouvert (autonomie PNJ / foule / mise en scène restants)._

Portage du scénario *Une nuit à l'Opéra* (Nuits Agitées & Dures Journées) en **données éditeur**.
Source canon : `Source/Warhammer v4 - Nuits agitees & dures journées/08 - Une nuit à l'Opéra.md`.
Principe : **zéro scène codée en dur** — tout est des Effets/Triggers génériques, éditables et testés.

## Primitifs livrés (génériques, réutilisables hors opéra)

| Primitif | Quoi | Fichier(s) clé | Éditeur |
|---|---|---|---|
| `delayedEffect` | Minuterie : applique des Effets à une échéance (`afterMinutes` mèche / `atHour:atMinute`), annulable par `cancelFlag` (désamorçage) | `scene.ts`, `combatEffects.ts` (`fireScheduledEffects`, hook `advanceTime`) | EffectList (Temps) |
| `Trigger.when` (`Condition{kind:'time', window}`) | Déclencheur **proximité + fenêtre horaire** (`after/before`, before exclusif) — spot-check « au bon endroit au bon moment » | `scene.ts` (`Trigger.when?: Condition`), `engine/flowCore.ts` (`TemporalCondition`, `evalCondition`), `checkTriggers` | LogicDock (champs ⏰) |
| `test.easierIf` | Difficulté **−N crans** si un héros a la compétence/le talent voulu (ex. détecter la bombe avec « Projectiles (Poudre noire) ») | `engine/tests.ts` (`easeDifficulty`), `engine/skills.ts` (`actorHasSkill`) | EffectList (Test) |
| `inflictDamage` / `applyCondition` | Dégâts plats / pose d'État, ciblant un héros ou tout le groupe (helper `effectTargets`) | `combatEffects.ts`, réutilise `conditions.ts`/`combatOrParty.ts` | EffectList (Afflictions) |
| `zoneBlast` | Souffle de **zone tiré** : formule de dés (`1d10+15`) + États à tous dans `radius` (Chebyshev) ; combat par position, hors combat le groupe | `combatEffects.ts`, `engine/dice.ts` (`rollExpr`) | EffectList (Afflictions) |
| 8 objets d'opéra | props SVG : rangée de fauteuils, rideau de scène, balustrade de loge, lustre, applique murale, pupitre de chef, fauteuil de loge, plante en pot | `gameIso/catalog/decor/defs/` | Palette (auto) |

Tous **validés** : tests unitaires + intégration, `validateScene`, garde-fou « un jet = une modale »,
typecheck. Props **QC visuels** : `npx tsx scripts/qc/render-opera-props.mts` (montage PNG).

## Scène jouable

`src/scenes/test-scenarios/opera.ts` — menu **« 🧪 Tests — scénarios » → 🎭 Opéra**.
Le **théâtre complet, multi-niveaux** (`MapSpec.levels`, `z0`/`z1` compilés par `buildScene`) :
- **z0** : coulisses + coursive → scène surélevée → parterre (auditorium) → hall/foyer → vestibule
  d'entrée, avec deux rampes jumelles (pas d'escalier — pente fabriquée par le moteur, `iso.ts` z-aware) ;
- **z1** (galerie à 2 m) : loges latérales des deux côtés + loge royale et son antichambre au fond-centre,
  où la bombe est dissimulée dans une plante en pot ;
- un **trigger d'entrée** arme la mèche (`delayedEffect` 1 h → `zoneBlast 1d10+15` + En flammes, `cancelFlag`) ;
- **interagir avec la plante** lance un Test de Perception Complexe (**−1 cran si Poudre noire**, `easierIf`) ;
  réussite → désamorçage (`setFlag bombeDesamorcee`) ;
- sans désamorçage, le souffle frappe au bout de la mèche.

## Composer une intrigue (le patron)

Une intrigue = **un déclencheur** (`temporalCondition` pour le timing/lieu, ou un trigger d'entrée + `delayedEffect`)
→ **une observation** (`test` + `easierIf`, branches `onSuccess`/`onFailure`)
→ **des conséquences** (`inflictDamage`/`zoneBlast`/`applyCondition`/`corruptionExposure`/`startCombat`)
→ **des flags** qui gatent la suite (`condition`, `cancelFlag`).
Les Blessures critiques sous 0 PB se composent en ajoutant un `inflictTrauma`.

**Limite de portage** : la plupart des 7 intrigues du source sont **PNJ-contre-PNJ** (le joueur observe/empêche).
Le moteur modélise le groupe joueur ; chaque intrigue doit donc être **reframée côté joueur** (le groupe est
menacé / peut intervenir), comme la bombe. Les intrigues à corruption/combat se composent (`corruptionExposure`,
`startCombat`) ; la panique de foule attend le système de foule.

## Reste à faire (chantiers lourds — à coordonner)

Le moteur multi-niveaux marchable (`Scene.layers[]` indexé par `z`, `MapSpec.levels`, rampes/`surfaceLink`,
projection/picking z-aware dans `iso.ts`) **est livré** — cf. plan
`~/.claude/plans/tout-m-interesse-harmonic-token.md` pour l'historique de ce chantier. Restent :
- **Autonomie PNJ** (agenda/déplacement hors combat) — Glimbrin file le professeur, assassins se positionnent.
- **Foule en simulation** (assise réactive → panique → fuite) — les pétards/obus, la ruée.
- **Mise en scène** (rideau animé, éclairage intérieur dynamique) + peaufinage de l'assemblage du théâtre.
