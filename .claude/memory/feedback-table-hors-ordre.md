---
name: feedback-table-hors-ordre
description: "Une table du Source/ hors de l'ordre canonique de sa section, ou identique à celle de la section voisine, est un artefact d'extraction : ouvrir le PDF avant de citer"
metadata:
  node_type: memory
  type: feedback
---

`Source/` est la vérité citable mais reste une EXTRACTION : avant de citer une table de statbloc,
vérifier qu'elle suit l'ordre canonique de sa section (Compétences → Talents → Traits) et qu'elle
n'est pas identique à celle de la section voisine. L'un des deux cloche → ouvrir le PDF à la page
(`Read` pages, ou `pymupdf` via un fichier `.py` — `python -c` est bloqué) et citer PDF + ligne.

**Why:** une citation VRAIE d'une ligne FAUSSE passe tous les contrôles de forme ; les deux mensonges
connus de l'extraction sont la coupure de ligne et la DUPLICATION de table entre sections.

**How to apply:** une contradiction interne (Compétence « 50 + 2 DR » à côté d'un Talent « +3 DR »)
est un signal, pas un détail ; une anomalie d'extraction confirmée = ticket Source (corriger le `.md`
ET garder la trace).
