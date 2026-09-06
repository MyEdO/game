# Vision du produit

> Référence VIVANTE, validée par l'utilisateur. Chaque phrase s'appuie sur un verbatim utilisateur
> daté ou sur un fait du dépôt, entre crochets. Tout ticket, brief ou verdict nomme l'ÉTAGE qu'il
> touche et le PROFIL qu'il sert. Une phrase qui n'a plus de porteur se corrige ici, jamais dans un
> ticket. Établie le 2026-09-06 après confrontation d'un juge en lecture seule
> (arbitrages du même jour par question fermée).

## Ce qu'est ce projet

Un **moteur de jeu de rôle Warhammer Fantasy 4e**, 100 % web, sur le modèle de Neverwinter
Nights : trois étages superposés, et non un jeu unique. [« Il faut voir le jeu comme NWN, un moteur
de jeu gérant les régles du jeu », 2026-09-06] Il assume sa parenté avec la **table virtuelle** :
« L'outil peut etre utilisé comme Foundry, donc un outil pour simuler une partie de JDR »
[2026-09-04], et la vue tactique se lit « comme si on était sur un logiciel tabletop » [2026-08-12].
La différence avec une table virtuelle : le moteur sait jouer seul quand personne ne tient le siège.

### Étage 1 : le moteur

Il applique les règles des livres, et il **tranche** ce que les livres laissent au maître de jeu :
chaque trou reçoit une valeur explicite, éditable, taguée `maison`. [« qui doit trancher sur les
trous des régles ou les "arbitrages MJ" », 2026-09-06 ; 27 des 81 règles optionnelles portent
`maison`, `docs/regles-optionnelles.md`] Aucune règle ne vit en code : elle vit en donnée.
[`src/engine/policy.ts`, `src/data/reglesOptionnelles.json`] La règle stricte 7 « Pas de MJ » désigne
**ce** niveau, le moteur ne renvoie jamais une décision à un arbitre humain absent, et jamais les
sièges d'une partie. [`CLAUDE.md` règle stricte 7, relue le 2026-09-06 : « Le "Pas de MJ" ici sert un
autre propos »]

### Étage 2 : le scénario

Il est créé dans l'éditeur, jamais en code ni par script. [« les scénarios qui sont créé depuis
l'éditeur », 2026-09-06 ; règle stricte 2 ; fiche `user-doctrine-campagne-jamais-generee-par-script`]
Il déclare les **modules** qu'il ouvre. Un module est un élément optionnel des livres, une activité,
un voyage en étapes, une navigation, un siège, que l'**auteur** du scénario active : « Aujourd'hui on
a des régles optionnelles qui sont juste des éléments qu'un MJ peut utiliser s'il le souhaite, comme
les activités, le voyage en étape, et ainsi de suite. Actuellement c'est géré en régles optionnelles
activable par le joueur, ce qui n'a aucun sens. » [2026-09-06] Le registre des règles optionnelles est
le catalogue des modules ; l'activation vit **dans le scénario, sans dérogation** : l'auteur décide
dans l'éditeur, la partie ne peut pas changer. [option retenue 2026-09-06] État du dépôt : ce porteur
n'existe pas encore, le document de projet (`ProjectDoc`, `src/state/worldMap.ts`) ne déclare aucune
règle et l'activation vit dans le stockage local du navigateur (`src/state/houseRules.ts`). C'est une
dérive à corriger, pas une question ouverte.

L'Ennemi Intérieur est **un** scénario, pas la définition du produit. [« on ne joue pas spécialement
a l'ennemi intérieur », 2026-09-06 ; six dossiers de scènes livrés, un seul adossé à EDO] La Diligence
est le banc du moteur. [« la diligence a été créé principalement pour s'assurer que le moteur sache
construire ce batiment », fiche `user-doctrine-campagne-jamais-generee-par-script`]

### Étage 3 : la partie

On y joue seul ou à plusieurs sièges. [« les joueurs qui jouent au scénario en solo ou en groupe »,
2026-09-06] Un siège peut tenir l'environnement et les ennemis : il **voit** leurs jets, peut les
**fixer**, et **pilote** les ennemis, l'IA se retirant pour lui. [option retenue 2026-09-06 « Voir et
fixer, ET piloter les ennemis » ; `worldSeat` dans `src/state/netOwnership.ts`] Les dés se fixent quand la partie est
configurée pour, c'est un confort déclaré, jamais une règle du livre. [« avec les dés fixés ou non »,
2026-09-06 ; `src/engine/fixedDie.ts`] Tout dé passe par la même porte, aucune famille de jet n'en est
exemptée. [« tous les jets passent par le même point d'entrée », 2026-09-04 ; dette résiduelle
mesurée : neuf dés d'environnement encore silencieux, #1508]

## Qui joue

**Le consommateur de RPG** joue le scénario comme il jouerait n'importe quel jeu de rôle. [« un
joueur qui … joue au scénario comme il consommerait n'importe quel RPG », 2026-09-06]

**L'apprenant** vient pour apprendre les règles : tout ce qu'il lit est le texte du livre, jamais une
reformulation, et chaque jet dit son pourquoi. [« un joueur qui veux apprendre les régles du jeu »,
2026-09-06 ; « Codex + tracabilité », 2026-09-06 ; règle stricte 5 ; #1117 fermé le 2026-08-13]

**Le maître de jeu** simule sa table, avec ou sans ses joueurs connectés, en tenant le siège du monde.
[« un MJ qui utilise le module pour "simuler" sa table virtuel, avec ou sans ses joueurs connectés »,
2026-09-06]

**Le créateur de contenu** modifie les règles et ajoute des éléments, scénarios compris. [« les gens
qui veulent proposer du contenu en modifiant les régles/ajouter des éléments », 2026-09-06] Tout ce
qu'il touche est une donnée éditable, jamais du code, et son contenu circule **en paquet exporté de
l'éditeur et importé ailleurs** : règles, données, scénarios. [option retenue 2026-09-06 ; une campagne
est un JSON portable auto-suffisant, fiche `game-campagne-json-portable-frontiere-reference-narratif`]
État du dépôt : la persistance de l'éditeur est réservée au développement (`src/data/fsPersist.ts`),
le chemin d'export et d'import n'existe pas encore.

## Ce qui tient l'édifice

- **Une règle est une donnée, jamais une ligne de code.** [credo « Rien de hardcodé » ; 81 règles en
  JSON] Un arbitrage que le livre laisse au MJ est une donnée taguée `maison`, éditable.
- **Toute logique est keyée par identifiant ; le libellé est de l'affichage.** [`CLAUDE.md`, doctrine
  id/label du 2026-07-09] La donnée elle-même sera multilingue : « Je compte bien ajouter la VO qui est
  deja dans les sources en plus de la VF » [2026-09-06]. La consigne « ne jamais lire ni citer la VO
  ici » du `CLAUDE.md` § Sources est une règle de la phase française, pas du produit.
- **Trois regards égaux sur le même monde** : isométrique, plateau vu du dessus, première personne.
  [option retenue 2026-09-06 ; `src/gameIso/stage/viewPolicy.ts`] Le rendu consomme l'état sans le
  posséder.
- **Ce qu'un scénario demande se construit dans l'éditeur, jamais par script.**
- **Le texte de règle affiché est celui du livre**, verbatim recollable au `Source/`. [règle stricte 5]
  Les libellés d'interface, eux, se traduisent.
- **Les invariants sont des portes qui refusent, pas de la prose qui recommande.** [credo « Un audit se
  clôt par des GARDES, pas par une purge » ; #1318 axe D]

## Écarts connus entre la vision et le dépôt (2026-09-06)

| Écart | Où | Statut |
|---|---|---|
| Activation des modules chez le joueur, pas dans le scénario | `src/state/houseRules.ts` | dérive, à porter par le scénario |
| Neuf dés d'environnement silencieux | porte des jets | dette #1508 |
| Persistance de l'éditeur réservée au développement | `src/data/fsPersist.ts` | chemin d'export et d'import à créer |
| Paragraphe « Ce qu'est ce projet » du `CLAUDE.md` | daté du 2026-06-04 | à remplacer par un renvoi ici |
| Consigne « jamais la VO » | `CLAUDE.md` § Sources | à réécrire quand la VO entre |
