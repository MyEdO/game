// STOCK NOMINATIF des PILOTES DE CASCADE RECOPIÉS dans un test (#1765) — consommé par
// `src/noyau/pilote-cascade.test.ts`.
//
// Une ITÉRATION (boucle, callback d'itérateur, fonction nommée récursive) d'une suite ou d'un kit de test
// (`fichierVitest.mjs`), tous dialectes (`EXTENSIONS_DE_SCRIPT`), qui lit `pendingCascade` et joue un
// verbe `cascade*` du store PILOTE la cascade à la main : quand un flux est refondu, c'est elle qui
// dérive. Chacun des deux vaut directement, ou par l'appel d'un HELPER — fonction locale nommée dont
// aucune itération ne lit ni ne joue directement, au statut lu sur son seul corps. Une fonction à UNE
// étape n'est pas un pilote ; la boucle qui l'appelle en est un. Un appel au kit
// (`src/state/cascade.testkit.ts`), nommé ou par espace de noms, n'est jamais un verbe. Corps GÉNÉRÉ
// par `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/piloteCascadeAudit.ts` (politique
// `DECROISSANT`) depuis `sitesPiloteCascade()` — la MESURE, ses limites et ses exemptions au site vivent
// dans `piloteCascadeAudit.ts`, partagée avec la garde.
//
// FORME : une ENTRÉE par ITÉRATION-SITE, son identité `{ fichier, ref, occurrence }` (`cleDeSite`,
// `stock.mjs`). Un site ne se compte qu'une fois : l'itération qui l'englobe se juge hors de lui, et une
// fonction dont une itération lit ou joue ne prête rien à qui l'appelle. Le `fichier` est la suite qui
// porte l'itération, la `ref` son contexte nommé le plus proche (`it:`/`describe:` + titre, ou `fn:` + nom
// de fonction), l'`occurrence` son ordinal parmi ses homonymes du même fichier.
//
// Une entrée se solde en MIGRANT CETTE itération vers le kit, puis en relançant le régénérateur — jamais
// en retirant la ligne seule.

/** @type {import('./stock.mjs').EntreeDeSite[]} */
export const PILOTE_CASCADE_RATCHET = [
  { fichier: 'src/noyau/shipwreck.test.ts', ref: 'fn:drainSwimCascade', occurrence: 1 },
  { fichier: 'src/noyau/tavernFlow.test.ts', ref: 'fn:drain', occurrence: 1 },
  { fichier: 'src/noyau/tavernFlow.test.ts', ref: 'it:+1 État Exténué tous les (Bonus d’Endurance) tours sans vainqueur (l.34)', occurrence: 1 },
  { fichier: 'src/noyau/tavernFlow.test.ts', ref: 'it:la manche qui EMPORTE la partie n’inflige pas l’Exténué, même au rang du Bonus d’Endurance (l.34)', occurrence: 1 },
  { fichier: 'src/scenes/test-scenarios/15-commerce-fluvial.test.ts', ref: 'fn:drainCascade', occurrence: 1 },
  { fichier: 'src/scenes/test-scenarios/duel-naval.test.ts', ref: 'fn:settleCascade', occurrence: 1 },
  { fichier: 'src/state/combat-entity-reconcile.test.ts', ref: 'fn:drainCombatEndCascade', occurrence: 1 },
  { fichier: 'src/state/disease-contraction.test.ts', ref: 'fn:resolveCombatEnd', occurrence: 1 },
  { fichier: 'src/state/firstBlood.test.ts', ref: 'fn:drainCombatEndCascade', occurrence: 1 },
  { fichier: 'src/state/inn-flow.test.ts', ref: 'fn:drainCascade', occurrence: 1 },
  { fichier: 'src/state/land-market-flow.test.ts', ref: 'fn:drainCascade', occurrence: 1 },
  { fichier: 'src/state/land-market-flow.test.ts', ref: 'fn:sellAtB', occurrence: 1 },
  { fichier: 'src/state/land-market.test.ts', ref: 'fn:drainCascade', occurrence: 1 },
  { fichier: 'src/state/maladie-porte-valeur.test.ts', ref: 'it:B2 — le HARNAIS de test et la NUIT réelle appliquent la MÊME guérison (Exténué collant compris)', occurrence: 1 },
  { fichier: 'src/state/miscast-step.test.ts', ref: 'fn:joueEnRetenant', occurrence: 1 },
  { fichier: 'src/state/night-bands.test.ts', ref: 'it:deux jours de Dessoûlage → deux bandes de gueule de bois aux ids DISTINCTS', occurrence: 1 },
  { fichier: 'src/state/port-sell-cargo.test.ts', ref: 'fn:drain', occurrence: 1 },
  { fichier: 'src/state/rest-flow.test.ts', ref: 'fn:walkCascade', occurrence: 1 },
  { fichier: 'src/state/rest-flow.test.ts', ref: 'fn:walkCascadeAbriFails', occurrence: 1 },
  { fichier: 'src/state/rest-flow.test.ts', ref: 'fn:walkNightChain', occurrence: 1 },
  { fichier: 'src/state/sea-voyage-flow.test.ts', ref: 'it:la Vigie SOURDE n’est PAS pénalisée au Test de Perception du phare (sense "vue" posé par kind "phare")', occurrence: 1 },
  { fichier: 'src/state/sea-voyage-flow.test.ts', ref: 'it:un équipage qui chante : base nue, chip de la chanson, cible fondue — aucun résidu', occurrence: 1 },
  { fichier: 'src/state/sea-voyage-flow.test.ts', ref: 'it:voie « Navigation » : une base SOUTENUE qui franchit le plafond NOMME son écrêtage', occurrence: 1 },
  { fichier: 'src/state/sea-voyage-flow.test.ts', ref: 'it:« Navigation » retenue → un Test MONO de Voile/Ramer, et la journée continue pareil', occurrence: 1 },
  { fichier: 'src/state/tavern-lancers.test.ts', ref: 'it:PARTIE ENTIÈRE à graine réelle : elle conclut sans borne, et le score annoncé est celui du tableau', occurrence: 1 },
  { fichier: 'src/state/tavern-lancers.test.ts', ref: 'it:le départage RAW des boules reste le match nul (l.57)', occurrence: 1 },
  { fichier: 'src/state/tavern-lancers.test.ts', ref: 'it:à SCORE ÉGAL, la volée passe par le départage DÉCLARÉ (jamais une égalité recodée)', occurrence: 1 },
  { fichier: 'src/state/tavern-middenball.test.ts', ref: 'fn:choisir', occurrence: 1 },
  { fichier: 'src/state/tavern-middenball.test.ts', ref: 'it:GRAINE RÉELLE (aucun DR posé) : une partie entière se déroule, six tours, un vainqueur nommé', occurrence: 1 },
  { fichier: 'src/state/tavern-middenball.test.ts', ref: 'it:la partie dure SIX tours (deux mi-temps de trois) et se dénoue sur le compte des buts', occurrence: 1 },
  { fichier: 'src/state/tavern-regime-rapide.test.ts', ref: 'fn:drain', occurrence: 1 },
  { fichier: 'src/state/tavern-torchon.test.ts', ref: 'it:GRAINE RÉELLE (aucun DR posé) : la partie entière se déroule et se dénoue', occurrence: 1 },
  { fichier: 'src/state/travel.test.ts', ref: 'fn:drainCascade', occurrence: 1 },
  { fichier: 'src/state/victoryCondition.test.ts', ref: 'fn:drainCombatEndCascade', occurrence: 1 },
  { fichier: 'src/state/voyage-cadence.test.ts', ref: 'it:chaque contributeur porte sa paire Compétence + son rôle en ID (provenance)', occurrence: 1 },
  { fichier: 'src/ui/SequencePanel.test.tsx', ref: 'it:Middenball : le tableau de marque porte le score PAR ÉQUIPE (buts) et la somme du tour', occurrence: 1 },
]
