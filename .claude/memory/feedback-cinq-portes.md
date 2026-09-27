---
name: feedback-cinq-portes
description: "Aucun commit qui touche un écran sans les cinq portes, micro-fix compris — juge de code sur le DIFF, diff lu, gates de ma main, captures fraîches, juge vision."
metadata:
  type: feedback
---

Verdict utilisateur : « Ton credo dit bien de vérifier le travail de l'agent ? D'utiliser un juge adversarial pour s'assurer que l'agent ne fasse pas n'importe quoi ? ». Une migration de DONNÉES qui alimente un écran existant est une livraison UI : même régime, recette navigateur AU commit.

**Why:** sous pression de flux chaque vérification paraît trop lourde pour CE petit fix, et la somme des micro-fixes non jugés EST l'écran raté ; un test vert sur un câblage partiel ne voit ni un libellé perdu ni un hook mal placé qui ne casse qu'au montage réel.

**How to apply:** (1) juge adversarial sur le diff (primitives composées, variantes en data-attribute, morts purgées, tests positifs, claims contre-grepés) ; (2) je lis le DIFF, pas le rendu de l'agent ; (3) tsc + suite ; (4) captures fraîches, mécanisme vérifié et pas seulement les pixels ; (5) juge vision. Un lot « trop petit pour le juge » se cumule avec le suivant, et les juges passent AVANT l'utilisateur.
