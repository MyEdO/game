---
name: feedback-migrer-lexistant
description: "Toucher un système non conforme OBLIGE à le migrer dans le geste, consommateurs compris ; les listes d'ancien comportement (baselines, cliquets, stocks, whitelists) DÉCROISSENT."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: af4cca95-103d-40f0-b2d1-6e5a482649c6
  modified: 2026-09-20T09:03:56.273Z
---

Verbatims utilisateur : « Quand tu vois que l'existant ne suis pas nos exigences, il faut le migrer » ; « tu dois t'assurer de migrer les éléments qui l'utilisent » ; « on a pleins de guard avec une liste en dure d'élément a migrer ».

Rappel du 2026-09-20, quand j'ai proposé d'ouvrir un stock décroissant de plus pour les `!important` : « L'application c'est un dépot de stock decroissant. Surtout que c'est toi qui a mis ces !important il y a quelques jours » (vérifié : `74b952861`, 2026-09-18, 11 `!important` dans `base.css` + une garde qui les EXIGE).

**Ne pas OUVRIR de nouveau stock.** Une classe de défaut trouvée se corrige à ZÉRO dans le chantier, avec une garde ABSOLUE (sans liste) ; si c'est trop gros, c'est un ticket, pas un registre. Un `!important` ou une garde qui verrouille un contournement est une rustine : remonter à la cause (sélecteur trop général, ordre de cascade).

**Why:** une garde qui RECENSE sans réduire déplace la dette, une baseline qui ne baisse jamais est une dette gelée qu'on a cessé de voir, et le contexte n'est chaud qu'au moment où l'on touche le système.

**How to apply:** élargir une garde ⇒ migrer ce qu'elle révèle ; toucher un fichier présent dans un stock ou une baseline ⇒ faire baisser sa ligne, idéalement la supprimer ; le rendu de lot annonce le delta CHIFFRÉ (avant → après) de chaque liste touchée. Une exemption PAR NOM d'offenseur est toujours suspecte : une exemption légitime se formule par FORME.
