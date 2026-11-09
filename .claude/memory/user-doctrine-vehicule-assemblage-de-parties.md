---
name: user-doctrine-vehicule-assemblage-de-parties
description: "Un véhicule est un assemblage, comme un personnage : le bateau, ses Améliorations, son armement, son décor et son pavillon sont des parties distinctes ; une fenêtre de l'illustration est une ouverture réelle"
metadata:
  type: user
---

**Verbatims —** Clément, fil de la barge fluviale (#3790) :
- (2026-11-09 14:14) « bon les fausses fenetre c'est un peu exagéré. Et n'oublie pas de faire la différence entre le bateau, les améliorations et le decors »
- (2026-11-09 14:14) « Elles ne sont pas en trop, juste que tu as mis des cadres la ou c'est des fenetres »
- (2026-11-09 14:16) « Oui clairement faut différencier chaque partie sur une illustration comme on le fait sur un personnage, qui est un assemblage d'un corps, visage, équipements, tenus, etc ... »
- Carte de décision du même fil, choix rapporté (non-verbatim) : mobilier, armement et équipage vivent dans les données du navire ; chaque scène en ajoute ou en retire par l'éditeur.

**Why :** un décor cuit dans la coque ne se retire d'aucune scène et un cadre plaqué sur un mur plein ment.
**How to apply :**
- Le BATEAU (GLB de base) : coque, ponts, superstructures, mâts et gréement, barre, garde-corps, ouvertures réelles.
- Les AMÉLIORATIONS : éléments à part, sur leurs `ancrages`, choisis à l'atelier ; l'ARMEMENT : pièces de siège sur les `postes`.
- Le DÉCOR (lanternes, tonneaux, cargaison, mobilier) : décors du catalogue dans les données du navire (`src/noyau/planDe*.ts`), que la scène ajoute ou retire.
- Le PAVILLON et l'emblème : surface `blason`, couleur de palette.
- Une fenêtre ou un hublot dessinés sont une ouverture dans le mur, jamais un cadre plaqué.
- Procédure : chapitre 9 de `.claude/skills/creer-un-personnage-3d/references/procedure.md`.
