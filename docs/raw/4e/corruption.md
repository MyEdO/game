# Atlas RAW — Corruption & Mutations

> Référentiel **autosuffisant** des règles WFRP4 (RAW), consolidé sur les livres autorisés, à usage
> d'agent (répondre + auditer le code sans rouvrir les livres). Chaque règle cite `LIVRE NN l.X-Y`
> (last-recours = la source). Abréviations : [`sources.md`](../sources.md). Index : [`00-index.md`](00-index.md).
>
> Domaine couvert : Points de Corruption (gains/pertes), seuil, Test de Résistance, dissolution corps/esprit,
> tables de mutation physique et mentale (verbatim), limites → damnation, Sombre Pacte, absolution,
> extensions EDO Compagnon (tables par dieu). Hors-scope : apparence visuelle des mutations (rig/couche art).
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

## Sommaire

- [Points de Corruption — définition et modèle](#points-de-corruption--définition-et-modèle)
- [Gagner des Points de Corruption — deux sources](#gagner-des-points-de-corruption--deux-sources)
- [Sombre Pacte — gain volontaire pour relancer](#sombre-pacte--gain-volontaire-pour-relancer)
- [Influences corruptrices — niveaux et DR requis](#influences-corruptrices--niveaux-et-dr-requis)
  - [Exposition Mineure (+1 PC sur échec)](#exposition-mineure-1-pc-sur-échec)
  - [Exposition Modérée (0–2 PC selon DR)](#exposition-modérée-02-pc-selon-dr)
  - [Exposition Majeure (0–3 PC selon DR)](#exposition-majeure-03-pc-selon-dr)
- [Seuil « Corrompu » — déclenchement du Test](#seuil--corrompu---déclenchement-du-test)
- [Talent Âme Pure — augmentation du seuil](#talent-âme-pure--augmentation-du-seuil)
- [Dissolution du corps et de l'esprit — procédure de mutation](#dissolution-du-corps-et-de-lesprit--procédure-de-mutation)
- [Déterminer corps ou esprit (table par espèce)](#déterminer-corps-ou-esprit-table-par-espèce)
- [Tableau de Corruption Physique (d100, verbatim LDB 19)](#tableau-de-corruption-physique-d100-verbatim-ldb-19)
- [Tableau de Corruption Mentale (d100, verbatim LDB 19)](#tableau-de-corruption-mentale-d100-verbatim-ldb-19)
- [Limites de Corruption — devenir Damné](#limites-de-corruption--devenir-damné)
- [Perdre des Points de Corruption](#perdre-des-points-de-corruption)
  - [Sombres Murmures](#sombres-murmures)
  - [Absolution](#absolution)
- [Résilience — « Je te renie ! » (LDB 17)](#résilience---je-te-renie---ldb-17)
- [Mutations supplémentaires — EDO Appendice 2 (campagne)](#mutations-supplémentaires--edo-appendice-2-campagne)
- [Tables étendues par dieu — EDOC chapitre 8](#tables-étendues-par-dieu--edoc-chapitre-8)
  - [Table Physique étendue (d100, Khorne/Nurgle/Slaanesh/Tzeentch/Toute Puissance)](#table-physique-étendue-d100)
  - [Tableau Tête Bestiale (d100, sous-table)](#tableau-tête-bestiale-d100-sous-table)
  - [Table Mentale étendue (d100, par dieu)](#table-mentale-étendue-d100-par-dieu)
- [Magie du Chaos — gain de Corruption à l'apprentissage (LDB Talents)](#magie-du-chaos--gain-de-corruption-à-lapprentissage-ldb-talents)
- [Talent Résistance (Mutation) — LDB 10](#talent-résistance-mutation--ldb-10)
- [Voir aussi](#voir-aussi)
- [Implémentation — src/engine/corruption.ts](#implémentation--srcenginecorruptionts)

---

## Points de Corruption — définition et modèle

> « Les Points de Corruption sont utilisés pour représenter la lente dérive de votre âme vers les Dieux Sombres du Chaos. Chaque fois que vous êtes exposé à une potentielle source de Corruption, vous risquez d'accumuler des Points. Plus ce total est important, plus vous vous rapprochez du Chaos et plus votre âme s'assombrit, jusqu'à ce qu'éventuellement, vous changiez… »
> — LDB 19 l.7

Persistés sur `Combatant.corruption` (entier ≥ 0). Les effets mécaniques des mutations sont lus à la volée (mêmes mécanismes que les traumatismes). Les mutations subies sont listées dans `Combatant.mutations : Mutation[]`.

**Sources RAW** : `LDB 19 l.5-11`

---

## Gagner des Points de Corruption — deux sources

Deux mécanismes distincts permettent d'accumuler des Points de Corruption : les **Influences corruptrices** (passives, Test requis) et les **Sombres Pactes** (actifs, dépense volontaire).

**Sources RAW** : `LDB 19 l.10-12`

---

## Sombre Pacte — gain volontaire pour relancer

> « Vous pouvez décider de recevoir volontairement un Point de Corruption pour pouvoir relancer un Test, même si un deuxième jet a déjà été effectué. C'est toujours un choix qui vous appartient – jamais le MJ ne peut prendre cette décision à votre place. »
> — LDB 19 l.17

Un Sombre Pacte coûte **+1 Point de Corruption** et permet de **relancer un Test** — le verbatim ci-dessus ne restreint PAS au Test raté (contrairement à la Chance, LDB 17 l.23) et couvre explicitement le cas où « un deuxième jet a déjà été effectué » (Chance → Sombre Pacte → résultat possible sur le même Test).

Le MJ peut suggérer l'option, mais **la décision appartient toujours au joueur**.

L'option « Embrasser les Ombres » (encart) encourage le MJ à enjoliver narrativement le pacte (animaux qui fuient, plantes qui pourrissent, jet sur la table des Incantations Imparfaites…).

**Sources RAW** : `LDB 19 l.13-23` (Sombres Pactes), `LDB 19 l.17` (gain volontaire pour relancer)

---

## Influences corruptrices — niveaux et DR requis

Quand un personnage rencontre une Influence corruptrice, il effectue un **Test de Résistance Intermédiaire (+0)** ou un **Test de Calme Intermédiaire (+0)** selon le MJ :
- **Physique** → Résistance
- **Spirituelle / psychologique** → Calme

### Exposition Mineure (+1 PC sur échec)

> « Sur un échec à un Test pour résister à une exposition mineure, gagnez 1 Point de Corruption. »
> — LDB 19 l.35

Exemples d'Expositions Mineures :
- Voir un Démon Mineur.
- Être en contact avec un mutant, une malepierre raffinée ou un artefact imprégné de Chaos.
- Se laisser aller au désespoir, la rage, les excès ou avoir impérativement besoin de changer son sort.
- Se trouver à proximité d'une malepierre.
- Se retrouver de façon prolongée en présence d'adorateurs du Chaos, de temples du Culte du Chaos, de skavens, d'antres de mutants, ou autres.

**Sources RAW** : `LDB 19 l.34-41`

### Exposition Modérée (0–2 PC selon DR)

> « Si un Test se conclut par un échec, vous gagnez 2 Points de Corruption. Sur un Succès Minime (0-1 DR), gagnez 1 Point de Corruption. Sur un Succès (2+ DR), vous ne gagnez aucun Point de Corruption. »
> — LDB 19 l.48

| Résultat du Test | Points gagnés |
|---|---|
| Échec | 2 |
| Succès Minime (0-1 DR) | 1 |
| Succès (2+ DR) | 0 |

Exemples d'Expositions Modérées :
- Se retrouver en présence de plusieurs Démons.
- Être en contact avec un Démon, une malepierre ou un artefact profané.
- S'abandonner au désespoir, la rage, les excès, ou désirer ardemment devenir quelqu'un d'autre.
- Exposition prolongée à une malepierre raffinée.
- Brève exposition à un environnement contaminé par *Dhar*.

**Sources RAW** : `LDB 19 l.44-54`

### Exposition Majeure (0–3 PC selon DR)

> « Sur chaque échec à un Test pour résister à une exposition majeure, gagnez 3 Points de Corruption. Sur un Succès Minime (0-1 DR), gagnez 2 Points de Corruption. Sur un Succès (2-3), gagnez 1 Point de Corruption. Sur un Succès Impressionnant (4+ DR), vous ne gagnez aucun Point de Corruption. »
> — LDB 19 l.58

| Résultat du Test | Points gagnés |
|---|---|
| Échec | 3 |
| Succès Minime (0-1 DR) | 2 |
| Succès (2-3 DR) | 1 |
| Succès Impressionnant (4+ DR) | 0 |

Exemples d'Expositions Majeures :
- Se retrouver en présence d'un Démon majeur.
- Être en contact prolongé avec un Démon, une malepierre ou un artefact profané.
- Lier un pacte avec un Démon.
- Utiliser une malepierre raffinée.
- Exposition prolongée à un environnement contaminé par *Dhar*.

**Sources RAW** : `LDB 19 l.57-64`

---

## Seuil « Corrompu » — déclenchement du Test

> « Si vous gagnez plus de Points de Corruption que votre Bonus de Force Mentale + votre Bonus d'Endurance, effectuez immédiatement un Test de Résistance Intermédiaire (+0). »
> — LDB 19 l.70

**Condition de déclenchement** : `corruption > BFM + BE`

- **Succès** : la Corruption est contenue pour cette fois. Le Test devra être repassé à chaque nouveau gain de Point de Corruption tant que le seuil reste dépassé.
- **Échec** : dissolution du corps et de l'esprit → **mutation** (voir ci-dessous).

**Sources RAW** : `LDB 19 l.67-72`

---

## Talent Âme Pure — augmentation du seuil

> « Votre âme est pure, très résistante aux déprédations du Chaos. Vous pouvez gagner un nombre de Points de Corruption supplémentaires égal à votre niveau d'Âme pure avant d'avoir à effectuer un Test pour savoir si vous êtes corrompu. »
> — LDB 10 (Talents) l.37

**Maxi** : Bonus de Force Mentale.

Effet mécanique : le seuil de déclenchement devient `corruption > BFM + BE + niveau_Âme_pure`.

**Sources RAW** : `LDB 10 l.52-56`

---

## Dissolution du corps et de l'esprit — procédure de mutation

Quand le Test de Résistance au seuil est raté :

1. Le personnage **perd autant de Points de Corruption que la valeur de son Bonus de Force Mentale** (réduction immédiate).
2. Lancer un **d100** pour déterminer si c'est le **corps** ou l'**esprit** qui mute (table par espèce, ci-dessous).
3. Lancer un second **d100** sur le **Tableau de Corruption Physique** ou **Mentale** selon le résultat.
4. La mutation est appliquée immédiatement (effets mécaniques permanents).
5. Vérifier les **Limites de Corruption** (voir § Limites).

> « D'abord, vous perdez autant de Points de Corruption que la valeur de votre Bonus de Force Mentale alors que vous subissez une mutation. Ensuite, effectuez un lancer de pourcentage et reportez-vous au tableau qui suit pour définir si c'est votre corps ou votre esprit qui va renaître. »
> — LDB 19 l.76

**Sources RAW** : `LDB 19 l.73-83`

---

## Déterminer corps ou esprit (table par espèce)

| | Elfe | Halfling | Humain | Nain |
|---|---|---|---|---|
| **Corps** | — | 01–10 | 01–50 | 01–05 |
| **Esprit** | 01–100 | 11–100 | 51–100 | 06–100 |

- Les **Elfes** mutent toujours mentalement.
- Les **Nains** mutent presque toujours mentalement (seulement 5 % physique).
- Les **Humains** mutent à 50/50.
- Les **Halflings** mutent principalement mentalement (10 % physique).

Variantes (Haut Elfe, Elfe Sylvain, Nain Norse…) retombent sur leur espèce-racine. Toute espèce non listée est traitée comme Humain.

**Sources RAW** : `LDB 19 l.78-82`

---

## Tableau de Corruption Physique (d100, verbatim LDB 19)

> « Utilisez les descriptions ci-dessous afin d'inventer votre version de la mutation. Prenez le temps de décrire la façon dont elle se manifeste, en ne lésinant pas sur les détails perturbants. Dans tous les cas, si votre mutation est visible à l'œil, non seulement vous subirez des pénalités à vos Tests de Sociabilité en fonction des circonstances, mais il est probable que les gens prennent la fuite en vous voyant, que la Garde soit appelée, ou que les Répurgateurs interviennent, rendant votre vie de plus en plus difficile. »
> — LDB 19 l.114

| D100 | Nom | Effet |
|---|---|---|
| 01–05 | Pattes d'animaux | +1 Mouvement |
| 06–10 | Corpulent | -1 Mouvement, +5 Force, +5 Endurance |
| 11–15 | Doigts distendus | +10 Dextérité |
| 16–20 | Émacié | -10 Force, +5 Agilité |
| 21–25 | Œil énorme | +10 aux Tests de Perception impliquant la vue |
| 26–30 | Articulation supplémentaire aux jambes | +5 Agilité |
| 31–35 | Bouche supplémentaire | Effectuer un lancer sur le Tableau des Localisations afin de déterminer où cette bouche apparaît. |
| 36–40 | Tentacule épais | Vous gagnez le Trait de Créature Tentacule. (LDB 85) |
| 41–45 | Peau brillante | Produit une lumière équivalente à celle d'une bougie. |
| 46–50 | Beauté surnaturelle | +10 Sociabilité. Vous ne gardez jamais de cicatrice. |
| 51–55 | Visage inversé | -20 aux Tests de Sociabilité |
| 56–60 | Peau d'acier | +2 PA à toutes les Localisations, -10 Agilité |
| 61–65 | Langue pendante | -10 à tous les Tests de Langue lorsque vous parlez. |
| 66–70 | Plumes éparses | Effectuez deux lancers sur le Tableau des Localisations pour déterminer où ces plumes apparaissent. |
| 71–75 | Court sur pattes | -1 Mouvement |
| 76–80 | Écailles épineuses | +1 PA à toutes les Localisations |
| 81–85 | Cornes asymétriques | +1 PA à la Tête. Compte comme une Arme de Créature dont le nombre de Dégâts est égal à votre Bonus de Force (LDB 85) |
| 86–90 | Suintement de pus | Effectuez un lancer sur le Tableau des Localisations pour déterminer l'origine du suintement |
| 91–95 | Groin poilu | +10 Pistage |
| 96–00 | Choix du MJ | Le MJ choisit une mutation ou un Trait de Créature. (LDB 85) |

**Sources RAW** : `LDB 19 l.116-135`

---

## Tableau de Corruption Mentale (d100, verbatim LDB 19)

> « Un esprit corrompu est peut-être moins facilement repérable que des tentacules protubérants, mais les conséquences sur votre vie peuvent être tout aussi désastreuses. »
> — LDB 19 l.142

| D100 | Nom | Effet |
|---|---|---|
| 01–05 | Atroces désirs | -5 Sociabilité, -5 Force Mentale |
| 06–10 | Bête intérieure | +10 Force Mentale, -5 Sociabilité, -5 Intelligence |
| 11–15 | Rêves chaotiques | Gagnez l'État Exténué pendant les deux premières heures de chaque journée. |
| 16–20 | Formication | -5 Initiative, -5 Dextérité |
| 21–25 | Imprévisible fantaisiste | -5 Intelligence, -5 Force Mentale |
| 26–30 | Terrible inquiétude | -10 Force Mentale |
| 31–35 | Pulsions de haine | Sujet à l'Hostilité (Psychologie) envers tous ceux qui ne sont pas de votre race. |
| 36–40 | Cœur desséché | +10 Force Mentale, -10 Sociabilité |
| 41–45 | Pensées envieuses | -10 Sociabilité |
| 46–50 | Esprit solitaire | -10 aux Tests lorsque vous êtes seul |
| 51–55 | Blocage mental | -10 Intelligence |
| 56–60 | Urgence profanatoire | -10 Force Mentale, +10 Agilité |
| 61–65 | Morale douteuse | Gagnez 1 État Brisé si vous échouez à un Test dérivé de la Force Mentale. |
| 66–70 | Esprit suspicieux | -5 Initiative, -5 Intelligence |
| 71–75 | Accro à l'adrénaline | +10 Force Mentale, -10 Initiative |
| 76–80 | Visions torturées | -10 Initiative |
| 81–85 | Totalement déséquilibré | -20 Sociabilité, +10 Force Mentale |
| 86–90 | Infinie malveillance | -10 à tous les Tests qui ne sont pas destinés à blesser autrui. +10 à tous les Tests destinés à blesser autrui. |
| 91–95 | Colère impie | Sujet à Frénésie (Psychologie), +10 à la Capacité de Combat |
| 96–00 | Affreusement nerveux | +5 Agilité, -5 Sociabilité |

**Sources RAW** : `LDB 19 l.144-166`

---

## Limites de Corruption — devenir Damné

> « Si vous survivez assez longtemps pour recevoir plus de mutations que la valeur de votre Bonus d'Endurance ou plus de mutations mentales que votre Bonus de Force Mentale, vous avez basculé dans le Chaos, et votre âme devient alors propriété des impitoyables dieux du Chaos. »
> — LDB 19 l.87

**Condition de damnation** :
- mutations **physiques** > BE, **ou**
- mutations **mentales** > BFM

Quand cette limite est atteinte, le personnage est **damné** : il devient un PNJ contrôlé par le MJ. Il n'est pas impossible que le groupe le croise à nouveau plus tard, sous une forme misérable.

**Sources RAW** : `LDB 19 l.86-89`

---

## Perdre des Points de Corruption

### Sombres Murmures

> « Le MJ peut demander à ce que vous dépensiez un de vos Points de Corruption afin de vous servir de la noirceur qui consume lentement votre âme et de pervertir vos actes. »
> — LDB 19 l.99

Le personnage perd **1 Point de Corruption** s'il accepte de commettre un acte répréhensible dicté par le MJ. Ce choix reste **optionnel** (refuser = garder le Point). Exemples :
- Laisser un ennemi s'échapper.
- Tirer sur un allié « accidentellement ».
- S'endormir lors de son tour de garde.

**Sources RAW** : `LDB 19 l.96-105`

### Absolution

> « L'empreinte laissée par les Dieux Sombres ne peut pas s'effacer aussi facilement. »
> — LDB 19 l.169

Les limites précises sont laissées à l'appréciation du MJ. Exemples de voies d'absolution :
- Purifier un temple profané par les Dieux Sombres (risque d'exposition supplémentaire).
- Détruire un artefact maudit ou le rendre inoffensif, contrecarrant les plans des Dieux Sombres.
- Rejoindre un ordre saint et vouer sa vie à un dieu s'opposant au Chaos.
- Effectuer un pèlerinage saint et recevoir la bénédiction d'un grand prêtre à la fin du périple.

L'absolution **retire des Points de Corruption** — en quelle quantité, le RAW le laisse au MJ.

**Sources RAW** : `LDB 19 l.168-182`

---

## Résilience — « Je te renie ! » (LDB 17)

> « **Je te renie ! :** vous pouvez choisir de ne pas développer la mutation obtenue. Et comme vous ne mutez pas, vous ne perdez aucun Point de Corruption. »
> — LDB 17 l.67

Coût : **1 Point de Résilience**.

Condition : le personnage doit avoir de la Résilience disponible au moment où la mutation serait appliquée (après échec au Test du Seuil).

Effets :
- La mutation est **refusée** — elle ne s'applique pas.
- Le personnage **ne perd aucun Point de Corruption** (la réduction de BFM n'a pas lieu, contrairement à une mutation subie normalement).
- La Résilience reste réduite définitivement de 1.

> « Garder de la Résilience afin de contrer l'influence du Chaos est une bonne chose, mais cela ne retire en aucun cas vos Points de Corruption, ce qui signifie que la mutation est toujours [menaçante]. »
> — LDB 17 l.72

**Sources RAW** : `LDB 17 l.64-72`

---

## Mutations supplémentaires — EDO Appendice 2 (campagne)

L'Appendice 2 de *L'Ennemi dans l'Ombre* introduit cinq mutations physiques propres à la campagne (pas sur les tables d100 génériques) et des Traits de Créature associés.

| Mutation | Effets |
|---|---|
| **Chair Nécrosée** | Gagne le Trait Peur 3, -20 Sociabilité. |
| **Crétin** | Perdez 40 Intelligence (minimum 10). Gagne le Trait de créature Stupide. |
| **Écailles Épineuses** | Perdez 10 Dextérité et 10 Sociabilité. Gagnez +1 PA sur tous les emplacements. Ce PA ne peut pas être utilisé pour la Déviation Critique. |
| **Pattes (Chèvre)** | Perdez 20 Sociabilité et 10 Intelligence. Obtenez le Talent Sens aiguisé (Odorat) et le Trait Morsure +5. |
| **Tête Pointue** | Perdez 5 Intelligence et 10 Sociabilité. Gagnez +1 PA à la localisation Tête. Les couvre-chefs ne conviennent que s'ils sont spécialement conçus. |

Ces mutations sont associées aux créatures de la campagne (mutants du Chapitre 2, cultistes). Elles ne figurent pas sur les tables d100 LDB 19 et sont attribuées directement par le MJ.

**Sources RAW** : `EDO App.2 l.183-211`

---

## Tables étendues par dieu — EDOC chapitre 8

Le Compagnon de *L'Ennemi dans l'Ombre* (Chapitre 8 : Les mutants dans l'Empire) introduit des tables complètes de mutations **par Puissance de la Ruine** (Khorne / Nurgle / Slaanesh / Tzeentch / Toute Puissance). Ces tables remplacent ou complètent les tables LDB 19 pour les créations de PNJ mutants contextualisés.

> « Le tableau ci-après introduit de nombreuses nouvelles mutations simples, et propose cinq colonnes pour un jet de dés aléatoire : une pour chacune des Puissances de la Ruine, et une cinquième si l'identité de la Puissance n'est pas cruciale. »
> — EDOC 8

**Note importante** : les notes de bas de tableau indiquent trois niveaux de dissimulation :
1. Mutation dissimulable seulement par des vêtements.
2. Test d'**Athlétisme Complexe (-10)** pour marcher à allure normale (spécifique Pattes).
3. Mutation **non dissimulable**.

### Table Physique étendue (d100)

| Toute Pce | Khorne | Nurgle | Slaanesh | Tzeentch | Nom | Effets |
|---|---|---|---|---|---|---|
| 01–07 | 01–03 | 01–04 | 01–03 | 01–05 | Pattes [1,2] | +1 Mouvement |
| 08–09 | 04 | 05–08 | 04 | 06 | Sang acide | Gagne le Trait de créature Sang corrosif |
| 10–12 | 05–06 | 09 | — | 07 | Bec [3] | Gagne le Trait de créature Morsure +3 |
| 13 | 07–10 | 10–15 | 05–07 | 08–10 | Tête bestiale [3] | Voir table Tête Bestiale |
| 14–15 | 11 | 16–19 | 08 | 11–12 | Extrémités armées [3] | Réduit la Dextérité à 0 de façon permanente. Vous ne pouvez pas être désarmé |
| 16 | 12–13 | 20 | 09–10 | 13 | Grandes oreilles [1] | Gagne le Talent Sens aiguisé (Ouïe) |
| 17–19 | 14–15 | — | 11 | — | Pattes d'oiseau [3] | Gagne le Trait de créature Arboricole |
| 20–21 | 16 | — | 12 | | Visage sans traits [1] | Gagne le Trait de créature Peur 2 |
| 22 | 17 | 21–22 | 13 | 14–15 | Souffle du feu | Gagne le Trait de créature Souffle 5 (Feu) |
| 23 | 18–19 | 23 | 14–16 | — | Exophtalmie [1] | +10 Initiative |
| 24 | 20 | 24–25 | — | — | Peau ardente [3] | Les créatures ou objets qui vous touchent physiquement doivent réussir un Test d'Athlétisme ou gagner un État En flammes |
| 25–26 | 21–22 | 26–27 | 17–19 | 16–17 | Carapace [1] | +1 PA sur deux Localisations au hasard |
| 27–28 | 23–24 | 28–31 | 20–21 | 18–20 | Griffes [3] | Les mains comptent comme une Arme aux Dégâts équivalents à votre Bonus de Force |
| — | 25 | — | 22–25 | — | Nuage de mouches [3] | Gagne le Trait de créature Perturbant |
| — | 26 | — | 26–29 | 21–22 | Corpulent | -1 Mouvement, +5 Force, +5 Endurance |
| 29–30 | 27–28 | 32 | 30–31 | 23–24 | Crête sur la tête [3] | Gagne le Talent Attirant avec les mutants et les hommes-bêtes |
| 31–32 | 29–30 | 33–35 | 32 | 25–27 | Cri assourdissant | Gagne le Trait de créature Perturbant |
| 33–34 | 31 | 36 | — | 28–29 | Doigts distendus [3] | +10 Dextérité |
| 35–36 | 32–33 | — | 33–34 | 30–32 | Bras élastiques | Toute arme de corps à corps compte comme ayant une Allonge de deux pas supérieure |
| 37 | 34 | 37–39 | 35–37 | 33 | Émacié | -10 Force, +5 Agilité |
| 38–39 | 35 | — | 38–39 | 34–36 | Mauvais œil [3] | Peut lancer le Sort Mauvais œil (LDB 49 p.255) en dépensant 1 Chance, sans Test ; subit une Incantation imparfaite mineure |
| 40–41 | 36 | 40–41 | — | 37 | Articulations supplémentaires | +5 Agilité |
| 42–44 | 37 | 42–43 | 40 | 38–40 | Bouche supplémentaire [1] | Jet sur le Tableau des Localisations |
| 45 | 38–39 | — | 41–43 | 41 | Œil pédonculé [3] | Voit par dessus ou autour des obstacles |
| 46–47 | 40 | — | 44–46 | 42–44 | Tentacule épais [1] | Gagne le Trait de créature Tentacules |
| 48 | 41–43 | — | 47–51 | — | Odeur pestilentielle | Gagne le Trait de créature Perturbant |
| 49 | 44 | 44 | 52 | 45–46 | Fourrure [3] | Ne souffre plus de l'Exposition aux climats froids ; effets de l'Exposition aux climats chauds doublés (LDB 18 l.326-334) |
| 50 | 45–47 | — | 53–54 | 47–48 | Branchies [1] | Peut respirer sous l'eau |
| 51–52 | 48 | 45–47 | — | 49–50 | Peau brillante [3] | Équivaut à la lueur d'une chandelle |
| 53 | 49 | 48–50 | 55–56 | — | Sans tête [3] | Gagne le Trait de créature Peur 2 ; les coups portés à la tête sont considérés comme ratés |
| 54 | 50–51 | 51 | 57–58 | 51 | Sauteur [3] | Mouvement réduit de 2, ne peut être augmenté ; gagne le Trait de créature Bond |
| 55 | 52 | — | — | 52–57 | Beauté surnaturelle | +10 Sociabilité, jamais de cicatrices |
| 56 | 53–54 | 52–55 | — | 58–59 | Peau d'acier | +2 PA à toutes les Localisations, -10 Agilité |
| — | 55 | 56–58 | 59 | 60–61 | Langue pendante [3] | -10 à tous les Tests de Langue en parlant |
| 57–58 | 56–57 | 59 | — | 62–63 | Longs bras [3] | Si armes de même Allonge, la vôtre est considérée comme plus longue (LDB 62 p.297) |
| 59–60 | 58–59 | 60 | — | 64 | Longues jambes [3] | +2 Mouvement |
| 61–62 | 60–61 | — | — | 65 | Long cou [3] | La moitié des coups au corps sont des coups à la tête |
| 63–64 | 62 | 61–63 | 60–61 | 66–67 | Bras multiples [3] | Gagne une Attaque gratuite |
| 65–66 | 63–64 | 64–65 | 62–63 | 68–69 | Jambes multiples [3] | +1 Mouvement |
| 67 | 65–66 | 66 | 64–66 | 70 | Œil unique [1] | -20 CT |
| 68–70 | 67 | — | — | 71–72 | Plumes éparses | Double jet sur le Tableau des Localisations |
| — | 68–69 | 67 | 67–68 | 73 | Crétin [3] | -40 Int (min 10) ; gagne le Trait de créature Stupide |
| — | 70–71 | 68 | 69 | 74 | Tête pointue | Gagne Stupide ; ne peut pas porter de heaume standard ; -5 Int ; -10 Soc ; +1 PA Tête |
| 71–73 | 72 | 69 | 70–72 | — | Visage difforme [1] | Gagne Peur 1 ; -20 Intuition pour ceux qui essaient de détecter vos mensonges |
| — | — | 73 | — | 73–78 | Chair putréfiée | Gagne Peur 3 et -20 Soc |
| 74–76 | 74–75 | 70 | — | 75–77 | Couleurs changeantes [3] | Gagne le Trait de créature Perturbant |
| 77 | 76–77 | 71 | 79 | 78 | Court sur pattes [3] | -1 Mouvement |
| — | 78–79 | 72–75 | — | — | Tête de mort [1] | Gagne le Trait de créature Peur 2 |
| — | — | 80 | 76–78 | — | Peau hérissée de pointes [1] | Ne peut pas porter d'armure ; +1 PA sur toutes les Localisations ; gagne une attaque gratuite (Arme +4) lors d'une Charge |
| 78–79 | 81–82 | 79 | 80–81 | 82–83 | Mains et pieds à ventouses [1] | Gagne le Trait de créature Grimpant |
| 80–82 | 83–84 | 80–81 | 82–84 | 84–85 | Queue [1] | Gagne le Trait de créature Attaque caudale +3 |
| 83 | 85 | 82–84 | — | 86–87 | Écailles épineuses [1] | -10 Dex ; -10 Soc ; +1 PA à toutes les Localisations |
| 84 | 86–87 | 85 | 85–87 | 88–90 | Trois yeux [1] | Gagne le Talent Sens aiguisé (Vue) |
| 85 | 88 | 86 | 88–89 | — | Peau transparente [3] | Gagne le Trait de créature Peur 2 |
| 86–87 | 89–90 | 87–88 | 90 | 91–92 | Bicéphale [3] | Gagne le Talent Ambidextre |
| 88 | 91 | 89–92 | 91–92 | — | Cornes asymétriques [3] | +1 PA à la tête ; compte comme un Trait Arme dont l'indice est égal à votre BF |
| 89–91 | 92–94 | 93–94 | 93–94 | 93–95 | Peau étrange [3] | Couleur ou texture inhabituelle (orange, rayée, tachetée, à pustules…) |
| 92–95 | 95 | 95–96 | — | 96–97 | Malefrénésie | Gagne le Trait de créature Frénésie ; quand en Frénésie, gagne temporairement une autre mutation aléatoire |
| 96 | 96–97 | 97 | 95–96 | 98 | Pieds palmés [1] | Gagne le Trait de créature Amphibie |
| — | 98 | 98 | 97–00 | — | Suintement de pus | Lancer sur le Tableau de localisation |
| 97 | 99 | 99 | — | — | Groin poilu [1] | +10 Pistage |
| 98–00 | 00 | 00 | — | 99–00 | Ailes [1] | Gagne le Trait de créature Vol 60 |

**Notes de la table :**
1. Mutation dissimulable seulement par des vêtements.
2. Test d'**Athlétisme Complexe (-10)** pour marcher à allure normale (Pattes).
3. Mutation **non dissimulable**.

**Sources RAW** : `EDOC 12 l.63-147`

### Tableau Tête Bestiale (d100, sous-table)

Utilisée quand la table physique étendue indique « Tête bestiale ». Lance sur cette sous-table pour déterminer l'animal.

| Toute Pce | Khorne | Nurgle | Slaanesh | Tzeentch | Animal | Effets |
|---|---|---|---|---|---|---|
| 01–10 | 01–05 | 01–10 | 01–05 | 01–05 | Ours | +1 PA à la tête ; gagne le Trait de créature Morsure +9 |
| 11–20 | 06–15 | 11–25 | 06–20 | 06–10 | Sanglier | +1 PA à la tête ; gagne le Trait de créature Cornes (Défenses) |
| 21–30 | 16–25 | 26–45 | — | 11–15 | Taureau | +1 PA à la tête ; gagne le Trait de créature Cornes |
| 31–40 | 26–30 | 46–60 | 21–35 | 16–25 | Chien | Gagne le Trait de créature Morsure +5 ; gagne le Talent Sens aiguisé (Odorat) |
| 41–50 | 31–35 | 61–65 | 36–40 | 26–35 | Aigle | Gagne le Trait de créature Morsure +4 |
| 51–60 | 36–50 | — | 41–60 | — | Rat | Gagne le Trait de créature Morsure +3 et Infecté |
| 61–70 | 51–55 | — | 61–80 | — | Araignée géante | Gagne le Trait de créature Morsure +3 et Venin (Intermédiaire) |
| 71–80 | 56–80 | 66–80 | 81–95 | 36–75 | Chèvre | Gagne le Trait de créature Cornes |
| 81–90 | 81–95 | 81–99 | — | 76–80 | Loup | +1 PA à la tête ; gagne le Trait de créature Morsure +6 ; gagne le Talent Sens aiguisé (Odorat) |
| 91–00 | 96–00 | 00 | 96–00 | 81–00 | Serpent | +1 PA à la tête ; gagne les Traits de créature Morsure +3 et Venin (Accessible) |

**Sources RAW** : `EDOC 12 l.150-168`

### Table Mentale étendue (d100, par dieu)

| Toute Pce | Khorne | Nurgle | Slaanesh | Tzeentch | Nom | Effets |
|---|---|---|---|---|---|---|
| 01–05 | 01 | — | 01–02 | 01–03 | Fuite aethyrique | Gagne le Talent Sorcier ! ; -5 Sociabilité, -5 Intelligence |
| 06–09 | 02–04 | 01–05 | 03–04 | 04–06 | Esprit animal | Gagne le Trait de créature Bestial pendant 1d10 heures après un échec à un Test lié à la FM |
| 10–11 | 05–08 | 06–09 | 05–07 | 07–10 | Atroces désirs | -5 Sociabilité, -5 Force Mentale |
| 12–16 | 09 | 10–11 | 08–10 | 11–13 | Modèle de corruption | Si soumis à Psychologie, gagne le Trait de créature Corruption (Mineure) ; -10 Sociabilité |
| 17–19 | 10–13 | 12–17 | 11–14 | 14–15 | Bête intérieure | +10 FM ; -5 Soc ; -5 Int |
| 20–21 | 14–15 | 18–21 | 15–17 | 16–19 | Douleur transcendée | Gagne le Trait de créature Insensible à la douleur ; -20 Initiative, -20 Intelligence |
| 22–24 | 16–19 | 22–24 | 18–21 | 20–23 | Âme blasphématoire | Gagne le Trait de créature Haine (Religion) ; +10 FM |
| — | 20–22 | 25–29 | 22–25 | 24–25 | Esprit anéanti | Gagne le Trait Immunité Psychologique pendant 1d10 Rounds lorsque vous prenez un État Brisé ; ensuite subissez 1d10 États Brisé |
| 25–29 | 23–24 | 30–33 | 26–27 | 26–28 | Rêves chaotiques | État Exténué les deux premières heures suivant le réveil chaque jour |
| — | 25–27 | 34–35 | 28–32 | 29–31 | Formication | -5 Initiative, -5 Dextérité |
| 30–34 | 28–30 | 36–38 | — | 32–34 | Imprévisible fantaisiste | -5 Initiative, -5 FM |
| — | 31–33 | 39–43 | — | 35–37 | Haine sporadique | Gagne Haine (Cible) ; lancer sur le Tableau des Obsessions au début de chaque jour |
| 35–39 | 34–35 | — | — | 38–41 | Corruption sublime | Gagne l'État Exténué chaque semaine sans gain de Corruption (ou sans avoir fait gagner de Corruption à autrui) ; perte des États Exténués si l'une ou l'autre situation se produit |
| 40–41 | 36–38 | 44–48 | 33–35 | — | Pulsions de haine | Sujet à Animosité envers toutes les autres races |
| 42–44 | 39–42 | 49–50 | 36–38 | 42–45 | Cœur desséché | +10 FM, -10 Soc |
| 45–47 | 43–47 | — | 39–43 | 46–48 | Désespoir obsédant | Gagne le symptôme Malaise pendant 1d10 heures en cas d'échec à un Test lié à la FM |
| — | 48–49 | 51–54 | 44–46 | 49–53 | Masochisme pressant | Gagne le Trait Belliqueux : impossible de Fuir volontairement (LDB 15 p.165) |
| 48–52 | 50–52 | — | — | 54–58 | Pensées envieuses | -10 Sociabilité |
| 53–54 | 53–55 | — | 47–51 | — | Répugnance persistante | Gagne le Symptôme Nausée pendant 1d10 heures après avoir été confronté à de la saleté |
| — | 56–58 | — | 52–56 | 59–62 | Esprit solitaire | -10 à tous les Tests lorsque le Personnage est seul |
| — | 59–61 | 55–57 | 57–59 | 63–64 | Blocage mental | -10 Intelligence |
| 55–58 | 62–63 | 58–60 | 60–62 | — | Errance mentale | -10 Int, +10 FM ; gagne le Trait Stupide si seul |
| 59–61 | 64–66 | — | 63–66 | 65–67 | Paranoïa galopante | Gagne le Trait Nerveux, +10 Initiative |
| 62–64 | 67–69 | 61–63 | 67–70 | 68–72 | Panique extrême | -10 FM, +10 Agilité |
| 65–66 | 70–72 | 64–66 | 71–74 | 73–76 | Faim intense | Gagne le Trait de créature Affamé |
| 67–71 | 73–76 | 67–68 | 75–78 | 77–78 | Moral en berne | Gagne l'État Brisé en cas d'échec à un Test lié à la FM |
| 72–75 | 77–79 | 69–71 | 79–83 | 79–81 | Maladie de l'âme | Gagne le Symptôme Convulsions pendant 1d10 heures en cas d'échec à un Test lié à la FM |
| 76–80 | 80–82 | 72–75 | 84–85 | 82–83 | Esprit suspicieux | -5 Initiative, -5 Intelligence |
| 81–83 | 83–86 | 76–77 | 86–87 | — | Terribles phobies | Gagne le Trait Effrayé (Cible) ; déterminer la Cible avec un jet sur le Tableau des Obsessions |
| 84–86 | 87–89 | 78–82 | — | 84–87 | Accro à l'adrénaline | +10 FM, -10 Initiative |
| 87–88 | 90–92 | 83–87 | 88–92 | 88–90 | Visions torturées | -10 Initiative |
| 89–93 | 93–94 | 88–92 | 93–97 | 91–94 | Totalement déséquilibré | -20 Soc, +10 FM |
| 94–97 | 95–97 | 93–97 | — | 95–98 | Infinie malveillance | -10 aux Tests ne blessant personne ; +10 sur les Tests visant à blesser |
| 98–00 | 98–00 | 98–00 | 98–00 | 99–00 | Affreusement nerveux | +5 Agilité, -5 Sociabilité |

**Tableau des Obsessions** (pour Haine sporadique et Terribles phobies — jet 2d10) :

| 2d10 | Obsession | 2d10 | Obsession |
|---|---|---|---|
| 2 | Objets inanimés | 12 | Nains |
| 3 | Pauvreté | 13 | Elfes |
| 4 | Feu | 14 | Animaux sauvages |
| 5 | Figures/Symboles de guerre | 15 | Animaux domestiques |
| 6 | Figures/Symboles d'autorité | 16 | Magie |
| 7 | Figures/Symboles religieux | 17 | Maladie |
| 8 | Monstres | 18 | Eau |
| 9 | Mutants | 19 | Richesse |
| 10 | Halflings | 20 | Bonheur |
| 11 | Humains | | |

**Sources RAW** : `EDOC 12 l.170-246`

---

## Magie du Chaos — gain de Corruption à l'apprentissage (LDB Talents)

> « Par accident ou à dessein, vous avez cédé une partie de votre âme à l'un des Dieux Sombres, et pouvez à présent pratiquer les infâmes magies du Chaos. Votre chef de la Ruine vous confère immédiatement l'accès à un seul Sort du Domaine choisi et vous gagnez un Point de Corruption lorsque le Sort s'insinue dans votre esprit. Lorsque vous prenez ce Talent, vous apprenez un autre Sort du Domaine choisi et gagnez un Point de Corruption. »
> — LDB 10 l.706-708

Le Talent **Magie du Chaos (Domaine)** coûte 100 PX par prise et confère **+1 Point de Corruption à chaque apprentissage**.

**Sources RAW** : `LDB 10 l.702-710`

---

## Talent Résistance (Mutation) — LDB 10

> « Votre forte constitution vous permet de survivre plus facilement à une menace spécifique. Vous pouvez réussir automatiquement le premier Test pour résister à la menace spécifiée, telle que Magie, Poison, Maladie, Mutation, à chaque séance de jeu. »
> — LDB 10 l.1020

**Maxi** : Bonus d'Endurance.

Quand la menace choisie est **Mutation** : réussir automatiquement le premier Test de Résistance au seuil par séance de jeu. Si le DR requis est important, utiliser le Bonus d'Endurance comme DR.

**Sources RAW** : `LDB 10 l.1016-1020`

---

## Voir aussi

- [`destin.md`](destin.md) — « Je te renie ! » (§ Dépenser de la Résilience)
- [`psychologie.md`](psychologie.md) — Frénésie (Colère impie), Hostilité (Pulsions de haine), Animosité
- [`etats.md`](etats.md) — État Exténué (Rêves chaotiques, Bête intérieure), État Brisé (Morale douteuse)
- [`traumatisme.md`](traumatisme.md) — Collecteur passif unifié `passiveMods(c)` (trauma.ts) qui lit aussi les mutations

---

## Implémentation — src/engine/corruption.ts

### Confirmé implémenté

| RAW | Code | Verdict |
|---|---|---|
| Points de Corruption sur `Combatant.corruption` | `Combatant.corruption` (engine/types.ts) | **OK** |
| `corruptionGain(level, success, dr)` → points selon niveau/DR | `corruptionGain` | **OK** |
| Seuil `corruption > BFM + BE` → Test Résistance Intermédiaire | `corruptionThresholdExceeded` | **OK** |
| Talent Âme Pure → seuil + niveau | `talentCorruptionThreshold(c)` (dispatch) | **OK** |
| Dissolution : -BFM Points, d100 corps/esprit par espèce | `applyMutation` → `mutationKindFor` | **OK** |
| Table corps/esprit par espèce (Elfe/Halfling/Humain/Nain) | `mutationKindFor` | **OK** |
| Tirage sur table physique/mentale | `rollMutation(kind, rng)` (data/mutations) | **OK** |
| Limites : physique > BE ou mentale > BFM → damné | `mutationLimitExceeded` → `hero.damned = true` | **OK** |
| PA naturels des mutations (apAll / apLocations) | `mutationArmourBonus(c, loc)` | **OK** |
| Sombre Pacte (gain volontaire pour relancer) | `gainCorruption` + `pendingCorruption` | **OK** |
| « Je te renie ! : vous pouvez choisir de ne pas développer la mutation obtenue » (LDB 17 l.67) — 1 Résilience, pas de mutation | `resolveRenounce` + `pendingRenounce` | **OK** |
| Mods passifs via collecteur unifié passiveMods | `passive: GameOp[]` sur `Mutation` (mutations.json) | **OK** |
| Traits de créature via mutation (Tentacule, Stupide…) | `attachMutation` → copie `m.traits` sur `c.traits` | **OK** |
| Traits psychologiques via mutation (Frénésie) | `attachMutation` → copie `m.psychTraits` | **OK** |
| Sombres Murmures (LDB 19 l.95-105 — choix OPTIONNEL, refuser garde le PC) | `DialogueChoice.flow` porte `{ op: 'corruption', amount: -1 }` (`src/engine/ops.ts`) ; le choix EST le dialogue d'auteur (accepter/refuser), rien de plus au moteur | **OK** |
| Absolution (LDB 19 l.167-182 — « limites laissées à l'appréciation du MJ ») | quantité AUTHORABLE : `{ op: 'corruption', amount: -n }` (`applyOps`, `src/engine/ops.ts`) décrémente `corruption`, plancher 0, sans passer par `ctx.onCorruption` (pas de seuil/mutation sur un retrait) ; éditable au GameOpEditor (`src/ui/editor/GameOpEditor.tsx`) | **OK** |

### Note : « Écailles Épineuses » — version LDB vs EDOC

La version LDB 19 donne uniquement `+1 PA à toutes les Localisations` (pas de malus). La version EDOC donne `-10 Dex ; -10 Soc ; +1 PA`. La version actuellement dans `mutations.json` suit LDB 19 (source principale). Si la version EDOC est souhaitée pour les PNJ mutants contextualisés, il faudra une entrée distincte.
