---
name: game-francais-jamais-anglais
description: "ÉDITION 4e : règles et stats viennent des sources FR ; la VO désambiguïse, et ne fournit que la donnée MÉCANIQUE absente de la VF. EXCEPTION depuis 2026-09-18 : le Core Rulebook 5e est un livre VO AUTORISÉ, cœur de l'édition 5e"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 60c2b9c9-5d2c-4ec0-88b2-c409c7dc078c
  modified: 2026-09-18T19:03:09.435Z
---

**Why:** la donnée du jeu est FR (CC/CT/F/E/I/Ag/Dex/Int/FM/Soc/B, pas WS/BS/S/T/W) ; parser l'anglais importe un vocabulaire étranger.

**How to apply:** toute stat ou règle se lit dans `Source/` FR et doit pouvoir s'y recoller verbatim. Deux usages VO, et deux seulement : COMPRENDRE une VF ambiguë ou dérivée (utilisateur, 2026-06-23 : « en cas de question, regarde la VO ») ; FOURNIR une donnée mécanique (caractéristiques, traits, Taille, armure) absente du RAW FR après balayage du bon livre (utilisateur, 2026-07-20 : « pense aussi a regarder la VO pour les stats de ce que tu ne trouve pas dans la VF (regarde même les scénarios) ») — nombres, ids FR du catalogue et nom FR seulement, `source:` citant le livre VO réel. Aucune prose VO recopiée ni traduite, aucune citation VO.

**Exception — édition 5e (utilisateur, 2026-09-18 : « Elle est en VO, mais ce n'est pas grave, ca sera l'occasion d'éprouver notre système de langue VO/VF ! »)** : `Source/Warhammer Fantasy Roleplay 5e Core Rulebook/` est le livre de CŒUR de l'édition 5e, en VO, citable (`réf l.<ligne>` verbatim anglais) et ADRESSABLE (prose par `descRef`, jamais recopiée ni traduite — « Pas de traduction, on va gérer la VO dans l'application »). Ce qui précède vaut en 4e ; les AUTRES dossiers VO sans préfixe `Warhammer v4 - ` restent exclus, hors LECTURE de L'Ennemi Intérieur ([[user-doctrine-lecture-vo-campagne-pour-comprendre]]). Voir [[user-doctrine-edition-5e-coeur-remplace-ldb-raw-sauf-errata]].
