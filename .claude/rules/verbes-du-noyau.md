---
paths:
  - "src/noyau/actionsDuNoyau.ts"
  - "src/noyau/machinerieDuNoyau.ts"
  - "src/noyau/rollFlowSpecs.ts"
  - "src/noyau/flowVerbs.ts"
  - "src/noyau/intentionsDeSiege.ts"
  - "src/noyau/modalArbiter.ts"
  - "src/noyau/combatAuto.ts"
  - "src/noyau/designations.ts"
  - "src/noyau/reglagesDuJet.ts"
  - "scripts/gen-verbes.mjs"
---

# Verbes du noyau : une API

Tout membre de `ActionsDuNoyau` est un verbe que tout hôte joue (`src/hote/geste.ts`). Modèle : `jet<Verbe>(flux, …)`, un verbe par geste, la fenêtre en argument, ce qu'elle accepte à `FLOW_VERBS`. Épique #3366.

- Avant un verbe neuf, cherche celui du geste dans `src/hote/verbes.generated.ts` : on l'étend.
- Un verbe est ce qu'un siège envoie ou qu'un hôte joue (`invité`, `hôte`, `local`). Une lecture est un sélecteur. Une écriture du noyau, de l'éditeur ou d'un test est un membre de `MachinerieDuNoyau`, que seul un `Get<JeuDuNoyau>` atteint, absent d'`Intention` et de `VERBES`, ou un `Scene → Scene` de l'éditeur, scène hors store (`sceneEdit.ts`). Un commit de clic est machinerie, le clic le verbe (`cliquerLaCase`). #3370
- Aucun verbe propre à une fenêtre (fermer, régler, choisir, valider, « tout faire ») : elle se déclare dans sa table (`MODAL_DEFS`/`HORS_MODAL`/`SURFACES_HORS_PENDING`, `FLOW_VERBS`) et le verbe générique la prend en premier argument. Un réglage de jet se déclare à `ReglagesDuJet` (forme absolue de sa valeur) et `REGLAGES_DU_JET` (phase, portée, offre), son corps à `CorpsDesReglages` : `jetRegler(flux, reglage, valeur[, pid])`, axe d'un flux sans dé compris (`horsDuJet`). Une fenêtre qui se valide ou se ferme déclare `validation` ou `sortie` à son registre (et qui la joue), son corps à `ValidationsDeFenetre` ou `SortiesDeFenetre` : `fenetreValider(fenetre)` ou `fenetreFermer(fenetre)`, le quorum marquant le siège prêt (`jouerOuMarquer`, #3369). Une fenêtre à choix déclare chaque axe à `ChoixDesFenetres` (forme de sa valeur) et `CHOIX_DES_FENETRES` (effet, joueur, portée), les valeurs que l'état ouvre à `OUVERTS_DU_CHOIX`, son corps à `CorpsDesChoix` : `fenetreChoisir(fenetre, axe, valeur[, pid])`, `pid` le héros d'une rangée (#3369). Un réglage de jet déclare le même effet.
- « Tout » est la rangée omise, jamais un verbe `*All` : `jetLancer('cascade')` résout la cascade, un réglage de rangée `toutes` vaut pour les rangées du siège. `jetValider(flux)` valide un jet.
- Un geste, un verbe : le contexte (combat, lieu, joueur ou automatique) et ses écarts de règle se lisent à l'état, pas chez l'appelant. Aucune paire ni préfixe de contexte (`battle*`/`ooc*`, `port*`/`land*`). #3371
- Arguments. **Ordre** : fenêtre ou flux ; acteur requis si l'objet ne le porte pas ; objet du geste ; options ; en dernier, facultatifs, la rangée (`pid`) et l'acteur dérivé du tour ou du meneur. **Un nom, un type désigné** : `partieLue` lève (paramètres, champs d'objets anonymes ; un champ de type nommé, par son type). **Un rôle, un nom** : au texte (le type tranche). **Spécialisation** : saisie libre → `RefDesignee<IdDe…>` en un argument ; offre fermée → clé désignée (`IdDEntrainement`) ; jamais de `spec` positionnel. **Libellés** : `parametre.<nom>` ou `parametre.<verbe>.<nom>`, typés par `NomDeParametre`. Ce qui existe se désigne par son `IdDe…` (`designations.ts`), à toute profondeur, jamais `string` nu (`gen-verbes` lève ; texte : `TexteLibre`), ni libellé, ni objet entier d'appelant, hors ce que le geste crée (`HorsDesignation`) ou acquitte (`marquerLesIndices`, #2415).
- Nom : en français (#3366), `<action>` ou `<action><Complément>`, l'action au lexique fermé (`ActionDuLexique`, `jet<Action>…`, `fenetre<Action>`) ; ids de domaine (littéral, axe), d'offre (`actions.json`), littéraux de paramètre en mots de `MotDuLexique` (#3614), verrouillés par `fabriquesDuNoyau.ts` et `partieLue` ; le nom d'un verbe de jet ne vit qu'à `NOM_DU_VERBE_DE_JET` (`flowVerbs.ts`). Tout mot neuf passe en revue. Une table coop a pour clé un verbe typé (`EntreeDeRoute`).
