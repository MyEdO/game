---
name: retoucher-un-ecran-ui
description: À utiliser quand on crée ou retouche un écran, un panneau, une modale ou du CSS (couleurs, densité, responsive, contrôles), ou dès qu'on s'apprête à écrire un hex en dur ou un nouveau composant d'affichage. Breakpoints canon 900/700/560, mobile 360px.
---

# Retoucher un écran UI

Lire **`docs/charte-ui.md`** (tokens `:root` seuls, modules CSS par domaine, densité, zéro texte
tutoriel) + règle stricte 4 du CLAUDE.md (responsive dès la création) + la table « Primitives
partagées » (composer, jamais recréer). Toute affordance = id d'icône EN DONNÉE via `<Icon>`,
jamais un émoji (garde `no-emoji-affordance.test.ts`). Validation : skill recette-navigateur.

## Avant de coder

Écran neuf ou refonte visuelle : le défaut de chaque décision est ce que fait Rogue Trader ou le
genre, jamais posé en arbitrage (doctrine « référence RT par défaut », `docs/doctrines.md`). Aucune
ligne de code avant que l'utilisateur valide la MAQUETTE de la composition et de chaque déviation
(composition statique capturée ou planche ; une annotation n'est pas une spec de rendu). La maquette
validée est le contrat de rendu ; un rendu rejeté revient à la maquette, jamais à une refonte improvisée
(utilisateur, 2026-08-24, sur un écran codé sans maquette : « qui a pu valider ce "truc" »).

## Livraison

Aucun commit d'écran, micro-fix compris, sans : juge adversarial sur le DIFF, diff relu par
l'orchestrateur, `typecheck:fast` + `test:perimetre`, captures fraîches qui prouvent le mécanisme,
puis les passes d'écran (skill orchestrer-des-agents, « Livraison d'ÉCRAN »). Une migration de
données qui alimente un écran est une livraison d'écran ; un lot trop petit pour le juge se cumule
avec le suivant ; les juges passent avant l'utilisateur.
