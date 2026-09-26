# Atlas RAW — Religion (Prières, Bénédictions, Miracles)

> Base de connaissance des **règles WFRP4 (RAW)**, consolidées sur les livres autorisés, à usage d'agent
> (vérifier que le code respecte le RAW). Chaque règle cite `LIVRE NN l.X-Y`
> (NN = préfixe du fichier de chapitre, l = lignes du `.md` source). **Voir aussi** tisse les renvois
> entre règles ; **Implémente** pointe le(s) module(s) `src/engine/` correspondant(s).
> Conventions d'abréviation : [`sources.md`](../sources.md). Index : [`00-index.md`](00-index.md).
>
> Scope : règles de Foi (Bienheureux, Bénédictions, Miracles), Points de Péché, Colère des dieux,
> table d100 Colère verbatim, structure des cultes et commandements.  
> **Hors-scope de ce fichier** : catalogue détaillé des bénédictions par culte (→ *catalogue séparé*),
> texte de chaque miracle par culte (→ *catalogue séparé*), commandements culte par culte (→ ch. 26-39).  
> **ZÉRO invention** — tout ce qui n'est pas citable est absent.
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

---

## Sommaire

- [La Foi — qui peut prier ?](#la-foi--qui-peut-prier-)
- [Bénédictions vs Miracles — différence mécanique](#bénédictions-vs-miracles--différence-mécanique)
- [Effectuer une Bénédiction ou un Miracle — procédure](#effectuer-une-bénédiction-ou-un-miracle--procédure)
- [Restrictions communes](#restrictions-communes)
- [Degrés de Réussite — bénéfices bonus Bénédictions](#degrés-de-réussite--bénéfices-bonus-bénédictions)
- [Degrés de Réussite — bénéfices bonus Miracles](#degrés-de-réussite--bénéfices-bonus-miracles)
- [Manifestations divines — visible vs discret](#manifestations-divines--visible-vs-discret)
- [Points de Péché — définition et accumulation](#points-de-péché--définition-et-accumulation)
- [Péché et Colère Divine — déclenchement](#péché-et-colère-divine--déclenchement)
- [Colère des dieux — déclencheur Maladresse](#colère-des-dieux--déclencheur-maladresse)
- [Table d100 — Colère des dieux (verbatim)](#table-d100--colère-des-dieux-verbatim)
- [Pénitence](#pénitence)
- [Retirer des Points de Péché](#retirer-des-points-de-péché)
- [Petites Prières — règle optionnelle](#petites-prières--règle-optionnelle)
- [Cultes — structure générale (renvoi)](#cultes--structure-générale-renvoi)
- [Commandements — système (renvoi)](#commandements--système-renvoi)
- [Implémente](#implémente)
- [Voir aussi](#voir-aussi)
- [Bilan de fidélité](#bilan-de-fidélité)

- **La Mer des Griffes (MDG)** <!-- MDG-INTEGRATION -->
- **Culte de Manann (MDG)** — commandements universels (renvoi WFJDR p.205), croyances communes (domaine du dieu en mer, conter ses exploits), commandements locaux, plafond de 3 bénédictions de navires par lune (−1d10 Humeur / +1 Point de Péché au-delà).
- **Miracles de Manann (8)** — Apaiser les eaux, Bénédiction de l'albatros (navire incoulable), Bénédiction du marinier (+1 DR Natation/Ramer/Voile), Contre-courants, Malédiction de la mer (+2 Dégâts), Navigation bénie, Repousser une créature marine, Respiration aquatique. + Sel sacré (50 %, 5 usages).
- **Culte de Stromfels (MDG)** — Dieu Requin / Naufrageur, culte = crime capital (Traité elfe 2150 CI) ; 4 commandements (dont contrainte d'avancement Force-d'abord) ; restriction des Talents par le Péché (Invocation ≥2, Béni ≥5) ; Bénédictions identiques à Manann ; pénitences.
- **Miracles de Stromfels (7)** — Faire fi de l'Humeur de Manann (table d10), Flairer le sang (Pistage Facile +40), Lame de fond (IC 15), Mal de mer, Malédiction de la maîtresse cruelle (Calme Complexe −10 / Exténué), Sacrifice à Stromfels (double Indice de Voie d'eau), Vents de tempête. Portées indexées sur la **Force** (≠ Sociabilité).

---

## La Foi — qui peut prier ?

**Sources RAW** : `LDB 40 l.5-10`

Deux Talents identifient les « Bienheureux » (terme officiel VF pour les personnages bénis par un dieu) :

| Talent | Capacité |
|---|---|
| **Béni** | Permet d'accorder des **Bénédictions** (manifestations mineures) |
| **Invocation** | Permet de pratiquer des **Miracles** (manifestations majeures) |

> « Un petit nombre de croyants se distingue de leurs pairs en étant, à priori, capables de faire
> appel à l'intervention directe de leur divinité sous forme de Miracles. »
> — LDB 40 l.5

Un personnage Béni obtient les six Bénédictions de son culte (liste par culte `LDB 41 l.29-41`).  
Un personnage avec Invocation peut pratiquer l'un des Miracles de son culte (liste par culte `LDB 42-43`).

---

## Bénédictions vs Miracles — différence mécanique

**Sources RAW** : `LDB 40 l.12-13`, `LDB 41 l.44-47`

| Aspect | Bénédictions | Miracles |
|---|---|---|
| Talent requis | Béni | Invocation |
| Visibilité | Subtiles, imperceptibles (chance aux yeux de qui ne possède pas Visions sacrées) | Manifestes, toujours accompagnées de signes sacrés visibles |
| Test | Prière Intermédiaire (+0) | Prière Intermédiaire (+0) |
| Compétence | Prière (Sociabilité) | Prière (Sociabilité) |
| NI requis | Non (succès simple suffit) | Non (succès simple suffit) |
| Contre-sort possible | Non (LDB 46 l.154 : ne cible pas) | Non (idem) |

Les Bénédictions restent généralement discrètes : seuls ceux qui possèdent le Talent **Visions sacrées** les perçoivent distinctement.

---

## Effectuer une Bénédiction ou un Miracle — procédure

**Sources RAW** : `LDB 40 l.12-13`

> « Pour proférer une Bénédiction ou un Miracle, effectuez un Test de **Prière Intermédiaire (+0)**. Sur un succès, votre Bénédiction, ou votre Miracle, se manifeste selon les règles, et un DR élevé vous donnera des effets bonus. Sur un échec, les mots sont prononcés, mais votre dieu, pour quelque raison que ce soit, refuse de les entendre. Si vous faites une Maladresse au Test de Prière, vous avez offensé votre dieu et vous devez effectuer un lancer sur le tableau de la Colère des dieux. »

**Compétence** : Prière → valeur = Sociabilité (ou bonus de Sociabilité selon la formule de compétence). `LDB 12 l.X` (Compétences avancées) + règle de défaut `LDB 40 l.101-101`.

**Parler est obligatoire** : la Prière doit être entonnée (parlée ou chantée) avec conviction. Un MJ peut imposer une Difficulté plus élevée si la Prière est murmurée ou sans conviction. `LDB 40 l.39-42` (Règle optionnelle « Prêchez, ma sœur ! »).

---

## Restrictions communes

**Sources RAW** : `LDB 40 l.16-19`

1. **Parole requise** : le personnage doit pouvoir s'exprimer pour entonner le rite.
2. **Une instance par Prière** : chaque Bénédiction/Miracle ne peut être actif qu'une seule fois simultanément par lanceur. Il faut attendre la fin d'une Prière avant de la relancer.
3. **Pas de cumul d'instances** : deux invocations de la même Prière par deux personnes différentes ne se cumulent pas (ex. deux Bénédictions de Finesse donnent toujours +10 en Dextérité, pas +20). `LDB 40 l.19`

---

## Degrés de Réussite — bénéfices bonus Bénédictions

**Sources RAW** : `LDB 41 l.20-27`

Pour chaque **+2 DR** obtenus au Test de Prière sur une Bénédiction, choisir **un** des bénéfices suivants :

| Option | Bonus |
|---|---|
| Portée | +6 mètres |
| Cibles | +1 cible |
| Durée | +6 Rounds |

Une même option peut être choisie plusieurs fois. Si la Durée est « Instantanée », l'option Durée n'est pas disponible.

> Exemple (LDB 41 l.27) : +4 DR sur Bénédiction de Guérison → soigner 3 cibles au contact, ou 2 cibles à 6 m, ou 1 cible à 12 m.

---

## Degrés de Réussite — bénéfices bonus Miracles

**Sources RAW** : `LDB 42 l.7-13`

Pour chaque **+2 DR** obtenus au Test de Prière sur un Miracle, ajouter la valeur de portée, durée ou cible **égale à celle indiquée dans la description** du Miracle. Donc un Miracle à portée 50 m gagne +50 m par +2 DR.

- **Portée/Cible « Vous »** : ne peut jamais être augmentée.
- **Pas de Durée** : l'option Durée n'apporte rien.
- Certains Miracles ont des bénéfices supplémentaires optionnels indiqués dans leur propre description.

---

## Manifestations divines — visible vs discret

**Sources RAW** : `LDB 41 l.44-47`

> « Les Bénédictions sont subtiles, imperceptibles à ceux qui ne possèdent pas le Talent Visions sacrées… Par contre, les Miracles se manifestent ouvertement, toujours accompagnés de signes ou de présages sacrés, qui devraient refléter la situation et la divinité pertinente. »

Exemples (non exhaustifs) : hurlements de loups spectraux pour Ulric, trempés d'eau salée pour Manann.

---

## Points de Péché — définition et accumulation

**Sources RAW** : `LDB 40 l.23-31`

Les Points de Péché représentent la disgrâce d'un Bienheureux aux yeux de son dieu.

- **Gain** : le MJ octroie 1 Point de Péché ou plus chaque fois que le personnage viole un commandement de son dieu.
- **Proportionnalité** : de 1 à 3 Points selon la gravité de l'infraction. Le MJ doit considérer l'ampleur de l'infraction.
  - Exemple (Myrmidia) : refuser de l'eau à un prisonnier = 1 Péché ; le battre = 2 Péchés ; le torturer/tuer = 3+ Péchés minimum.
- **Pas de maximum** : le total de Points de Péché est illimité.
- **Persistés** sur `Combatant.sinPoints` (entier ≥ 0).

> « Si vous violez n'importe lequel des commandements de votre dieu, le MJ vous octroiera un Point de Péché ou plus. »
> — LDB 40 l.25

---

## Péché et Colère Divine — déclenchement

**Sources RAW** : `LDB 40 l.35-36`

> « Chaque fois que vous effectuez un Test de Prière, si le dé des unités est inférieur ou égal à votre total actuel de Points de Péché, vous subirez la Colère des dieux, même si le Test de Prière est réussi. »

Règles précises :
- Ne s'applique que si le personnage **a péché** (sinPoints > 0). À 0 Points de Péché, aucun déclenchement automatique.
- Le **dé des unités** du jet d100 est comparé au total de Péché. Un résultat 00 compte comme unité = 0.
- Se cumule avec la Maladresse : une Maladresse déclenche la Colère des dieux **indépendamment** du Péché.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 40` (l.35-36) → `discreetPrayerDifficulty`, `peche`, `wrath-table`, `CastModal`, `liveTableDecl`, `giveSinSchema`, `prayerWrathTriggered`, `GameOp`, `FLOWS`, `prayer-conviction`, +42 — `src/data/characteristics.json`, `src/data/combat-stakes.json`, `src/data/miscast.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/magic.ts`, +11 fichiers

---

## Colère des dieux — déclencheur Maladresse

**Sources RAW** : `LDB 40 l.12-13`, `LDB 40 l.45-46`

La Colère des dieux est déclenchée par **deux chemins distincts** :
1. **Maladresse** (double raté) au Test de Prière — toujours, indépendamment du Péché.
2. **Péché actif** — dé des unités ≤ sinPoints, même sur un Test réussi.

Le MJ peut aussi utiliser la table ou y piocher des résultats chaque fois qu'un personnage insulte un dieu. `LDB 40 l.45-46`

**Modificateur au jet de Colère** : ajouter **+10 par Point de Péché** au jet d100 sur le tableau. `LDB 40 l.46`

**Après le jet** : réduire les Points de Péché de 1 (minimum 0). `LDB 40 l.46-50`

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 40` (l.12-13, l.45-50) → `discreetPrayerDifficulty`, `SinPoints`, `castInfoIsPrayer`, `castInfo`, `peche`, `wrath-table`, `CastModal`, `liveTableDecl`, `giveSinSchema`, `prayerWrathTriggered`, +49 — `src/data/characteristics.json`, `src/data/combat-stakes.json`, `src/data/miscast.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/data/schemas/grammaire/valeurs.ts`, +13 fichiers
- dette : #1653
- bloqué : 6 rangées à DÉ du Tableau de la Colère des dieux sans `ops` — LDB 40 l.61 et l.70 (pénalité de Compétence à durée, hors magie), l.64 (cibles dans `applyMiscast` + échec automatique par divinité), l.74 (action contrainte), l.80 et l.82 (suppression temporaire de Talent) : le vocabulaire de `GameOp` ne les exprime pas encore

---

## Table d100 — Colère des dieux (verbatim)

**Sources RAW** : `LDB 40 l.52-101`

> Modificateur au jet : +10 par Point de Péché accumulé.  
> Après résolution : réduire Points de Péché de 1 (min 0).

| Pourcentage | Résultat |
|---|---|
| 01–05 | **Visions sacrées** : les visions de votre dieu tourmentent vos sens. Effectuez un Test de *Résistance Accessible (+20)*. Sur un échec, gagnez 1 État *Sonné*. Le MJ détermine ce qu'impliquent les visions. |
| 06–10 | **Pensez à vos actes** : tout Test de Prière réussi ne peut pas obtenir plus de 0 DR pour la semaine suivante. |
| 11–15 | **Tenez compte de mes enseignements** : vous subissez une pénalité de −10 à votre Compétence Prière pour les 1d10 + (Points de Péché) prochains Rounds. |
| 16–20 | **Prouvez votre dévotion** : gagnez l'État *À Terre*. Cet État ne peut être retiré jusqu'à ce que vous obteniez un succès sur un Test de *Prière Accessible (+20)*. |
| 21–25 | **Vous abusez de ma patience** : vous ne pouvez pas effectuer de Tests de Prière pendant 1d10 Rounds. |
| 26–30 | **Vous ne comprenez pas ma volonté** : vous subissez une pénalité de −10 à toutes les Compétences associées à votre divinité (déterminées par le MJ) pour les 1d10 + (Points de Péché) prochaines heures. |
| 31–35 | **Je trouve inquiétant votre manque de foi** : vous ne pouvez pas effectuer de Tests de Prière pendant 1d10 + (Points de Péché) en Rounds. |
| 36–40 | **Partagez ma douleur** : vous subissez 1 + (Points de Péché) Blessures, qui ignorent le Bonus d'Endurance et les PA. Effectuez également un Test de *Résistance Accessible (+20)*. Sur un échec, gagnez 1 État *Sonné*. |
| 41–45 | **Votre cause est indigne** : vos cibles gagnent l'État *À Terre*. Elles ne pourront plus être l'objet d'aucune Bénédiction ou Miracle de votre divinité, qui échouent automatiquement pendant les 1d10 + (Points de Péché) prochains jours. |
| 46–50 | **Cessez vos babillages** : vous ne pouvez pas effectuer de Tests de Prière pendant les 2d10 + (Points de Péché) prochains Rounds. |
| 51–55 | **Ressentez ma colère** : vous subissez 1d10 + (Points de Péché) Blessures. Effectuez aussi un Test de *Résistance Intermédiaire (+0)*. Sur un échec, vous gagnez 1 État *Sonné*. |
| 56–60 | **Je ne vous aiderai pas** : vous subissez une pénalité de −10 à une Compétence associée à votre divinité (déterminée par le MJ) pour les 1d10 + (Points de Péché) prochains jours. |
| 61–65 | **Blessures divines** : gagnez 1 + (Points de Péché) États *Hémorragique*. |
| 66–70 | **Frappé de cécité** : gagnez l'État *À Terre*. Gagnez 1 + (Points de Péché) État *Aveuglé*, qui peuvent uniquement être retirés en réussissant un Test de *Prière Intermédiaire (+0)*, qui retire 1 + DR État *Aveuglé*. |
| 71–75 | **Qu'allez-vous sacrifier ?** : vous subissez 1d10 + (Points de Péché) Blessures, ignorant le Bonus d'Endurance et les PA. Effectuez aussi un Test de *Résistance Complexe (−10)*. Sur un échec, vous gagnez 1 État *Sonné*. |
| 76–80 | **Vous avez péché contre moi** : votre dieu est extrêmement contrarié et vous oblige à effectuer des Tests de Prière pour votre Action pendant les 1d10 + (Points de Péché) prochains Rounds comme pénitence. |
| 81–87 | **Purifier la chair** : vous subissez 2d10 + (Points de Péché) Blessures, qui ignorent le Bonus d'Endurance et les PA. Effectuez aussi un Test de *Résistance Difficile (−20)*. Sur un échec, vous gagnez 1 État *Sonné*. Si vous échouez avec −4 DR ou moins, gagnez 1 État *Inconscient* qui dure un minimum de 1d10 Rounds. |
| 88 | **Interférences démoniaques** : les Dieux Sombres répondent à votre demande à la place de votre divinité. 1d10 démons inférieurs apparaissent à 2d10 mètres de votre position, et attaquent les cibles les plus proches. |
| 89–95 | **Redoutez ma colère** : gagnez 1 + (Points de Péché) États *Brisé*. |
| 96–100 | **Faites pénitence** : vous devez faire Pénitence. |
| 101–105 | **Châtiment** : votre total de Points de Blessures est réduit à 0 (si ce n'est pas déjà le cas) puis vous gagnez 1 État *Inconscient*, qui ne peut pas être retiré jusqu'à ce que vous récupériez au moins 1 Point de Blessure. |
| 106–110 | **Ne prononcez pas mon nom en vain** : vous perdez les Talents *Béni* et *Invocation* pour les 1d10 + (Points de Péché) prochains jours. |
| 111–115 | **Ne vous attachez pas aux futilités** : toutes vos Possessions vous sont ôtées, vous laissant nu. Pour chaque Pénitence achevée, vous récupérerez un Objet magique, si vous en aviez. |
| 116–120 | **Vous abusez de ma miséricorde** : vous perdez les Talents *Béni* et *Invocation* pour les 2d10 + (Points de Péché) prochains jours. |
| 121–125 | **Contemplez votre cruauté** : vous subissez des visions insupportables de tous vos échecs, ce qui semble durer une éternité, mais s'arrête en un instant. Discutez avec votre MJ pour déterminer un Trait Psychologique personnalisé reflétant la façon dont votre Personnage fait face à cette expérience traumatique. |
| 126–130 | **Tonnerre et foudre** : votre dieu vous foudroie. Vous êtes réduit à 0 Point de Blessure (si vous ne l'étiez pas déjà) et gagnez l'État *Enflammé*. |
| 131–135 | **Souffrez comme je souffre** : vous gagnez 1 + (Points de Péché) États *Hémorragique* chaque matin, jusqu'à ce que vous ayez effectué une Pénitence. |
| 136–140 | **Excommunication** : vous perdez les Talents *Invocation* et *Béni* jusqu'à ce que vous ayez effectué 2 Pénitences ; la première restitue le Talent *Béni*, et la seconde le Talent *Invocation*. Tous les fidèles de votre dieu sont automatiquement informés de votre état ; tous les Tests pour interagir avec eux sont automatiquement *Très Difficile (−30)*, et ne peuvent être modifiés positivement. |
| 141–145 | **Prouvez votre valeur** : un Serviteur de votre divinité apparaît à 1d100 mètres et attaque, intervient, réprime ou agit d'une façon similaire selon la nature du dieu offensé. |
| 146–150 | **Je te chasse** : votre dieu vous abandonne. Vous perdez les Talents *Béni* et *Invocation* de façon permanente, et toutes les Améliorations de Prière. De plus, tous les fidèles de votre dieu sont automatiquement informés de votre situation : tous les Tests pour interagir avec eux sont automatiquement *Très difficile (−30)*, et ne peuvent être modifiés positivement. |
| 151+ | **Appelé à rendre des comptes** : vous êtes convoqué devant votre dieu pour affronter le jugement dernier. À moins que vous n'ayez des Points de Destin, vous ne reviendrez jamais. Si vous dépensez un Point de Destin, vous êtes renvoyé à un moment choisi par le MJ, et vous subissez également les effets de *Je te chasse* (ci-dessus). |

**Note d'implémentation** : l'entrée 81–87 possède un palier d'échec aggravé (−4 DR ou moins → État *Inconscient*), codé dans `miscast.ts` comme `MiscastEntry.fumbleThreshold`. `LDB 40 l.93-95`.

---

## Pénitence

**Sources RAW** : `LDB 40 l.98-100`

Certaines entrées de la Colère des dieux exigent une Pénitence. Le MJ détermine une pénitence appropriée à la faute (ou laisse le joueur proposer, avec châtiment supplémentaire si non repentant). Des exemples typiques sont listés dans la description de chaque culte. Les Pénitences peuvent se manifester via des visions, de l'inspiration divine, un autre membre du culte, ou un Serviteur divin.

**Serviteurs divins** : séides surnaturels du dieu dans le royaume matériel, prenant l'apparence d'un animal préféré ou d'un dévot défunt. Construits avec les règles du bestiaire (ch. 12). `LDB 40 l.94-96`

---

## Retirer des Points de Péché

**Sources RAW** : `LDB 40 l.49-50`

Deux seuls moyens de retirer des Points de Péché :

1. **Jet de Colère des dieux** : après chaque déclenchement, réduire le total de 1 (minimum 0) automatiquement.
2. **Comportement pieux** (règle optionnelle) : un pèlerinage difficile, une donation importante, ou une acte d'expiation notable → le MJ peut accorder le retrait de 1 Point de Péché ou plus avec un **Test de Prière réussi** (pour illustrer l'imploration d'absolution). Ce Test risque lui-même de déclencher la Colère des dieux.

> « Sinon, la seule façon de retirer des Points de Péché est d'effectuer un lancer sur le tableau de la Colère des dieux. »
> — LDB 40 l.50

---

## Petites Prières — règle optionnelle

**Sources RAW** : `LDB 25 l.23-24`

Les Prières adressées par des non-Bienheureux dans des sites sacrés peuvent exceptionnellement être entendues. Le MJ lance secrètement 1d100 : réponse sur un résultat de 01 seulement. Si le suppliant possède la Compétence Prière, le MJ peut augmenter ce pourcentage. La réponse n'est jamais un simple octroi de vœu, mais quelque chose d'utile au but de la divinité.

---

## Cultes — structure générale (renvoi)

**Sources RAW** : `LDB 25 l.5-17`

Les cultes sont organisés en **ordres** (monastiques, templiers, presbytéraux, mendiants) qui vouent allégeance au chef du culte et non à la noblesse locale. Ils entretiennent des **sites sacrés** (temples, abbayes, sanctuaires) à travers le Vieux Monde. Le **Grand Conclave** (créé par Magnus le Pieux) réunit tous les cinq ans les représentants des dix cultes principaux de l'Empire.

Les dix cultes siégeant au Grand Conclave : Manann, Morr, Myrmidia, Ranald, Rhya, Shallya, Sigmar, Taal, Ulric, Verena. `LDB 25 l.35-36`

**Bénédictions par culte (6 bénédictions chacun)** — catalogue à produire séparément (ch. 41) :

| Culte | Bénédictions |
|---|---|
| Manann | Bataille, Courage, Sauvagerie, Souffle, Ténacité, Vigueur |
| Morr | Chance, Courage, Droiture, Sagesse, Souffle, Ténacité |
| Myrmidia | Bataille, Chance, Conscience, Courage, Droiture, Protection |
| Ranald | Chance, Charisme, Conscience, Finesse, Protection, Vivacité |
| Rhya | Conscience, Convalescence, Grâce, Guérison, Protection, Souffle |
| Shallya | Conscience, Convalescence, Guérison, Protection, Souffle, Ténacité |
| Sigmar | Bataille, Courage, Droiture, Puissance, Protection, Vigueur |
| Taal | Bataille, Conscience, La Chasse, Sauvagerie, Souffle, Vigueur |
| Ulric | Bataille, Courage, Puissance, Sauvagerie, Ténacité, Vigueur |
| Verena | Chance, Conscience, Courage, Droiture, Sagesse, Vivacité |

---

## Commandements — système (renvoi)

**Sources RAW** : `LDB 40 l.23-31`, `LDB 41 l.76` (Bénédiction de Conscience), ch. 26-39 (un culte par chapitre)

Les commandements sont les préceptes spécifiques à chaque culte dont la violation génère des Points de Péché. Chaque culte (ch. 26-39) liste ses propres commandements. La **Bénédiction de Conscience** oblige à réussir un Test de Force Mentale pour briser un commandement de la divinité du prêtre. Catalogue séparé : commandements de chaque culte (ch. 26-39).

---

## Implémente

| Règle | Module | Fonction / variable |
|---|---|---|
| Branche Prière (Soc, pas de NI) | `src/engine/magic.ts` | `castInfo()` : `castInfoIsPrayer` → `skill:'priere', requireNI:false` |
| Test de Prière et évaluation | `src/engine/magic.ts` | `resolveCasting()`, `evaluateCasting()` |
| Péché et Colère Divine (dé unités ≤ sinPoints) | `src/engine/magic.ts` | `prayerWrathTriggered(roll, sinPoints)` |
| « Pensez à vos actes » (0 DR plafonné) | `src/engine/magic.ts` | `prayerMaxZeroDR(c)` |
| Talent Prière (+1 DR / acquisition) | `src/engine/magic.ts` | `castTestTalentDR(c, 'Prière')` |
| Table Colère des dieux (d100 + +10/Péché) | `src/engine/miscast.ts` | `rollMiscast('colere', rng, sinPoints)` |
| Expiation Péché (−1 après jet Colère) | `src/state/combatFlow.ts` | `l.2134-2138` |
| Déclenchement Colère (Maladresse + Péché) | `src/state/combatFlow.ts` | `l.2981-2984` |
| sinPoints persisté | `src/data/types` → `Combatant.sinPoints` | — |
| Dissipation (Miracles NON dissipables) | `src/engine/magic.ts` | `isDispellableSpell()` : `castInfoIsPrayer` → `false` |

---

## Voir aussi

- [`magie.md`](magie.md) — règles d'incantation arcanique (Focalisation, ZdE, Imparfaites, Contre-sort) ; la Prière partage la structure de `resolveCasting` mais branche sur la famille (`castInfoIsPrayer`).
- [`etats.md`](etats.md) — États déclenchés par la Colère des dieux (Sonné, À Terre, Aveuglé, Inconscient, Hémorragique, Brisé, Enflammé, Exténué).
- [`destin.md`](destin.md) — Point de Destin consommé pour l'entrée 151+ de la Colère.
- [`corruption.md`](corruption.md) — Péché ≠ Corruption (deux systèmes indépendants : Péché = disgrâce divine, Corruption = taint du Chaos).
- [`talents.md`](talents.md) — Béni, Invocation, Visions sacrées, Destinée (acquis via Miracle « Condamné »).

---


---

<!-- MDG-INTEGRATION -->

VÉRIFIÉ — aucune correction nécessaire. Toutes les réfs `MDG 10/11 l.X` résolvent exactement, toutes les citations « » sont verbatim, toutes les valeurs mécaniques sont sourcées. Les topics ci-dessous sont validés tels quels (collez l'original). Détail du contrôle ligne par ligne :

TOPIC 1 (Culte de Manann) — `MDG 10 l.100` = ligne 100 (« Les commandements exposés dans WFJDR (en page 205) sont universels. ») VERBATIM ✓ ; croyance « domaine en mer » = l.102 ✓ ; croyance « conter exploits » = l.104 ✓ ; commandements locaux = l.108+110 ✓ ; `MDG 10 l.236` = ligne 236, citation plafond 3 navires VERBATIM (incl. « voir page 130 ») ✓.

TOPIC 2 (Miracles de Manann) — plage `l.232-303` correcte ; chaque ligne de table vérifiée : Apaiser l.240-242 ✓, Albatros l.244-250 ✓ (citation l.250 VERBATIM), Marinier l.252-256 ✓, Contre-courants l.258-268 ✓ (−1 M / −1 DR Man, l.266-268), Malédiction de la mer l.270-278 ✓ (+2 Dégâts), Navigation bénie l.280-284 ✓ (Humeur +2d10 −1/Péché), Repousser l.286-294 ✓ (Aquatique/Créature marine), Respiration aquatique l.296-302 ✓ (BSoc minutes). Sel sacré l.112-122 ✓, citation l.116 VERBATIM, Int ≤ 15 / Calme Complexe (−10) / Brisé (l.121) ✓.

TOPIC 3 (Culte de Stromfels) — `MDG 11 l.3` = titre ✓ ; `l.56-78` = COMMANDEMENTS ✓ ; `l.148` = restriction Talent ✓ ; crime capital l.19 VERBATIM ✓ ; cmd 1 l.62-66 ✓, cmd 2 l.68-70 ✓, cmd 3 l.72-74 + citation Force l.74 VERBATIM ✓, cmd 4 l.76-78 ✓ ; restriction Invocation≥2 / Béni≥5 l.148 VERBATIM ✓ ; Bénédictions l.152 ✓ ; Pénitences l.80-82 ✓. Faits (Casa Squallo / Myrmidia / Sartosa / Traité 2150 CI / pas de hiérarchie ni ordres ni livres) tous confirmés (l.5, 9, 13, 17-19, 40).

TOPIC 4 (Miracles de Stromfels) — plage `l.146-225` correcte ; Faire fi l.156-171 ✓, table l.166-171 (4 lignes d10 transcrites mot pour mot ✓), Flairer le sang l.173-177 ✓ + citation l.177 VERBATIM ✓, Lame de fond l.179-185 ✓ (IC 15), Mal de mer l.187-195 ✓ (BF heures), Malédiction maîtresse cruelle l.197-205 ✓ (Calme Complexe −10 / Exténué persiste), Sacrifice à Stromfels l.207-215 ✓ (double Indice Voie d'eau), Vents de tempête l.217-225 ✓ (Force minutes, +1 cran).

SEULE RÉSERVE (non bloquante, à laisser tel quel) : dans le « Voir aussi » du Topic 1, l'équivalence `WFJDR p.205 = LDB 26` est une assertion éditoriale du topic, non vérifiable depuis ces deux seuls fichiers MDG (la source dit seulement « WFJDR, page 205 »). Mapping plausible (chap. religion du LDB) ; conservé.

## Bilan de fidélité

**Couvert et vérifié** : règles de base Bénédictions/Miracles, Points de Péché (accumulation, proportionnalité), Péché et Colère Divine (deux déclencheurs), table d100 Colère des dieux verbatim complète (01–151+), Pénitence, Serviteurs divins, règle optionnelle Petites Prières, structure cultes/ordres/Grand Conclave, table Bénédictions par culte (mapping uniquement).

**Catalogue à transcrire séparément** :
- Bénédictions — 17 Bénédictions nommées avec Portée/Cible/Durée/effet (`LDB 41 l.52-164`).
- Miracles par culte — Manann (5), Morr (5), Myrmidia (6), Ranald (5), + Rhya (`LDB 43`), Shallya, Sigmar, Taal, Ulric, Verena (`LDB 42`).
- Commandements de chaque culte — ch. 26-39 (un fichier par culte ou catalogue unique).

**Écarts code identifiés** :
- L'entrée 88 (démons inférieurs) est journalisée et laissée à l'arbitrage MJ (comportement documenté dans `miscast.ts` : le texte canonique est journalisé sans spawn automatique). Conforme au commentaire source.
- L'entrée 121-125 (Trait Psychologique personnalisé) est journalisée MJ-only. Pas d'automation possible sans discussion table. Conforme.
- Les entrées 141-145 (Serviteur divin), 146-150 (Je te chasse permanente), 151+ (convocation) sont journalisées MJ-only. Conforme.
