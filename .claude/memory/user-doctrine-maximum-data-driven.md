---
name: user-doctrine-maximum-data-driven
description: "Ce qu'une règle fait (conséquence, effet, valeur) se déclare en donnée éditable, lue par une couture générique du moteur ; jamais un cas par nom dans le code"
metadata:
  type: user
---

**Verbatim (2026-11-25)**, sur #4993 (conséquences de sortie d'un État) : « En tout cas les conséquences doivent etre data driven » puis « D'ailleurs c'est une régle de passer le maximum en data driven »

**Why :** une règle écrite par nom dans le moteur échappe au Compendium et ne vaut que pour la voie qui l'a codée ; déclarée en donnée, elle s'édite et toute couture qui la lit l'applique partout.

**How to apply :** avant de coder un effet, une conséquence ou une valeur de règle, chercher le champ de donnée qui la porterait (`docs/vocabulaire-mecanique.md`, schémas `src/data/schemas/`) et la déclarer là ; le moteur ne garde que la couture générique qui la lit. Un `if (id === …)` qui porte une règle est un défaut à résorber. Les tests du moteur déclarent leurs propres entrées de fixture et ne lisent jamais la donnée livrée : [[user-arbitrage-tests-jamais-sur-donnee-data-driven]].
