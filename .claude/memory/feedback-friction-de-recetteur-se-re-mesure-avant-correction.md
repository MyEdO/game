---
name: feedback-friction-de-recetteur-se-re-mesure-avant-correction
description: "Une FRICTION rendue par un recetteur est une hypothèse : elle se re-mesure isolément avant d'entrer dans un brief de correction — l'artefact vient souvent de son propre harnais."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a0dfb696-da2e-4137-ae4b-32ad3e05ed77
  modified: 2026-09-21T22:01:21.405Z
---

Avant de porter une friction de recette dans un brief de codeur, la faire RE-MESURER isolément par le
recetteur lui-même, avec la sonde discriminante nommée (« mesure X à t+50/300/1000 ms », « quelle est
la position réelle après LE geste testé ? »). Le rendu attendu est un tableau brut, pas un verdict.

**Why:** le recetteur mesure à travers son script, et son script touche l'état qu'il observe. Pièges
connus du kit CDP `scripts/recette/lib.mjs` : `shot()` fait un `blur()` par défaut avant capture (un
`activeElement` lu APRÈS la capture vaut `BODY`, faux « pas de focus ») ; un `scrollY` hérité de
l'exploration fait croire qu'un élément sort du viewport. Une friction d'artefact produit un brief sur
un défaut INEXISTANT, et la « correction » déplace du code sain.

**How to apply:** traiter le rapport de recette comme deux matières distinctes — ce qui est VU à
l'écran (capture : fait) et ce qui est MESURÉ par script (hypothèse). Une friction qui ne se voit pas
sur une capture se re-mesure. Question qui tranche : « ton script a-t-il touché l'état entre le geste
et la lecture ? ». Voir [[feedback-preuve-mesuree-sur-le-chemin-reel]] pour la représentativité du
chemin, et [[feedback-adversaire-creatif]].
