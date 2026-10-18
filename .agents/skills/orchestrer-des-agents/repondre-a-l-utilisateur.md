<!-- GENERATED: agents:sync; source=.claude/skills/orchestrer-des-agents/repondre-a-l-utilisateur.md -->
# Répondre à l'utilisateur

Annexe du skill `orchestrer-des-agents` (`.agents/skills/orchestrer-des-agents/SKILL.md`).

- **Toute décision passe par AskUserQuestion** : plusieurs questions par appel, un item par question,
  jamais en prose de fin de message ni dans une spec. Un arbitrage de règle passe d'abord par
  `arbitre-raw` (#2601), puis arrive avec verbatim du livre, situation chiffrée de nos données, code
  (`fichier:ligne`) et ce que l'arbitre a établi ; un bloc manque → pas de question. Une réponse libre
  est souvent une CONTRE-QUESTION ou une correction : boucle suspendue jusqu'à réponse.
- **Une option est une AFFIRMATION** : chaque coût et bénéfice se sonde, sonde collée, ou se dit non
  vérifié ; relire le rapport d'agent plutôt que ma mémoire. Une sortie VIDE avec un compteur non nul
  est une sonde cassée.
- **Toute demande de PERMISSION d'outil qui atteint l'utilisateur est un défaut** : nommer son émetteur (hook
  `scripts/hooks/*`, classificateur du harnais, mon propre enchaînement) et corriger à la racine ; un hook fautif se ticketise avec ses sondes. « Pourquoi
  X n'est pas fait ? » est l'ordre de faire X : ne soumettre que les RÉSULTATS, jamais le droit de commencer.
- **Avant de classer un sujet « arbitrage utilisateur », relire l'ATTENDU validé et le RAW** : s'ils
  répondent, EXÉCUTER (utilisateur, 2026-07-10 : « C'est fou que tu aies besoin de moi pour ça. »). Un « non » vaut au périmètre EXACT refusé.
- **Une phrase qui constate une ABSENCE** se lit comme un DÉFAUT quand l'élément figure au dessin ou au
  spécimen (utilisateur, 2026-08-17 : « Plutôt rien faire que tu saboter le projet !!! »). Si les deux lectures mènent à des gestes opposés, redemander en une ligne ; ne jamais défaire
  du travail livré sur une phrase ambiguë.
- **Retours en rafale sur un sujet complexe** : accuser réception, laisser atterrir le travail en vol,
  synthétiser le problème de FOND, proposer UNE direction argumentée, la faire VALIDER, puis exécuter ;
  sans cette synthèse, ni tout jeter, ni inverser une décision de la veille, ni re-briefer un agent en
  vol. Retours de playtest : par THÈMES, flux réel cartographié (`fichier:ligne` + réf RAW), cluster
  corrigé en lot, audit de ce que le joueur n'a pas nommé (information parfaite, télégraphe de la menace,
  lisibilité positionnelle, économie d'action, cause→effet).
- **Juger avant d'exposer au goût** : planche, maquette ou capture passe d'abord un juge-vision ou mon
  jugement écrit défaut par défaut ; les défauts nommés se corrigent et se recapturent ; n'exposer que des
  candidats défendus (#1343 ; utilisateur, 2026-09-26 : « Regarde les de ton coté avant de me les
  exposer »).
- **Jamais « complet » sur un trou connu** : la limite de couverture s'écrit dans le livrable ET
  l'annonce ; un « reste » ne se cite que vérifié dans le code et rattaché au travail fait.
