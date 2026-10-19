# Baseline AFFINE figée — #1176 C3 (2026-08-14)

Les planches du backend affine qui ont un **vis-à-vis volumique possible**, gelées **AVANT la bascule
C4** : ce que le monde affine montrait, face à ce que le monde volumique montre
(`public/qc/jeu/`, `node scripts/qc/capture-jeu.mjs`).

Ce dossier n'est pas une archive de sauvegarde — git conserve le code producteur. Il n'existe que pour
épargner un checkout au juge vision de C4, d'où sa réduction stricte : seules les vues **comparables**
sont committées.

## Provenance (mesurée)

| | |
|---|---|
| Commit | `b80502e3` (`git rev-parse HEAD` au moment de la génération) |
| Arbre | arbre de TRAVAIL de ce commit + WIP non commité d'une session voisine : `src/state/scene.ts` (+14 l.) et `src/scenes/test-scenarios/96-presets-edo.ts` (+19/−1) ; `src/gameIso/**` et `src/geometry/**` étaient propres |
| Générées le | 2026-08-14 |
| Commandes | `npx tsx scripts/qc/render-env.mts` (19,0 s, 5 planches) · `npx tsx scripts/qc/render-diligence.mts` (4,9 s, 2 planches) — Node local, aucun navigateur |
| Post-traitement | rangée EDGE-ON retirée des planches contact (recadrage vérifié pixel à pixel : 0 écart sur le bandeau, la rangée ISO et la rangée TOP/POV) · RGBA→RGB (canal alpha mesuré entièrement opaque sur les 7 planches) · `npx oxipng -o max --strip safe` |
| Poids | **9,11 Mo pour 6 PNG** (20,70 Mo pour 7 planches pleines) |

## Contenu (comparable)

| Fichier | Producteur | Panneaux gelés |
|---|---|---|
| `env-siege-explore.png` | `scripts/qc/render-env.mts` | iso rot0..3 · dessus · POV ×2 · POV nuit |
| `env-arene-hub.png` | idem | idem, bourg de l'arène (hub) |
| `env-test-opera-theatre.png` | idem | idem, scène de test `test-opera-theatre` |
| `env-test-piege-caveau.png` | idem | idem, caveau piégé |
| `diligence.png` | `scripts/qc/render-diligence.mts` | 2 étages × 4 rotations + plan source + plans de zones |
| `diligence-degagement.png` | idem | dégagement de toiture, toit entier vs allié en Salle principale |

Les panneaux **POV** sont gelés comme comparables : la voie volumique a son POV
(`src/gameIso/pov/PovStage.tsx`), mais `capture-jeu.mjs` ne cadre pas encore le POV — **item C4**.

## Hors comparaison (non committé, avec sa raison)

| Écarté | Raison |
|---|---|
| Rangée **edge-on** ×4 des planches contact | plus de vis-à-vis PAR CONSTRUCTION : le chemin joueur est restreint aux 4 crans diagonaux (`src/state/store.ts:1586`, `camEdge: false`) |
| `env-vitrine-batiments.png` | la scène `vitrine-batiments` n'a aucune route vers l'écran de jeu (montée par l'écran DEV du spike, qui meurt à C5b) |
| `occlusion-*.png`, `walls.png` | diagnostics du tri en profondeur per-tuile affine — mécanique absente du volumique (tampon Z), rien à comparer |
| `pilote-*-avant-apres.png` | comparaisons entre deux états d'un rendu affine, sans objet hors de ce backend |
| `opera-*.png` | la carte `opera-staatsoper` n'a aucune route vers l'écran de jeu |

## Régénération

Rien ici n'est irremplaçable : le code producteur vit dans l'historique.

```bash
git checkout <commit antérieur à C5a> -- scripts/qc src/gameIso/backends
npx tsx scripts/qc/render-env.mts        # planches contact PLEINES (rangée edge-on comprise)
npx tsx scripts/qc/render-diligence.mts
npx tsx scripts/qc/render-occlusion.mts  # diagnostics
```
