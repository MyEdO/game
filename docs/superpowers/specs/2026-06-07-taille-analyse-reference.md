# Analyse de référence — le trait **Taille** (WFRP4, LDB FR)

*Produite par sweep multi-agents (7 lentilles RAW + code, 2026-06-07). Sert de socle au futur
jalon « Sous-système Taille » (T2–T6). Le lot courant n'implémente que **T0 + T1** (cf.
`2026-06-07-difficultes-combat-table-design.md`).*

## Ce qu'est la Taille

**Pas une caractéristique chiffrée** : c'est un **Trait de créature** (« Taille (Divers) ») dont la
valeur est une **catégorie** parmi 7 (`85 - Traits de créature.md` l.342-344). « Moyenne » = défaut
implicite des espèces jouables (humain/nain/elfe), **sans Trait**, mod 0. Quasiment tous les effets
se résolvent par **comparaison d'écart de catégories** entre deux combattants — jamais en valeur
absolue. ⇒ modèle = **champ ordinal `size` (index 0–6)**, pas un `CharKey` : il ne se *teste* pas,
il se *compare*. La taille métrique d'un PJ (145+5d10 cm, `05 - _gjdgxs.md` l.704-707) est cosmétique.
Ambiguïté Halfling : exemple de « Petite » (l.161/286) mais jouable Moyen ; le code pose déjà
`sp.small` (`character.ts` l.210) → Petite **pour les Blessures uniquement**.

## Les 7 catégories + à-toucher au tir (cible)

| Catégorie | idx | Tir | Exemples |
|---|---|---|---|
| Minuscule | 0 | −30 | papillon, souris, pigeon (< 30 cm) |
| Très Petite | 1 | −20 | chat, faucon, bébé (≤ 60 cm) |
| Petite | 2 | −10 | halfling, rat géant, enfant (≤ 1,20 m) |
| **Moyenne** | 3 | **+0** | humain, nain, elfe (≤ 2,10 m) — défaut |
| Grande | 4 | +20 | cheval, ogre, troll (≤ 3,65 m) |
| Énorme | 5 | +40 | griffon, vouivre, manticore (≤ 6 m) |
| Monstrueuse | 6 | +60 | dragon, géant, prince démon (> 6 m) |

Source : `14 - _GoBack.md` l.138-139, l.151-170 + table Difficultés de Combat l.79-118.

## Inventaire d'effets

### RAW (sourcés)
- **Tir** : mod d'à-toucher selon la Taille de la **cible** (−30..+60), valeur absolue. `14 l.138-170`.
- **Mêlée** : **+10 au plus petit** (le SEUL bonus mêlée lié à la Taille ; s'applique au plus petit). `85 l.301-303`.
- **Dégâts infligés** : ×(nb catégories d'écart) si l'attaquant est plus grand, **après** mitigation BE. `85 l.293-299`.
- **Atouts conférés par l'écart** : Dévastatrice à +1 cat., Percutante à +2 cat. `85 l.293-299`.
- **Frappe Mortelle** (optionnelle) : toute frappe réussie d'une créature plus grande l'active. `85 l.293-299`.
- **Défense** : −2 DR/catégorie quand le **plus petit pare** (pas l'esquive). `85 l.305-306`.
- **Blessures par catégorie** : Minuscule=1 ; Très Petite=BE ; Petite=2BE+BFM ; Moyenne=BF+2BE+BFM ;
  Grande ×2 ; Énorme ×4 ; Monstrueuse ×8. Endurant **avant** le ×N. `85 l.332-352 + l.105-106`.
- **Peur/Terreur automatiques** : créature agressive → Peur N (N=écart) à tout plus petit, Terreur N si
  écart ≥ 2. `85 l.317-318` ; résolution `21 - Psychologie.md` l.26-29 / l.55-57.
- **Désengagement gratuit** du plus grand. `85 l.308-309`.
- **Force opposée** : +2 cat. = victoire auto ; +1 cat. = le plus petit doit faire un Critique pour s'opposer. `85 l.311-312`.
- **Piétinement** : Action gratuite à 1 Avantage, Dégâts = BF, via Bagarre. `85 l.320-321 + l.245-246`.
- **Localisation par forme de corps** (≠ Taille) : humanoïde / quadrupède / oiseau / serpent / araignée.
  `13 l.144 + 76 - Point d'Impact des Créatures.md`. Cible +2 cat. → on choisit la zone (`76 l.39`).
- **Monture & Taille** : `14 l.217-223`. **Queue/Langue** : `85 l.37-38 / l.185-188`.
- **Nuée** ignore la Taille, +40 aux tirs sur elle. **Immunité Psy** annule Peur/Terreur. `85 l.199-200 / l.143-144`.
- **Agrandir/réduire** (build statbloc) : +10 F, +10 E, −5 Ag par cat. `85 l.340`.

### Design (RAW silencieux — à ne PAS inventer comme « canon »)
- **Footprint multi-cases** : `15 - Déplacement.md` l.55 dit « peuvent occuper 2, 4 cases ou plus » —
  **permissif, aucune table**. Mapping cat→cases = notre design. Échelle grille fixe 3 cm = 2 m.
- **« Considérée comme agressive »** (déclencheur Peur/Terreur) : non défini mécaniquement.
- **Arbitrage Peur autonome vs Peur de Taille** : prendre le max (non tranché).

## Pièges (l'analyse a bloqué 5 tentations d'invention)
1. ❌ Bonus d'à-toucher **mêlée** pour le plus grand : N'EXISTE PAS (seul +10 au plus petit).
2. ❌ **Allonge/reach** de mêlée par la Taille : RAW silencieux (Engagement binaire `13 l.174-175`).
3. ❌ **Réduction des dégâts subis** par les grosses créatures : aucune règle (la Taille agit sur PV/Dégâts infligés, jamais l'encaisse).
4. ❌ Traits **Robuste/Engloutir** : absents du RAW FR.
5. ❌ Mapping **Taille→cases / Taille→M** : aucun chiffre.
- ⚠️ **Double-multiplication des Blessures** : `char.B` des monstres est déjà précalculé en data
  (`spawn.ts` lit char.B brut) — une seule autorité (data pour les monstres ; `maxWounds` Taille-aware
  pour les héros / recalcul explicite).
- ⚠️ **Halfling** : tous les PJ traités **Moyens pour la comparaison** ; Petite pour les Blessures seulement.
- ⚠️ **3 axes homonymes à ne pas amalgamer** : (a) catégorie de Taille de règle ; (b) forme de corps
  pour la localisation ; (c) `bodyPlanOf`/`appearance.build` du rig (cosmétique, READ-ONLY).

## Modèle recommandé
- `Combatant.size?: SizeCategory` (`engine/types.ts`), optionnel + défaut 'moyenne' au point de lecture.
- `SizeCategory` enum + `SIZE_ORDER: Record<…,0..6>` (cœur = écart) + `SIZE_RANGED_MOD: Record<…,−30..+60>`.
- `sizeFromTraits(traits)` (`spawn.ts`, calqué sur `weaponFromTrait`/`armourFromTraits`) : regex
  `/^Taille\s*\(([^)]+)\)/i`, normaliser via `norm`, 5 plages narratives → **borne haute** (design documenté), défaut 'moyenne'.
- Héros : dérivés de l'espèce (Moyenne ; `sp.small` → Petite pour Blessures plus tard).
- `CustomStatblock.size?` (`scene.ts`) + `<select>` éditeur. **Ne pas éditer `creatures.json` à la main** (régénéré).

## Découpage Taille (futur jalon, après ce lot)
- **T0** champ + enum + parser + dérivation espèce/statblock *(inclus dans le lot courant)*.
- **T1** à-toucher (mod tir cible + +10 plus petit) = *le « size-to-hit »* *(inclus dans le lot courant)*.
- **T2** Dégâts ×N + Dévastatrice/Percutante + Frappe Mortelle.
- **T3** défense −2 DR parade + Désengagement gratuit + Force opposée + Piétinement.
- **T4** Blessures par catégorie (attention double-mult.).
- **T5** Peur/Terreur (sous-système Psychologie complet — Test de Calme étendu, État Brisé).
- **T6** footprint multi-cases (design lourd : pathfinding non-ponctuel + picking/rendu, partiellement bloqué rig).
