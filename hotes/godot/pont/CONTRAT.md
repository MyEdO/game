# Contrat du pont `wfrpPont` (v7, #2928, #2948, #3086)

Godot est un hôte du noyau, au même titre que l'hôte texte (`src/hoteTexte/`) : il envoie des gestes et lit une vue faite des lecteurs du noyau. Le pont (`pont.ts`) ne porte aucune règle ; il passe par le module commun des hôtes (`src/hote/`). Ticket : #2928. Les tests `*.hors-store.test.ts` de ce dossier vérifient ce contrat.

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
| `modeles` | `{ manifestes, osDesRigides }` : un objet id de modèle → manifeste et un objet id de modèle → liste d'os, ceux du listage servi (`GET modeles/`, section « Atelier 3D ») | `{ bases, glb, refus }` : les modèles de l'atelier (`modelesDeLAtelier`, `atelier.ts`), sans partie |
| `erreursGlobales` | aucune | `{ erreurs: { message, source }[] }` : les événements `error` et `unhandledrejection` de la page depuis le dernier relevé, puis vidés ; `source` vaut `fichier:ligne`, `unhandledrejection` ou `null` |

`demarrer` ouvre la partie une seule fois par page : un second appel se refuse, et recommencer, c'est recharger la page. Un `demarrer` refusé n'ouvre rien.

Les gestes d'une fenêtre sont des verbes de la partie, joués par `jouer` : ce sont les verbes de `projection.fenetre.verbes` (`fenetreDuJeu`), réglages et flux réactif compris (`FENETRE_DU_JET`, `src/noyau/combatAuto.ts`), chacun dessiné par `vue.fenetre`. Chaque verbe de la partie et ses paramètres viennent du registre dérivé du noyau (`src/hote/verbes.generated.ts`, produit par `scripts/gen-verbes.mjs`) : ni le pont, ni ce contrat, ni le GDScript n'en nomment aucun.

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
  projection: Projection;               // projeter, src/hote/projection.ts, sans borne
  equipements: Record<string, DessinDEquipement>; // par id de combattant
  couverture: { demandes: number; absences: AbsenceDeModele[] };
  fenetre: FenetreADessiner | null;     // fenetreADessiner, src/hote/gestes.ts
  attaque: FenetreDAttaque | null;      // fenetreDAttaque, src/noyau/fenetreDAttaque.ts
  defense: FenetreDeDefense | null;     // fenetreDeDefense, src/noyau/fenetreDeDefense.ts
  panneau: PanneauDuCombat | null;      // panneauDuCombat, src/hote/ecran.ts
  cases: { zone: string; case: { x: number; y: number }; cout: number }[]; // casesAtteignables
  plateau: { w: number; h: number; infranchissables: { x: number; y: number }[] } | null; // plateauDeLaScene
  champ: { combattant: string; case: string }; // CLICS_DU_CHAMP
};
```

- `projection` est la projection commune aux hôtes, sans borne : Godot reçoit chaque liste entière. Ses champs sont des données, jamais du texte mis en forme. Elle porte notamment `fenetre` (`fenetreDuJeu` : la clé de la fenêtre qui tient la main, son propriétaire, ses verbes, l'id que ses verbes prennent en premier argument), `jets` (`jetsEnVue`), et `combat`, avec `barre` (`etatDeLaBarre` : `{ forme, raison }`), `offres` (`offresDeLActif`), `cibles` (`validTargets`), `apercu` (`battle.preview` : `{ genre, cible, case, cout }`) et `voisins` (tous les combattants, chacun avec ses États `{ id, valeur }`).
- `fenetre` est la fenêtre qui tient la main, prête à dessiner, en mots du joueur : son titre, son étape et qui tient la main (`proprietaire` : `{ genre: 'tous' }`, `{ genre: 'aucun' }` ou `{ genre: 'porteur', nom }`, `nom` à `null` quand l'état ne nomme pas le porteur ; Godot n'en dit que le nom), son corps en lignes (`corpsDeLaFenetre` : qui agit contre qui, les jets à jeter ou tombés, le DR net, l'issue), et un geste par verbe de `projection.fenetre.verbes`, dans le même ordre. Un geste porte son libellé, chacun de ses arguments (posé par la fenêtre, ou à saisir en choix, nombre, texte, objet ou JSON, avec ses valeurs nommées, ses bornes et sa valeur courante), son rendu (`bouton`, `choix`, `liste`, `formulaire` ; un argument requis, ou optionnel à valeurs nommées, est à dire), l'argument d'un `choix` ou d'une `liste` (`aChoisir`), `attendu` (le geste que la politique de la fenêtre joue maintenant) et `ouvert` (faux pour un réglage que la fenêtre lue qui le règle — attaque, Défense, butin, opération — ne nomme pas maintenant). Godot dessine chaque geste ouvert d'après son rendu ; aucun verbe n'est rendu par une liste écrite à la main.
- `attaque` et `defense` sont les fenêtres d'attaque et de la Défense en données, `null` hors de leur attente.
- `panneau` est le panneau du combat en mots du joueur : le round et le tour, la fiche de l'actif, la raison d'une barre fermée (`null` quand une fenêtre tient la main), ce que l'aperçu du premier clic coûte, la fin du combat, le titre du journal et le libellé de chaque offre par son id ; `null` hors combat.
- `cases` liste les cases que le champ peint au tour de l'actif (`porteesDuTour`), et rien hors de ce tour.
- `plateau` est le plateau de la scène (`plateauDeLaScene`, `src/noyau/monde/scene.ts`) : ses dimensions et les cases que nul ne franchit à pied ; `null` sans scène.
- `champ` nomme le verbe du clic du champ qui désigne un combattant, et celui qui désigne une case.

## Équipement et couverture des modèles

Chaque combattant (`combat.actif` et `combat.voisins.liste`) porte `equipement`, le résultat de `equipementDessine` : `weapons`, `rangees`, `armour`, `shield?` et `cape?`. Les armes portent les `candidats` ordonnés. Seules les armes tenues (`weapons`) portent une `hand` obligatoire (`main` ou `off`) ; les armes rangées n'ont pas de main. `equipDe` attribue les mains une seule fois : les mains explicites du loadout sont réservées avant les armes sans main du statbloc, qui prennent `main` puis `off` ; un bouclier demande `off`. Les attaques naturelles ne réservent aucune main. Une arme à deux mains réserve les deux mains et reste un seul objet, attaché à sa main directrice. Le surplus graphique est publié dans `rangees`, sans modifier les armes persistées ni leurs règles de combat. L'ordre relatif des armes sources est conservé dans chaque liste publiée ; `armePrincipale` désigne la première arme non-bouclier, naturelle comprise. L'appel isolé `armeDeDessin` passe par cette même attribution avec une seule arme. Le bouclier est déjà une arme tenue et `shield` en reprend les candidats. `cape` est un booléen, les pièces d'armure portent une matière ; ces deux champs ne déclarent pas de candidats de modèle.

`equipements[id]` contient `tenues` et `rangees` : chacune est une liste `{ arme, modele, palette }`, sans les armes naturelles dessinées par le corps. `arme` est la projection du noyau. `palette` est la palette résolue de `arme.teinte` par `findTeinteById`, lecteur public du noyau, ou `null` sans teinte. Les instances conservent uniquement l'id stable de teinte ; Godot ne lit aucun catalogue. `modele` est `null` si aucun candidat n’a de modèle ; sinon `{ apparence, composants: { modele, composant, pieces }[] }`, avec le premier id compatible dans l’ordre publié. Pour une arme tenue, le pont choisit le premier composant dont `montage.composants[id].prise` correspond à `arme.hand` ; pour une arme rangée, le premier qui déclare un `rangement`. Toutes les pièces de ce composant forment l’objet publié. Si un candidat n’a aucun composant compatible, le candidat suivant est essayé ; si aucun ne convient, `modele` vaut `null` et l’absence porte la liste entière des candidats. Godot ne départage aucune alternative de modèle ni de main.

L’index est dérivé au build Vite des `components.<id>.apparence` et des pièces de chaque manifeste sous `projet/modeles/*.manifeste.json`. Aucun index de modèles n’est commité. Les composants corporels (`apparence: null`) et les composants sans pièce ne sont pas des modèles d’objet disponibles.

`couverture` est le rapport de la vue courante, recalculé à chaque appel : `demandes` compte les objets tenus ou rangés à dessiner ; chaque absence porte `{ porteur, emplacement: 'tenues' | 'rangees', position, candidats }`. Le bouclier est compté une fois, parmi les armes tenues. Une absence totale reste publiée, avec `modele: null` et tous les candidats demandés.

## Montage des pièces dans Godot

Chaque manifeste déclare `montage.attaches` (`main`, `off`, `dos`, `ceinture`) : pour chaque attache, un `os` du skin, une `position` en mètres et une `rotation` en radians, deux vecteurs à trois composantes finies. `montage.composants` associe les composants d’armes à une `prise` (`main` ou `off`), un `rangement` (`dos` ou `ceinture`) et des `matieres: { cle, piece, surface }[]`. `cle` appartient au vocabulaire de palette du noyau ; `piece` nomme un nœud de ce composant ; `surface` est l'indice de primitive glTF, entier positif ou nul, avec un matériau existant. Deux clés ne peuvent pas teinter la même surface. Ce montage est requis au parse et contrôlé contre le GLB par la validation de Release. Les pièces sont rigides sans skin, directement sous l’os de leur prise déclarée.

Godot applique chaque clé présente dans la palette aux surfaces déclarées, par un `BaseMaterial3D` dupliqué et un `surface_override_material` propre à la pièce montée. La couleur d'albédo multiplie la texture conservée ; ni le mesh ni son matériau partagé ne sont modifiés. Les sept pièces d'arme de `Knight.glb` n'ont qu'une surface, matériau `knight_texture` : elle reçoit `metal`. Cet atlas ne fournit pas de surfaces séparées pour `cuir` et `accent`. Le Skeleton n'a pas de pièce d'arme déclarée et monte celles des modèles donneurs. Les pièces d'armure du porteur ne sont pas sélectionnées ni teintées depuis `armour[]` par cet hôte.

Le plateau transmet `equipements[id]` au combattant depuis la vue reçue. Le modèle du porteur vient du manifeste de son camp. Les pièces d’armes de ce modèle, désignées par `montage.composants`, sont masquées ; leurs remplaçantes sont les seules pièces nommées par `modele.composants[].pieces`, chargées depuis les modèles donneurs publiés. Pour une arme tenue, la prise publiée doit être compatible avec le portage de son composant. Pour une arme rangée, la prise ne contraint pas le montage ; son rangement déclaré désigne l’attache. Un `modele: null` ne produit aucun nœud ; son absence reste dans `couverture`. Un composant incompatible avec la prise publiée est refusé avec `prise-incompatible`, sans sélection ni repli supplémentaire dans Godot.

La recette native `projet/recettes/equipement.gd` reçoit une vue JSON figée par `figer-recette-equipement.mjs`. Elle contrôle les nœuds montés et leurs os, l’absence de skin des pièces donneuses, le masquage des armes du porteur et les absences de modèles, sans serveur ni navigateur. Son objet de campagne à plusieurs formes traverse `Partie.lancer`, `etat.campaignNarratif` et la projection du pont ; la recette contrôle son montage à partir des candidats de son apparence donnée. Son objet teinté contrôle la couleur du matériau local contre la palette publiée ; l'autre instance du même modèle reste vivante et son matériau est contrôlé intact après tous les montages.

## Atelier 3D

L'atelier dessine les bases et leurs éléments d'après la réponse de `modeles`, jamais en relisant les manifestes lui-même. Le pck exporté est figé : l'atelier tire les modèles par HTTP, à côté de `index.html`, et un GLB réexporté se recharge à chaud. Le serveur de l'export (`hotes/godot/servir.mjs`) sert :

- `GET modeles/` : le listage, `{ manifestes: Record<id, manifeste>, osDesRigides: Record<id, string[]>, erreurs: string[] }`, relu à chaque appel, en `Cache-Control: no-store`. `manifestes` ne porte que les manifestes que `verdictsDesModeles` (`asset/modeles.ts`, la validation de `recupererModeles`) accepte contre leur GLB. `osDesRigides` porte, pour chaque manifeste de `manifestes`, les os qui portent ses meshes rigides : les noms sans doublon des parents de `parentDesRigides` (`lireGlb`, `asset/glb.ts`), liste vide pour un modèle dont aucun mesh non skinné ne pend à un os d'un skin. `erreurs` porte, une ligne chacun, le manifeste illisible, le GLB illisible, le refus d'un manifeste et le dossier des modèles illisible. Godot passe `manifestes` et `osDesRigides` tels quels à `modeles`, qui ne les revalide pas : la validation et la lecture des os lisent le GLB, que seul le serveur détient.
- `GET modeles/<fichier>` : chaque fichier du dossier des modèles (manifeste, GLB), servi en `Cache-Control: no-store`. Un chemin hors du dossier ou qui ne s'ouvre pas en fichier reçoit 404.
- Une URI malformée reçoit 400. Le serveur continue après toute requête défaillante.

La réponse de `modeles` :

```ts
type ModelesDeLAtelier = {
  bases: { id: string; empreinte: string; points: PointDAccroche[] }[];
  glb: Record<string, string>;
  refus: string[];
};
type PointDAccroche = { id: string; genre: 'emplacement' | 'prise'; attache: { os: string; position: [number, number, number]; rotation: [number, number, number] }; elements: string[] };
```

- `bases` : les bases de l'index (base, clé) → élément (`indexerModeles`, `asset/modeles.ts`). Les `points` d'une base listent ses `emplacements`, puis ses `prises`. À chaque point vont les ids des éléments de cette base liés en `liaison.mode === 'rigide'` dont `osDesRigides` contient `attache.os` du point (`.claude/skills/creer-un-personnage-3d/references/procedure.md`, rigide tenu ; `asset/evaluateur/evaluer.ts`, `monter` ; `asset/montage.ts`, `attache-incompatible`). Un rigide dont aucun mesh ne pend à un os (décor, véhicule, mesh à la racine) n'a aucun point, comme un élément lié au `squelette` ou en `surface`. `empreinte` vaut `glb.sha256` de la base.
- `glb` : le fichier, sous `modeles/`, de chaque base et de chaque élément d'un point (`fichiersDuModele(id).glb`).
- `refus` : ceux de l'index (`[base-absente]`, `[cle-en-doublon]`, `[base-en-doublon]`, `[forme]`). Un manifeste qui n'est pas du schéma 3 est ignoré.

Au montage d'un élément à un point, Godot fait passer chaque mesh du GLB sous un os sous l'os de la base de même nom, à sa position locale, comme l'évaluateur (`asset/evaluateur/evaluer.ts`, `monter`).

## Écran publié

L'entrée de l'application est un menu (`scenes/Accueil.tscn`, `run/main_scene`) à deux boutons, « Combat » et « Atelier ». Arbitrage utilisateur, 2026-10-28 : « A terme le menu de l'application passera aussi par godot et il existera un bouton du menu pour aller dans l'atelier ».

Chaque vue mise en page, Godot pose `globalThis.wfrpEcran`. Chaque publication remplace l'objet.

- Au menu : `{ boutons: { texte, x, y }[] }`, le texte et le centre de chaque bouton actif.
- Au combat : `{ boutons: { texte, x, y }[], cases: Record<"x,y", [x, y]> }`, plus le point de l'écran de chaque case du plateau.
- À l'atelier : `{ boutons: { texte, x, y, cle? }[], atelier: { base: string|null, empreinte: string|null, clip: string|null, instant: number|null, lecture: boolean, vitesse: number, montes: Record<point, element>, aides: { os: boolean, emplacements: boolean, prises: boolean }, erreurs: string[] } }`. `cle` est optionnelle : un bouton d'emplacement la porte, `"<point>/<element>"` ou `"<point>/vide"`, parce que son texte (« vide », un id d'élément) se répète d'une ligne à l'autre.

Les recettes de `hotes/godot/recette.mjs` partent du menu et ne jouent aucun geste par le pont. Le tour complet clique « Combat », puis y lit où cliquer ; il observe la partie par `vue`. L'atelier (`--parcours atelier`) clique « Atelier », lit ses boutons et son état dans `wfrpEcran`, et sert un dossier de modèles neuf que la recette remplit par `importer.mjs --sans-publier`.
