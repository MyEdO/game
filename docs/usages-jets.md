# Usages du système de jet, par CONSOMMATEUR — GÉNÉRÉ

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-usages-jets.mjs` (`npm run docs:usages-jets`) — NE PAS ÉDITER À LA MAIN.
> Source : le scan AST `scripts/docs/lib/rollShellUsage.mjs` sur les fichiers de production de `src/`.
> Les COLONNES sont les props de `src/ui/RollShell.tsx` et les membres de `RollRowProps` (`src/ui/RollRow.tsx`) — lues à la
> source ; les LIGNES sont les consommateurs découverts par le scan. Aucune liste manuscrite.

## À quoi ça sert

`docs/registre-jets.md` répond à « **par où PART ce jet ?** » (les producteurs). Ce document-ci est son
pendant côté AFFICHAGE : « **comment chacun UTILISE le système de jet ?** » — quelles zones du contrat
d'affichage chaque consommateur remplit, et quelles particularités MÉCANIQUES ses zones trahissent.
Le contrat lui-même (ce que chaque zone doit porter, et où) est DÉFINI par `docs/charte-ui.md` : ce
document ne le redéfinit pas, il MESURE qui en consomme quoi.

**Population mesurée : 37 consommateurs** — 49 sites JSX `<RollShell …>` (J) et 6 producteurs de
props `ComponentProps<typeof RollShell>` (H, les hooks qui paramètrent la coquille sans la rendre).

## Zones de COQUILLE (légende des colonnes)

| Colonne | Prop de `RollShell` | Id de zone | Facultative |
|---|---|---|---|
| `title` | `title` | — | **non** |
| **Z1** | `subtitle` | Z1 | oui |
| **Z2** | `instruction` | Z2 | oui |
| `embedded` | `embedded` | — | oui |
| `disableEscClose` | `disableEscClose` | — | oui |
| `stake` | `stake` | — | oui |
| `extra` | `extra` | — | oui |
| `setup` | `setup` | — | oui |
| `rows` | `rows` | — | **non** |
| `rolled` | `rolled` | — | **non** |
| `winnerIndex` | `winnerIndex` | — | oui |
| `netSL` | `netSL` | — | oui |
| `outcome` | `outcome` | — | oui |
| `summary` | `summary` | — | oui |
| `postRollExtra` | `postRollExtra` | — | oui |
| `forcedExtra` | `forcedExtra` | — | oui |
| `actions` | `actions` | — | **non** |
| `onCancel` | `onCancel` | — | oui |
| `flowKey` | `flowKey` | — | oui |

_19 zones de coquille. L'**id de zone** (`Zn`) est celui que le JSDoc de la prop DÉCLARE ;
sa définition vit à la charte. Une prop non encore taguée affiche « — » et sa colonne porte son nom._

## Matrice — consommateur × zones de COQUILLE

| Consommateur | Sites | Rangées | `title` | **Z1** | **Z2** | `embedded` | `disableEscClose` | `stake` | `extra` | `setup` | `rows` | `rolled` | `winnerIndex` | `netSL` | `outcome` | `summary` | `postRollExtra` | `forcedExtra` | `actions` | `onCancel` | `flowKey` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `src/ui/ActivityModal.tsx` | `ActivityModal` (J) | variable | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/AppraiseModal.tsx` | `AppraiseModalView` (J) | 1 | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/ApproachModal.tsx` | `ApproachModal` (J) | 1 | ✓ | ✓ | · | · | · | · | · | · | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/AuContactModal.tsx` | `AuContactModal` (J) ×2 | 2 | ✓ | · | · | · | · | ✓ | ✓ | · | ✓ | ✓ | ✓ | · | ✓ | · | ✓ | · | ✓ | ✓ | ✓ |
| `src/ui/BargainModal.tsx` | `BargainModalView` (J) | 2 | ✓ | ✓ | · | · | · | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/BattementModal.tsx` | `BattementModal` (J) | 1 | ✓ | · | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/CascadeModal.tsx` | `CascadeBody` (J) ×9, `attack` (J), `defense` (J), `extended` (J), `fumble` (J), `test` (J), `trample` (J) | appel / — / variable / 0 / 2+ | ✓ | ✓ | · | ✓ | ✓ | · | ✓ | ✓ | ✓ | ✓ | · | · | · | · | ✓ | · | ✓ | · | · |
| `src/ui/CastModal.tsx` | `CastModal` (J) | 1 | ✓ | · | · | · | · | · | ✓ | ✓ | ✓ | ✓ | · | · | ✓ | · | ✓ | · | ✓ | ✓ | ✓ |
| `src/ui/CorruptionModal.tsx` | `CorruptionModal` (J) | 1 | ✓ | ✓ | · | · | · | ✓ | · | ✓ | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | · | ✓ |
| `src/ui/CrewTestModal.tsx` | `CrewTestModalView` (J) | variable | ✓ | ✓ | · | · | · | ✓ | ✓ | · | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | ✓ |
| `src/ui/DisengageModal.tsx` | `DisengageModal` (J) ×2 | variable / 2 | ✓ | · | · | · | · | ✓ | ✓ | · | ✓ | ✓ | ✓ | · | ✓ | · | · | · | ✓ | · | ✓ |
| `src/ui/DispelModal.tsx` | `DispelModal` (J) | 1 | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/DistraireModal.tsx` | `DistraireModal` (J) | 2 | ✓ | · | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/EtalLotModal.tsx` | `EtalLotModal` (J) | variable | ✓ | · | ✓ | · | · | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/FallModal.tsx` | `FallModal` (J) ×2 | 0 / 1 | ✓ | ✓ | · | · | · | ✓ | · | ✓ | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/FocusModal.tsx` | `FocusModal` (J) | 1 | ✓ | ✓ | · | · | · | · | · | · | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/ForceDoorModal.tsx` | `ForceDoorModal` (J) | variable | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | ✓ |
| `src/ui/FrenzyModal.tsx` | `FrenzyModal` (J) | 1 | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/GrappleModal.tsx` | `GrappleModal` (J) ×2 | 2 | ✓ | · | · | · | · | · | ✓ | · | ✓ | ✓ | ✓ | · | ✓ | · | ✓ | · | ✓ | ✓ | ✓ |
| `src/ui/HandGateModal.tsx` | `HandGateModal` (J) | 1 | ✓ | ✓ | · | · | · | · | · | · | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/HealModal.tsx` | `HealRollFlow` (J) | 1 | ✓ | · | · | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/ManeuverModal.tsx` | `ManeuverModal` (J) | 1 | ✓ | ✓ | · | · | · | · | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/MedicModal.tsx` | `SurgeryRollFlow` (J) | 1 | ✓ | · | · | ✓ | · | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/ReloadModal.tsx` | `ReloadModalView` (J) | 1 | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/RunModal.tsx` | `RunModal` (J) | 1 | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/ShantyModal.tsx` | `ShantyModal` (J) | 1 | ✓ | ✓ | · | · | · | ✓ | · | ✓ | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/ShipBatteryModal.tsx` | `ShipBatteryModal` (J) | variable | ✓ | ✓ | · | · | · | · | ✓ | · | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | ✓ |
| `src/ui/ShipManeuverModal.tsx` | `ShipManeuverModal` (J) | variable | ✓ | ✓ | · | · | · | · | ✓ | · | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | ✓ |
| `src/ui/StateRecoveryModal.tsx` | `StateRecoveryModalView` (J) | variable | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/SteamSaveModal.tsx` | `SteamSaveModal` (J) | 1 | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | · | ✓ |
| `src/ui/WardModal.tsx` | `WardModal` (J) | 1 | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/jetProps/useAttackJetProps.tsx` | `useAttackJetProps` (H) | hook | ✓ | ✓ | · | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ |
| `src/ui/jetProps/useDefenseJetProps.tsx` | `useDefenseJetProps` (H) | hook | ✓ | ✓ | · | · | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | ✓ | · | ✓ |
| `src/ui/jetProps/useExtendedTestJetProps.tsx` | `useExtendedTestJetProps` (H) | hook | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |
| `src/ui/jetProps/useFumbleJetProps.tsx` | `useFumbleJetProps` (H) | hook | ✓ | ✓ | · | · | · | · | · | · | ✓ | ✓ | · | · | · | · | · | · | ✓ | · | · |
| `src/ui/jetProps/useTestJetProps.tsx` | `useTestJetProps` (H) | hook | ✓ | ✓ | · | · | · | · | · | ✓ | ✓ | ✓ | · | · | ✓ | · | ✓ | · | ✓ | ✓ | ✓ |
| `src/ui/jetProps/useTrampleJetProps.tsx` | `useTrampleJetProps` (H) | hook | ✓ | · | · | · | · | · | ✓ | · | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | ✓ | ✓ |

_`✓` = la zone est remplie par au moins un site du fichier ; `·` = jamais. **Sites** : le SYMBOLE englobant
(fonction/composant qui contient le site) — `(J)` = site JSX, `(H)` = producteur de props, `×n` = n sites
dans ce symbole. Aucun numéro de ligne : une ancre de ligne périmerait la doc à chaque édition au-dessus
d'un site. **Rangées** : nombre d'éléments quand `rows` est un tableau LITTÉRAL
(`+` = plus un spread), sinon la forme lisible au site (`variable`/`appel`) ou `hook`._

### Sites qui SPREADENT leur paramétrage

Un site `<RollShell {...props} />` ne déclare aucune zone en propre : ses zones sont celles du producteur
qu'il étale. La matrice ci-dessus le montre par une ligne quasi vide — c'est une MESURE, pas un manque.

| Consommateur | Spreads mesurés |
|---|---|
| `src/ui/CascadeModal.tsx` | `attackProps!`, `defenseProps!`, `extendedProps!`, `fumbleProps!`, `stakeProps`, `testProps!`, `trampleProps!` |

_1 consommateurs sur 37._

## Matrice — consommateur × zones de RANGÉE

Les zones de la RANGÉE (`RollRowProps`) : ce que chaque consommateur pose SUR la ligne de jet.
Colonnes restreintes aux 26 zones effectivement consommées (sur 29 déclarées) — les autres
seraient une colonne vide de bout en bout.

| Consommateur | `actor` | `fortune` | `resilience` | `row` | `rolled` | `rerolled` | `lost` | `interactive` | `rollLabel` | `onRoll` | `onReroll` | `onBonusSL` | `onDarkPact` | `onForce` | `preRollForce` | `forcedRoll` | `fixedMark` | `flowKey` | `noForcedDie` | `determination` | `resist` | `reverse` | `declare` | `rollBlocked` | `rollFrisson` | `extendedDr` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `src/ui/ActivityModal.tsx` | ✓ | ✓ | · | ✓ | · | ✓ | ✓ | ✓ | · | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · | ✓ |
| `src/ui/AppraiseModal.tsx` | ✓ | ✓ | · | ✓ | · | ✓ | · | ✓ | · | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/ApproachModal.tsx` | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | · | · | ✓ | ✓ | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/AuContactModal.tsx` | ✓ | · | · | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/BargainModal.tsx` | ✓ | ✓ | · | ✓ | · | ✓ | · | ✓ | · | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/BattementModal.tsx` | ✓ | · | · | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/CascadeModal.tsx` | ✓ | · | · | ✓ | · | ✓ | · | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | ✓ | ✓ | · | ✓ | ✓ | · | · | · | · | ✓ |
| `src/ui/CastModal.tsx` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ | · | ✓ | ✓ | · | · |
| `src/ui/CorruptionModal.tsx` | ✓ | · | ✓ | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | ✓ | · | · | · | · | · |
| `src/ui/CrewTestModal.tsx` | · | · | · | ✓ | · | · | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/DisengageModal.tsx` | ✓ | · | · | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ | · | · | · | · | · | · | · | · |
| `src/ui/DispelModal.tsx` | ✓ | · | · | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | ✓ |
| `src/ui/DistraireModal.tsx` | ✓ | · | · | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/EtalLotModal.tsx` | · | · | · | ✓ | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/FallModal.tsx` | ✓ | · | · | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/FocusModal.tsx` | ✓ | · | · | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | ✓ |
| `src/ui/ForceDoorModal.tsx` | · | · | · | ✓ | · | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/FrenzyModal.tsx` | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | · | · | ✓ | ✓ | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/GrappleModal.tsx` | ✓ | · | · | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/HandGateModal.tsx` | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/HealModal.tsx` | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/ManeuverModal.tsx` | ✓ | · | · | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/MedicModal.tsx` | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/ReloadModal.tsx` | ✓ | ✓ | · | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · | ✓ |
| `src/ui/RunModal.tsx` | ✓ | · | · | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/ShantyModal.tsx` | ✓ | · | · | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/ShipBatteryModal.tsx` | · | · | · | ✓ | · | · | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/ShipManeuverModal.tsx` | · | · | · | ✓ | · | · | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/StateRecoveryModal.tsx` | ✓ | ✓ | · | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/SteamSaveModal.tsx` | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/WardModal.tsx` | ✓ | · | · | ✓ | · | ✓ | · | · | · | ✓ | ✓ | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · |
| `src/ui/jetProps/useAttackJetProps.tsx` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | ✓ | ✓ | · | · | ✓ | · | · | ✓ | · |
| `src/ui/jetProps/useDefenseJetProps.tsx` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | ✓ | · | · | · | ✓ | · | · | ✓ | · |
| `src/ui/jetProps/useExtendedTestJetProps.tsx` | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ | · | · | · | · | · | · | · | ✓ |
| `src/ui/jetProps/useFumbleJetProps.tsx` | · | · | · | ✓ | ✓ | · | · | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
| `src/ui/jetProps/useTestJetProps.tsx` | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ | · | ✓ | · | ✓ | · | · | · | · |
| `src/ui/jetProps/useTrampleJetProps.tsx` | ✓ | · | · | ✓ | ✓ | ✓ | · | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | ✓ | · | · | · | · | · | · | · | · |

_Zones de rangée jamais consommées : `rollInBar`, `dieCommitRef`, `winner`._

## Particularités MÉCANIQUES déduites des zones

Aucune n'est déclarée par un nom de fichier : chacune est la conjonction de zones OBSERVÉES
(cf. légende sous la table). Une spécificité mécanique ÉTEND le contrat, elle ne le contredit pas.

| Consommateur | opposé | multi (N contributeurs) | table d100 | Test étendu | déclaration | dé fixé / forcé | refus gaté | Composants hébergés dans les slots |
|---|---|---|---|---|---|---|---|---|
| `src/ui/ActivityModal.tsx` | ✓ | · | · | ✓ | · | · | · | — |
| `src/ui/AppraiseModal.tsx` | · | · | · | · | · | · | · | — |
| `src/ui/ApproachModal.tsx` | · | · | · | · | · | · | · | `Icon` |
| `src/ui/AuContactModal.tsx` | ✓ | · | · | · | · | · | · | `Icon`, `OptionChooser`, `VsHeader` |
| `src/ui/BargainModal.tsx` | ✓ | · | · | · | · | · | · | — |
| `src/ui/BattementModal.tsx` | · | · | · | · | · | · | · | `Icon`, `OptionChooser`, `VsHeader` |
| `src/ui/CascadeModal.tsx` | · | · | ✓ | ✓ | · | ✓ | · | `CriticalBody`, `Icon`, `ModalSubject`, `NumberField`, `OptionChooser`, `RecapLineList`, `RevealBody`, `SequencePanel`, `TableRollLine` |
| `src/ui/CastModal.tsx` | · | · | · | · | ✓ | ✓ | ✓ | `CharFrame`, `Icon`, `OptionChooser`, `QtyStepper`, `RollRow`, `Row`, `Stack`, `VsHeader` |
| `src/ui/CorruptionModal.tsx` | · | · | · | · | · | · | · | `Icon`, `OptionChooser` |
| `src/ui/CrewTestModal.tsx` | · | ✓ | · | · | · | · | · | `Icon` |
| `src/ui/DisengageModal.tsx` | ✓ | · | · | · | · | · | · | — |
| `src/ui/DispelModal.tsx` | · | · | · | ✓ | · | · | · | `Icon` |
| `src/ui/DistraireModal.tsx` | ✓ | · | · | · | · | · | · | `OptionChooser`, `VsHeader` |
| `src/ui/EtalLotModal.tsx` | · | · | · | · | · | · | · | `Icon` |
| `src/ui/FallModal.tsx` | · | · | · | · | · | · | · | `ChoiceButtons`, `Icon` |
| `src/ui/FocusModal.tsx` | · | · | · | ✓ | · | · | · | `Icon` |
| `src/ui/ForceDoorModal.tsx` | · | ✓ | · | · | · | · | · | `Icon` |
| `src/ui/FrenzyModal.tsx` | · | · | · | · | · | · | · | `Icon` |
| `src/ui/GrappleModal.tsx` | ✓ | · | · | · | · | · | · | `Icon`, `OptionChooser`, `VsHeader` |
| `src/ui/HandGateModal.tsx` | · | · | · | · | · | · | · | `Icon` |
| `src/ui/HealModal.tsx` | · | · | · | · | · | · | · | `Icon`, `OptionChooser`, `VsHeader` |
| `src/ui/ManeuverModal.tsx` | · | · | · | · | · | · | · | `Icon`, `OptionChooser` |
| `src/ui/MedicModal.tsx` | · | · | · | · | · | · | · | `Icon` |
| `src/ui/ReloadModal.tsx` | · | · | · | ✓ | · | · | · | — |
| `src/ui/RunModal.tsx` | · | · | · | · | · | · | · | `Icon` |
| `src/ui/ShantyModal.tsx` | · | · | · | · | · | · | · | `Icon`, `OptionChooser` |
| `src/ui/ShipBatteryModal.tsx` | · | ✓ | · | · | · | · | · | `Icon` |
| `src/ui/ShipManeuverModal.tsx` | · | ✓ | · | · | · | · | · | `Icon`, `OptionChooser` |
| `src/ui/StateRecoveryModal.tsx` | · | · | · | · | · | · | · | — |
| `src/ui/SteamSaveModal.tsx` | · | · | · | · | · | · | · | — |
| `src/ui/WardModal.tsx` | · | · | · | · | · | · | · | `Icon` |
| `src/ui/jetProps/useAttackJetProps.tsx` | ✓ | · | · | · | · | ✓ | · | `CodexRef`, `CritLocationPicker`, `DeterminationButton`, `Icon`, `Row`, `VsHeader` |
| `src/ui/jetProps/useDefenseJetProps.tsx` | ✓ | · | · | · | · | · | · | `CodexRef`, `DeterminationButton`, `Icon`, `OptionChooser`, `VsHeader` |
| `src/ui/jetProps/useExtendedTestJetProps.tsx` | · | · | · | ✓ | · | · | · | `Icon` |
| `src/ui/jetProps/useFumbleJetProps.tsx` | · | · | ✓ | · | · | · | · | `Icon`, `TableRollLine` |
| `src/ui/jetProps/useTestJetProps.tsx` | · | · | · | · | · | · | · | `CodexRef`, `PortraitPicker` |
| `src/ui/jetProps/useTrampleJetProps.tsx` | · | · | · | · | · | · | · | `Icon`, `VsHeader` |

**Critères mesurés** :
- **opposé** — `winnerIndex` \| `netSL` (coquille) ou `winner` (rangée) ;
- **multi** — `summary` (l'agrégat n'a de sens qu'à N) ou plus de 2 rangées littérales ;
- **table d100** — `TableRollLine` rendu dans un slot ;
- **Test étendu** — `extendedDr` sur une rangée ;
- **déclaration** — `declare` sur une rangée ;
- **dé fixé / forcé** — `forcedRoll` \| `fixedMark` sur une rangée, ou `forcedExtra` sur la coquille ;
- **refus gaté** — `rollBlocked` sur une rangée, ou `GatedAction` dans un slot.

**Comptes** : opposé 8 · multi (N contributeurs) 4 · table d100 2 · Test étendu 6 · déclaration 1 · dé fixé / forcé 3 · refus gaté 1.

## Périmètre mesuré et angles morts (à dire pour ne pas se lire comme exhaustif)

PÉRIMÈTRE MESURÉ : les fichiers de PRODUCTION de `src/` (`.ts`/`.tsx`, tests exclus), scannés à l'AST
pour les sites `<RollShell …>` et les producteurs de `ComponentProps<typeof RollShell>`. Tout le reste
est un angle mort, et les voici :

- Le scan voit **quelles zones sont remplies**, jamais **ce qu'on y met** : un `subtitle` conforme et un
  `subtitle` qui redit la Difficulté cochent la même case. La CONFORMITÉ sémantique au contrat relève des
  gardes de contrat (`src/ui/*.test.tsx`), pas de cette doc.
- Une zone remplie **conditionnellement** (`outcome={x ? … : undefined}`) coche comme une zone toujours
  remplie : l'AST voit l'attribut, pas l'exécution. Idem pour une prop passée avec `undefined`.
- Les zones de **RANGÉE** sont relevées PAR NOM au niveau du FICHIER (clés de littéraux d'objet et props
  de `RollRow`), pas dans le sous-arbre du `RollShell` : un fichier qui construit des rangées pour deux
  usages les agrège sur une seule ligne, et une clé HOMONYME d'un autre objet (`actor`, `rolled`,
  `flowKey`… d'un pending, d'une spec) coche la même case. Une rangée assemblée par un helper partagé
  (`src/ui/buildParticipantRows.tsx`) est comptée chez le HELPER, pas chez ses appelants — mais le
  BUNDLE que l'appelant lui passe porte les mêmes clés, ce qui explique la densité de cette matrice.
  Une rangée MINTÉE par la porte (`src/ui/rollRowBuild.ts` : `buildRollRow`/`tableRow`/`witnessRow`…)
  n'est comptée NULLE PART : les zones que le constructeur pose pour le site (`rolled`, `interactive`)
  quittent la ligne de l'appelant, et la porte elle-même n'a aucun site `RollShell` qui la ferait
  entrer dans la population. Une case `·` peut donc signifier « posé par la porte », pas « absent ».
- La **cardinalité** n'est lisible que sur un tableau littéral ; `rows={variable}` ou `rows={appel(…)}`
  ne se compte pas — la valeur affichée est alors la FORME, jamais un nombre supposé.
- Les **spreads** (`<RollShell {...props} />`) ne déclarent aucune zone : le consommateur réel est le
  producteur de props (population H). Le scan ne suit pas la liaison entre les deux.
- La population est découverte par le **nom** `RollShell` : un import renommé
  (`import { RollShell as X }`) ou une coquille rendue par une indirection échappe. Même angle mort que
  les gardes de seam (`docs/registre-jets.md`).
- L'ancrage est le **symbole englobant**, jamais la ligne : deux sites d'un même symbole ne se distinguent
  pas (ils se comptent, `×n`), et un site posé au niveau MODULE s'affiche `(module)`. C'est le prix de la
  stabilité — une ancre de ligne périme la doc à chaque édition au-dessus d'un site.
- Les **fichiers de test** sont hors périmètre : ils montent la coquille pour l'éprouver, pas pour servir
  un jet du jeu.
- Les **ids de zone** (`Zn`) affichés sont ceux que le JSDoc des props DÉCLARE. Une zone du contrat non
  encore taguée à la primitive n'a pas d'id ici — ce document RELÈVE les ids, il ne les attribue pas.

<!-- sources-empreinte: 5168bcd21db3e0e4693f45dc7825cefadc80e5c6 (1994 fichiers, 136 dossiers) corps: 8f1ee698aaa823822390b65a5262b101aae75e43 -->
