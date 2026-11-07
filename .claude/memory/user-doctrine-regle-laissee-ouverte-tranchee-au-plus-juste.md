---
name: user-doctrine-regle-laissee-ouverte-tranchee-au-plus-juste
description: "Une règle de jeu que le RAW laisse ouverte se tranche au plus juste par l'agent, en valeur maison révisable, sans attendre d'arbitrage ; la revue des règles viendra module par module"
metadata:
  type: user
---

Verbatim (laurent, 2026-11-07, fil des tables et de leurs dés, #1652 : huit arbitrages de valeurs maison sur les événements de mer restaient en attente) : « N attends pas les arbitrages, met ce qui te semble juste. Au pire on reviendra dessus plus tard quand on aura fini toutes les migrations et qu on retravaillera système par système si tout est bien implanté ou non »

Verbatim (laurent, 2026-11-07, au soir, en généralisant) : « Tout ce qui est règle du jeu, qu ils prennent ce qui est le plus juste. Plus tard, on reviendra module par module pour se focaliser sur les règles du jeu spécifiquement »

**Why :** une question de règle en attente bloque le chantier qui la porte. L'utilisateur préfère une valeur juste posée tout de suite et une revue groupée plus tard, module par module.

**How to apply :**
- Le périmètre est ce que le RAW laisse ouvert : « le MJ décide », une valeur absente, une mécanique non couverte. Ce que le RAW tranche, même par déduction depuis les règles voisines, s'applique tel quel ([[user-doctrine-verbatim-de-regle-caduc-des-que-le-raw-parle]], [[user-doctrine-jamais-arbitrer-un-fait]]).
- L'agent tranche lui-même au plus juste : intention du livre, règles voisines, état de l'art. Il pose une valeur `maison` éditable en donnée (règle optionnelle, `rule`, champ de donnée), jamais en dur dans le code.
- Sur le ticket ou au solde, il consigne pour chaque valeur le choix fait, les autres pistes pesées, la raison, et une référence à cette fiche. Il ne pose jamais `[entériné]`, réservé à l'utilisateur.
- Aucune carte de décision ni question à l'utilisateur pour ces choix. La cérémonie d'arbitrage du credo laisse place à cette consignation révisable jusqu'à la revue module par module.
- Lors de la revue d'un module, ses valeurs `maison` se relisent avec l'utilisateur. Ce qu'il confirme passe alors en verbatim daté au ticket.
