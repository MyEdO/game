# Contrat du pont `wfrpPont` (v2, #2928)

Godot est un hôte du noyau, au même titre que l'hôte texte (`src/hoteTexte/`) : il envoie des gestes et lit une vue faite des lecteurs du noyau. Le pont (`pont.ts`) ne porte aucune règle ; il passe par le module commun des hôtes (`src/hote/`). Plan : `docs/plans/2026-10-21-vague6-hote-godot.md`. Les tests `*.hors-store.test.ts` de ce dossier vérifient ce contrat.

## Transport

- La page charge le bundle `wfrp-pont.js` (`node hotes/godot/construire.mjs --pont-seul --sortie <dossier>`), qui expose `globalThis.wfrpPont`. Le bundle lit les API de navigateur que déclare `API_DU_NAVIGATEUR` (`construire.mjs`) ; la construction l'exécute dans un contexte qui ne porte qu'elles, et la CI rougit si `demarrer` ou `vue` n'y répondent pas `ok: true`.
- `wfrpPont.appeler(methode, entree?)` est la seule fonction du pont. `methode` est le nom d'une méthode ; `entree` est une chaîne JSON qui encode un objet, ou rien (absente ou `null`) pour une méthode sans entrée. Elle rend toujours une chaîne JSON.
- La réponse vaut `{ "ok": true, … }` ou `{ "ok": false, "erreur": { "categorie", "message" } }`. `appeler` ne lève jamais.
- Une clé de l'entrée que la méthode ne lit pas se refuse.

## Erreurs

| `categorie` | Cas |
|---|---|
| `validation` | méthode inconnue (le message nomme les méthodes) ; entrée illisible, qui n'est pas un objet, ou avec une clé hors contrat ; aucune partie avant `demarrer` ; second `demarrer` ; scénario inconnu, graine non entière ; verbe inconnu (le message nomme les verbes de la fenêtre qui tient la main et les voisins de nom) ; argument de forme fausse, en trop ou manquant, id que l'état ne désigne pas ; champ de contexte qu'une offre ne lit pas ; verbe qui lève ; intention hors de l'allowlist d'un siège ; jeton inconnu ou déjà repris |
| `permission` | intention d'un siège qui ne tient pas la main |
| `regle` | barre non ouverte (sa raison) ; offre que l'énumérateur ne rend pas ou qu'aucun candidat ne désigne ; offre fermée (sa raison) |
| `interne` | levée qu'aucun contrôle n'attendait |

Les trois premières catégories sont celles du module commun (`CategorieDErreur`, `src/hote/partie.ts`) ; le texte de chaque message vient de lui ou du noyau.

## Méthodes

| Méthode | Entrée | Réponse `ok: true` |
|---|---|---|
| `demarrer` | `{ scenario, graine? }` : l'id d'un scénario de test du catalogue (`testScenarios`), la graine des dés (entier, 1 par défaut) | une `Suite` : le lancement du scénario |
| `vue` | aucune | `{ vue }` |
| `jouer` | un geste : `{ offre, ctx? }` (une offre du registre et son contexte) ou `{ type, args?, siege? }` (un verbe de la partie, ses arguments, le siège qui le joue) | une `Suite` |
| `reprendre` | `{ jeton }` : le numéro d'un jeton programmé | une `Suite` : la reprise du jeton |
| `erreursGlobales` | aucune | `{ erreurs: { message, source }[] }` : les événements `error` et `unhandledrejection` de la page depuis le dernier relevé, puis vidés ; `source` vaut `fichier:ligne`, `unhandledrejection` ou `null` |

`demarrer` ouvre la partie une seule fois par page : un second appel se refuse, et recommencer, c'est recharger la page. Un `demarrer` refusé n'ouvre rien.

Les gestes de la modale d'attaque sont des verbes de la partie, joués par `jouer` : quand `vue.attaque` n'est pas `null`, ce sont les verbes de `projection.fenetre.verbes` (`fenetreDuJeu`), réglages du jet compris (`FENETRE_DU_JET`, `src/noyau/combatAuto.ts`). Chaque verbe de la partie et ses paramètres viennent du registre dérivé du noyau (`src/hote/verbes.generated.ts`, produit par `scripts/gen-verbes.mjs`) : ni le pont ni ce contrat n'en nomment aucun.

## Suite

```ts
type Suite = {
  vue: Vue;
  programmes: { id: number; delai: number }[];
  journal: LigneDuJournal[];
};
```

- `programmes` : les jetons que l'appel a programmés, chacun numéroté dans l'ordre d'arrivée (`tenueDesJetons`, `src/hote/partie.ts`). Godot arme un minuteur de `delai` millisecondes, puis appelle `reprendre { jeton: id }`. Un jeton se reprend une seule fois.
- `journal` : les lignes que l'appel a écrites, `{ de: 'journal', texte }` ou `{ de: 'combat', evenement }` (`LigneDuJournal`, `src/noyau/partie.ts`).

## Vue

```ts
type Vue = {
  projection: Projection;          // projeter, src/hote/projection.ts, sans borne
  attaque: FenetreDAttaque | null; // fenetreDAttaque, src/noyau/fenetreDAttaque.ts
  cases: { zone: string; case: { x: number; y: number }; cout: number }[]; // casesAtteignables
  plateau: { w: number; h: number; infranchissables: { x: number; y: number }[] } | null; // plateauDeLaScene
  champ: string[];                 // CLICS_DU_CHAMP
  parametres: Record<string, ParametreDeVerbe[]>; // VERBES, src/hote/verbes.generated.ts
};
```

- `projection` est la projection commune aux hôtes, sans borne : Godot reçoit chaque liste entière. Ses champs sont des données, jamais du texte mis en forme. Elle porte notamment `fenetre` (`fenetreDuJeu` : la clé de la fenêtre qui tient la main, son propriétaire, ses verbes, l'id que ses verbes prennent en premier argument), `jets` (`jetsEnVue`), et `combat`, avec `barre` (`etatDeLaBarre` : `{ forme, raison }`), `offres` (`offresDeLActif`), `cibles` (`validTargets`), `apercu` (`battle.preview` : `{ genre, cible, case, cout }`) et `voisins` (tous les combattants, chacun avec ses États `{ id, valeur }`).
- `attaque` est la fenêtre d'attaque en données, `null` sans attaque en attente.
- `cases` liste les cases que le champ peint au tour de l'actif (`porteesDuTour`), et rien hors de ce tour.
- `plateau` est le plateau de la scène (`plateauDeLaScene`, `src/noyau/monde/scene.ts`) : ses dimensions et les cases que nul ne franchit à pied ; `null` sans scène.
- `champ` nomme les verbes d'un clic du champ (une entité, une case) ; l'hôte choisit celui dont le premier paramètre a la forme de ce qu'il désigne.
- `parametres` donne les paramètres de chaque verbe que la vue offre, ceux de la fenêtre et ceux du champ (`ParametreDeVerbe`, `src/hote/formes.ts`) : l'hôte en déduit quel contrôle rend quel verbe.

Une fenêtre que Godot ne dessine pas encore se rend depuis `projection.fenetre` : sa clé, et ses verbes en boutons.

## Écran publié

Chaque vue mise en page, Godot pose `globalThis.wfrpEcran = { pas, boutons: { texte, x, y }[], cases: Record<"x,y", [x, y]> }` : le texte et le centre de chaque bouton actif, le point de l'écran de chaque case du plateau. La recette du tour complet (`hotes/godot/recette.mjs`) y lit où cliquer ; elle observe la partie par `vue` et ne joue aucun geste par le pont.
