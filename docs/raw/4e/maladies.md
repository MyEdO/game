# Atlas RAW — Maladies & Infections

> Base de connaissance des **règles WFRP4 (RAW)**, consolidées sur les livres autorisés, à usage d'agent
> (vérifier que le code respecte le RAW). Chaque règle cite sa source `LIVRE NN l.X-Y`
> (NN = préfixe du fichier de chapitre, l = lignes du `.md` source). **Voir aussi** tisse les renvois
> entre règles ; **Implémente** pointe le(s) module(s) `src/engine/` correspondant(s).
> Conventions d'abréviation : voir [`sources.md`](../sources.md).
>
> Scope : possède Maladies/Infections. Renvoie à `competences.md § Guérison` pour les soins.
> **ZÉRO invention** — tout ce qui n'est pas citable est marqué « RAW tronqué » ou absent.
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

## Sommaire

- [Cycle de vie d'une maladie](#cycle-de-vie-dune-maladie)
- [Utiliser les maladies (règle de table)](#utiliser-les-maladies-règle-de-table)
- [Litanie de la Pestilence — 9 maladies LDB](#litanie-de-la-pestilence--9-maladies-ldb)
- [Symptômes — 12 kinds LDB 20](#symptômes--12-kinds-ldb-20)
- [Créer une maladie (Remuer le Chaudron de Nurgle)](#créer-une-maladie-remuer-le-chaudron-de-nurgle)
- [Traits de créature liés aux maladies](#traits-de-créature-liés-aux-maladies)
- [Suppléments — EDO : Fièvre Cérébrale Pourpre + 2 symptômes + Contagieux](#suppléments--edo--fièvre-cérébrale-pourpre--2-symptômes--contagieux)
- [Suppléments — EDOC : maladies de l'exposition en voyage (Rhume commun, Pneumonie)](#suppléments--edoc--maladies-de-lexposition-en-voyage-rhume-commun-pneumonie)
- [Maladies et parasites aquatiques — MSRC 14](#maladies-et-parasites-aquatiques--msrc-14)
- [Remèdes à base de plantes — MSRC 2 (volet maladies)](#remèdes-à-base-de-plantes--msrc-2-volet-maladies)
- [Guérison et soins (renvoi)](#guérison-et-soins-renvoi)
- [Règle optionnelle « disease-mode »](#règle-optionnelle--disease-mode-)
- [Voir aussi](#voir-aussi)

- **La Mer des Griffes (MDG)** <!-- MDG-INTEGRATION -->
- Maladies à bord — contagion et tonneaux contaminés (MDG)
- Mal de mer (maladie MDG)
- Scorbut (maladie de privation MDG)
- Provisions et privations en mer — eau, rations, faim (MDG)

---

## Cycle de vie d'une maladie

**Sources RAW** : `LDB 20 l.7-15`

Chaque maladie est définie par les champs suivants :

| Champ | Description |
|---|---|
| **Nom** | Nom de la maladie |
| *Description* | Contexte narratif/lore |
| **Contraction** | Condition déclenchant un Test de Résistance ; l'échec déclenche l'incubation |
| **Incubation** | Durée (en jours ou heures) avant que les symptômes n'apparaissent |
| **Durée** | Durée des symptômes actifs si la maladie n'est pas traitée. À la fin, la maladie disparaît |
| **Symptômes** | Effets sur la victime pendant la phase active |
| **Effets permanents** | Conséquences durables après guérison (présents uniquement si applicable) |

**Flux :** Contraction → Test raté → Incubation (jours/heures, pas encore actif) → symptômes ACTIFS (Durée) → résolution (`persistant` : Test de fin ; sinon guérison naturelle).

**Incubation « instantanée »** : certaines maladies ont une incubation de 0 (développement depuis un autre symptôme, `LDB 20 l.27`). Par exemple Infection du Sang et la cascade Persistant → Infection du Sang.

---

## Utiliser les maladies (règle de table)

**Sources RAW** : `LDB 20 l.33-35`

> « Certains groupes apprécient les maladies, parce qu'elles apportent une touche sombre et sans concession à leurs aventures… À l'inverse, certains joueurs considèrent les maladies comme des nuisances à oublier rapidement. C'est à vous et à votre groupe de décider comment vous allez utiliser les maladies dans vos parties, mais gardez à l'esprit qu'elles peuvent être très dangereuses, et qu'il n'est jamais agréable d'avoir un PJ cloué au lit, pendant que les autres membres du groupe partent à l'aventure. **Utilisez-les avec parcimonie.** »

**Règle optionnelle implémentée** : le code expose un paramètre `disease-mode` (voir § [Règle optionnelle « disease-mode »](#règle-optionnelle--disease-mode-)).

---

## Litanie de la Pestilence — 9 maladies LDB

**Sources RAW** : `LDB 20 l.19-128`

> « Voici quelques exemples des différentes infections, pestes et épidémies qui se développent aux quatre coins du Vieux Monde et sont présentées ici comme source d'inspiration pour inventer vos propres maladies. »

### Table récapitulative

| id (`maladies.json`) | Nom | Contraction (Test) | Incubation | Durée | Symptômes |
|---|---|---|---|---|---|
| `infection-mineure` | Infection Mineure | Résistance Très Facile (+60) après Blessure critique | 1d10 j | 1d10 j | blessé, malaise, persistant (Facile) |
| `blessure-purulente` | Blessure Purulente | Résistance Facile (+40) après combat vs créature Infecté ; ou développée depuis Infection Mineure | 1d10 j (ou instantanée) | 1d10 j | fièvre, persistant (Intermédiaire), malaise, blessé |
| `infection-du-sang` | Infection du Sang | Développement d'une autre maladie, ou après Blessure critique | Instantanée | 1d10 j | fièvre (Grave), malaise, toxine |
| `courante-galopante` | Courante Galopante | Endurance Facile (+40) après ingestion de matière infectée | 1d10 h | 1d10 j | intoxication alimentaire (Modérée), malaise, nausée |
| `fievre-du-rongeur` | Fièvre du Rongeur | Résistance Accessible (+20) après combat blessé par rongeur Infecté ; ou Résistance Facile (+40) si source infectée en contact bouche | 3d10+5 j | 3d10+10 j | blessé, convulsion, démangeaisons, fièvre, malaise, persistant (Accessible) |
| `flux-sanglant` | Flux Sanglant | Endurance Facile (+40) après ingestion de matière infectée | 2d10 j | 1d10 j | fièvre, intoxication alimentaire (Grave), malaise, nausée, persistant (Intermédiaire) |
| `peste-noire` | Peste Noire | Résistance Accessible (+20) par heure dans la zone infectée, ou contact fluides infectés | 1d10 min | 3d10 j | bubons, fièvre, gangrène, malaise, toxine (Modérée) |
| `verole-du-tanneur` | Vérole du Tanneur | Résistance Facile (+40) après contact avec animal/peau/cadavres infectés | 1d10 j | 5d10 j | démangeaisons, persistant (Intermédiaire) |
| `verole-urticante` | Vérole Urticante | Résistance Accessible (+20) au toucher d'une personne infectée, ou par toux/éternuement (1 Test/heure) | 1d10 j | 1d10+7 j | démangeaisons, toux et éternuements |

**Effet permanent — Vérole Urticante** (`LDB 20 l.127-129`) : « vous ne pouvez pas l'attraper une seconde fois, si vous l'avez déjà contractée dans le passé. »

---

### Fiches détaillées verbatim

#### Blessure Purulente (`LDB 20 l.22-32`)

> Les coupures infectées et les égratignures sont monnaie courante…

**Contraction :** sur un échec d'un Test de **Résistance Facile (+40)** après un combat vous ayant opposé à une créature avec le Trait Infecté. Vous pouvez également développer une infection à partir d'une *Infection Mineure*.

**Incubation :** 1d10 jours, ou instantanée si développée à partir d'autres symptômes.

**Durée :** 1d10 jours.

**Symptômes :** fièvre, persistante (Intermédiaire), malaise, blessé.

---

#### Courante Galopante (`LDB 20 l.38-45`)

**Contraction :** sur un échec d'un Test d'**Endurance Facile (+40)** après avoir ingurgité de la matière infectée.

**Incubation :** 1d10 heures.

**Durée :** 1d10 jours.

**Symptômes :** intoxication alimentaire (Modérée), malaise, nausée.

---

#### Fièvre du Rongeur (`LDB 20 l.47-58`)

**Contraction :** sur un échec d'un Test de **Résistance Accessible (+20)** après un combat où vous avez été blessé par des rongeurs (dont les skavens) possédant le Trait Infecté, ou sur un échec d'un Test de **Résistance Facile (+40)** après qu'une source infectée est entrée en contact avec votre bouche.

**Incubation :** 3d10+5 jours.

**Durée :** 3d10+10 jours.

**Symptômes :** blessé, convulsion, démangeaisons, fièvre, malaise, persistant (Accessible).

---

#### Flux Sanglant (`LDB 20 l.61-71`)

**Contraction :** sur un échec d'un Test d'**Endurance Facile (+40)** après avoir ingéré de la matière infectée.

**Incubation :** 2d10 jours.

**Durée :** 1d10 jours.

**Symptômes :** fièvre, intoxication alimentaire (Grave), malaise, nausée, persistant (Intermédiaire).

---

#### Infection du Sang (`LDB 20 l.75-82`)

**Contraction :** c'est le développement d'une autre maladie, ou cela intervient après une Blessure critique.

**Incubation :** instantanée.

**Durée :** 1d10 jours.

**Symptômes :** fièvre (Grave), malaise, toxine.

---

#### Infection Mineure (`LDB 20 l.86-91`)

**Contraction :** sur un échec d'un Test de **Résistance Très Facile (+60)** après un combat où vous avez subi une **Blessure critique**.

**Incubation :** 1d10 jours.

**Durée :** 1d10 jours.

**Symptômes :** blessé, malaise, persistant (Facile).

---

#### Peste Noire (`LDB 20 l.93-104`)

**Contraction :** effectuer un Test de **Résistance Accessible (+20)** pour chaque heure entamée passée dans la zone infectée, ou lorsque vous vous retrouvez en présence de fluides infectés.

**Incubation :** 1d10 minutes.

**Durée :** 3d10 jours.

**Symptômes :** bubons, fièvre, gangrène, malaise, toxine (Modérée).

---

#### Vérole du Tanneur (`LDB 20 l.107-112`)

**Contraction :** sur un échec d'un Test de **Résistance Facile (+40)** après être entré en contact avec un animal, de la peau, ou des cadavres infectés.

**Incubation :** 1d10 jours.

**Durée :** 5d10 jours.

**Symptômes :** démangeaisons, persistant (Intermédiaire).

---

#### Vérole Urticante (`LDB 20 l.115-128`)

**Contraction :** sur un échec d'un Test de **Résistance Accessible (+20)** lorsque vous touchez une personne infectée ou que vous échouez à ce même Test après qu'un patient contagieux a toussé ou éternué juste à côté de vous (effectuez un Test par heure).

**Incubation :** 1d10 jours.

**Durée :** 1d10+7 jours.

**Symptômes :** démangeaisons, toux et éternuements.

**Effets permanents :** vous ne pouvez pas l'attraper une seconde fois, si vous l'avez déjà contractée dans le passé.

---

## Symptômes — 12 kinds LDB 20

**Sources RAW** : `LDB 20 l.131-214`

> « Cette section explique la façon dont se manifestent chacun des symptômes des différentes infections. Servez-vous en pour inventer des maladies bien répugnantes. »

### Blessé (`LDB 20 l.144-147`)

Vous avez une blessure ou une plaie ouverte qui ne guérit pas correctement à cause d'une infection. Pour chaque symptôme Blessé dont vous souffrez, **vous ne pouvez pas guérir l'une de vos Blessures**, qui reste donc ouverte et vous fait souffrir. Chaque jour, réussissez un **Test de Résistance Accessible (+20)** ou subissez une *Blessure Purulente* si vous n'en avez pas déjà une.

**Traitement :** un Test de Guérison journalier réussi permet de s'assurer que la Blessure est propre et qu'il n'y a pas besoin d'effectuer de Test de Résistance pour voir si elle s'infecte.

---

### Bubons (`LDB 20 l.149-154`)

Vous êtes victime d'une inflammation des ganglions lymphatiques de l'aine, du cou ou des aisselles. **Pénalité de −10 à tous vos Tests Physiques ainsi qu'à tous vos Tests de Sociabilité** si ces bubons sont apparents (ou peuvent être sentis).

**Traitement :** un succès sur un **Test de Guérison pratiqué par Chirurgie** permet de percer les bubons et d'ôter ainsi la pénalité. Sur un échec, gagnez une *Blessure Purulente*. Si vos bubons sont percés, réussissez un **Test de Résistance Complexe (−10)** ou d'autres les remplaceront.

---

### Convulsions (`LDB 20 l.156-159`)

**Pénalité de −10 à tous les Tests Physiques** alors que votre corps convulse. Si le symptôme est indiqué **(Modéré)**, cette pénalité passe à **−20**. Si le symptôme est indiqué comme **(Grave)**, vous devez être attaché sous peine de risquer de vous blesser tout seul, ce qui vous laisse dans un état d'**incapacité totale**.

**Traitement :** certaines herbes rares et autres mélanges alchimiques permettent d'atténuer les symptômes pendant une journée, transformant Grave en Modéré et Modéré en convulsions normales. Ces mélanges peuvent être composés par quiconque dispose de la Compétence Métier (Apothicaire) et a accès aux ingrédients appropriés (jusqu'à 10 pistoles ou plus par dose). Authentique dans 80 % des cas ; peut être acheté pour une CO/dose chez les Apothicaires.

---

### Démangeaisons (`LDB 20 l.161-165`)

**Pénalité de −10 à tous les Tests de Sociabilité.** Pour vous retenir de gratter, réussissez un **Test de Calme Accessible (+20)**. Lorsque les démangeaisons s'arrêtent, effectuez un **Test de Calme Accessible (+20)** : sur un échec, intervertissez les deux chiffres du résultat → **cicatrice permanente à la Localisation correspondante**. Si la Localisation est la **Tête**, **perdez définitivement 1 Point de Sociabilité**.

**Traitement :** onguents ou huiles. Temples de Shallya : crème gratuite (dons bienvenus). Apothicaires/Herboristes : rarement plus de 6-7 sc/semaine, 90 % d'efficacité. L'utilisation de crème rend les Tests de Calme contre le grattage **Très Facile (+60)**.

---

### Fièvre (`LDB 20 l.171-173`)

**Pénalité de −10 à tous les Tests Physiques et de Sociabilité.** Si la fièvre est indiquée comme **(Grave)**, vous vous retrouvez dans un état de faiblesse totale : gagnez l'**État Inconscient** (la dépense de Points de Détermination peut vous ramener à la conscience pendant quelques minutes).

**Traitement :** nombreux remèdes, souvent inefficaces (seuls **10 %** sont authentiques). Un succès sur un Test de Guérison n'a d'autre effet que d'informer de combien de temps la fièvre persistera. Si le remède est efficace, il supprime les symptômes d'une *Fièvre* (mais **pas d'une Grave**) sur un succès d'un **Test de Résistance Intermédiaire (+0)**.

---

### Gangrène (`LDB 20 l.175-178`)

Effectuez un lancer de pourcentage pour déterminer une **Localisation** (voir Combat). Corps = la Gangrène ne s'est pas propagée. Tête = nez. Bras = doigts. Jambe = pied.

Chaque jour : **Test de Résistance Accessible (+20)**. Sur un succès, la Gangrène est contenue. Sur un échec, elle empire. **Si vous obtenez plus d'échecs que votre Bonus d'Endurance, la Localisation devient totalement inutilisable** → règles d'Amputation (voir Blessures critiques).

Tant que vous souffrez de la Gangrène : **−10 à tous vos Tests de Sociabilité**, symptôme **Blessé**, et **Toxine** (persistant même après guérison de la maladie, tant que le tissu n'est pas amputé).

**Traitement :** le seul traitement vraiment efficace consiste à **amputer** la partie gangrénée.

---

### Intoxication Alimentaire (`LDB 20 l.180-185`)

Le MJ peut décider, n'importe quand au cours de la partie, que vous devez vous isoler. Vous disposez d'un nombre de Rounds équivalent à votre **Bonus d'Endurance** pour trouver un endroit calme. Si l'*Intoxication alimentaire* est **(Modérée)**, le MJ peut vous demander de vous isoler **2 fois** par séance. Si elle est **(Grave)**, **3 fois**, et vous **perdrez une Blessure** à chaque fois.

**Traitement :** traitements efficaces rares (**10 %**). Si efficace, l'*Intoxication alimentaire* peut vous laisser en paix pendant un nombre d'heures équivalent à votre **Bonus d'Endurance**.

---

### Malaise (`LDB 20 l.187-190`)

Vous ne vous sentez pas bien du tout. **Gagnez un État Exténué** dont vous ne pourrez vous défaire qu'une fois votre maladie guérie.

**Traitement :** soignable par des remèdes, généralement efficaces (**75 %**). Si efficace, un **Test de Résistance Intermédiaire (+0)** réussi permet d'ignorer le symptôme durant une journée.

---

### Nausée (`LDB 20 l.193-196`)

Chaque fois que vous échouez à un Test qui implique un déplacement physique, votre nausée prend le dessus et vous vomissez. **Gagnez l'État Sonné** (conséquence des vomissements répétitifs ou de la déshydratation).

**Traitement :** remèdes nombreux et généralement efficaces (**60 %**), environ 30 sc. Si efficace, **Test de Résistance Intermédiaire (+0)** → ignorez les effets de la *Nausée* pendant un nombre d'heures égal à votre **Bonus d'Endurance**.

---

### Persistant (`LDB 20 l.199-202`)

Après que votre maladie est arrivée à la fin de sa Durée, effectuez un **Test de Résistance** (Difficulté indiquée entre parenthèses) :

| Résultat | Conséquence |
|---|---|
| Succès | Guérison |
| Échec Minime (0) | +1d10 jours à la Durée |
| Échec (−2) | Subissez une *Blessure Purulente* |
| Échec Stupéfiant (−6) | Développez *Infection du Sang* |

**Traitement :** légion mais souvent placebos (**10 % authentiques**). Si authentique, pas besoin de Test de Résistance s'il est ingurgité au bon moment (un Test de Guérison réussi détermine le jour exact).

---

### Toux et Éternuements (`LDB 20 l.205-208`)

Vous toussez et éternuez régulièrement, **propageant votre maladie**. Tout Personnage se trouvant dans votre environnement immédiat s'expose à la maladie et doit effectuer un **Test pour éviter la Contraction une fois par heure** d'exposition.

**Traitement :** **rien ne fonctionne**.

---

### Toxine (`LDB 20 l.211-215`)

Le RAW est COMPLET (le verbatim intégral vit dans `symptoms.json`, entrée `toxine` : échec du Test quotidien
= mort ; difficulté indexée sur la sévérité — Très Facile +60, Modéré → Facile +40, Grave → Accessible +20).
IMPLÉMENTÉ (#338) : le cycle est un nœud `test` du Flow — sa branche d'échec (`onTick.test.fail`) porte
`{ op: 'kill' }` (Point de Destin sauve, LDB 17 l.29-37, sinon `Combatant.dead`) ;
`onTick.difficultyBySeverity` indexe la difficulté du nœud sur la sévérité de l'instance
(lu par `symptomOnTick`, `src/engine/disease.ts`).

---

## Créer une maladie (Remuer le Chaudron de Nurgle)

**Sources RAW** : `LDB 20 l.136-141`

> « Nurgle, le dieu du Chaos, de la Maladie et du Désespoir, possède un chaudron bouillonnant installé dans le pire coin de son jardin pourrissant, et à l'intérieur duquel il concocte toutes les épidémies qui ont été, ou seront. »

Pour créer une maladie, définir :
1. **Contraction** — comment on la contracte (Test de Résistance + difficulté)
2. **Incubation** — durée avant l'apparition des symptômes
3. **Durée** — combien de temps durent les symptômes
4. **Symptômes** — piochés parmi les 12 (+ 2 EDO)

**Exemple LDB** : *Toux du charançon* — Résistance Accessible (+20) par contact, 1d10 j incubation, 1d10 j durée, symptômes : Toux et Éternuements + Malaise.

---

## Traits de créature liés aux maladies

**Sources RAW** : `LDB 85 p.340`

### Infecté

> Un héros blessé par la créature porteuse est exposé à une infection. Après le combat : Test de **Résistance Facile (+40)** ou *Blessure Purulente*.

**Cas Rongeur Infecté** : un rongeur (dont skavens) avec Infecté qui blesse un héros → Tests de **Résistance Accessible (+20)** pour *Fièvre du Rongeur* (en plus du Test Blessure Purulente). Source : `LDB 20 l.51` (Fièvre du Rongeur § Contraction).

**Qualité Infecté (arme)** : les munitions portant la qualité Infecté (Aux Armes — ferraille/débris souillés) exposent aussi à la Blessure Purulente.

### Maladie (Type)

La créature est porteuse de la maladie *Type*. Les héros blessés doivent tester leur Contraction selon la difficulté propre à cette maladie.

---

## Suppléments — EDO : Fièvre Cérébrale Pourpre + 2 symptômes + Contagieux

**Sources RAW** : `EDO App.2 l.99-223` (fichier `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/11 - APPENDICE 2 - Nouvelles regles.md`)

> « Cette section ajoute une nouvelle maladie et quelques symptômes supplémentaires pour faciliter vos créations personnelles. »

### Fièvre Cérébrale Pourpre (`EDO App.2 l.103-112`)

> La fièvre cérébrale pourpre est une maladie redoutée. La tête gonfle jusqu'à atteindre une taille impressionnante et s'accompagne de fièvres et de délires. Le visage prend une couleur prune effrayante, les yeux sortent de leurs orbites et la langue gonfle jusqu'à ce que la bouche ne puisse plus la contenir. La mort survient généralement au bout d'une semaine.

**Contraction :** si vous échouez à un Test d'**Endurance Accessible (+20)** lors d'un contact physique avec un individu infecté (à raison de **1 Test par heure d'exposition**).

**Incubation :** 1d10 heures.

**Durée :** 1d10 jours.

**Symptômes :** Convulsions, Délire, Fièvre (Grave), Gonflement (Visage et tête), Persistant (Difficile), Toxine.

---

### Délire (`EDO App.2 l.117-141`)

Faites un **Test de Force Mentale Intermédiaire (+0)** toutes les heures :

| 1d10 | Effet |
|---|---|
| 1-2 | **Épisode lucide** : période de calme reposant. Tous les États acquis à cause du délire sont supprimés. |
| 3-5 | **Sommeil agité** : vous vous tournez et retournez. Gagnez **1 État Inconscient** pendant l'heure suivante et **1 État Exténué** pendant les 1d10 heures suivantes. |
| 6-9 | **Confusion** : en proie à des visions étranges. Gagnez **1 État Sonné** pendant l'heure qui suit. |
| 10 | **Hallucinations** : visions terrifiantes — **Test contre Terreur 3** toutes les 10 minutes pendant l'heure suivante. Gagnez également **+1 État Sonné** pendant les 1d10 heures suivantes. |

**Traitement :** mêmes remèdes que la fièvre, 10 % authentiques. Avec le bon médicament, un **Test de Guérison Intermédiaire (+0)** réussi bannit les hallucinations pendant **1d10 heures**. Tranquillisants (fleur de lune, lotus noir) : sommeil agité jusqu'à rémission ou mort.

---

### Gonflement (Localisation) (`EDO App.2 l.143-173`)

Une partie du corps gonfle jusqu'à plusieurs fois sa taille normale, virant au rouge ou au violacé, devenant presque inutilisable.

| Localisation | Effet |
|---|---|
| **Tête** | Manger impossible ; liquides sirotables en petites quantités. Tous les Tests nécessitant la parole sont **3 niveaux plus difficiles**. |
| **Bras** | Le bras et la main gonflent ; articulations immobilisées. Pour la durée du gonflement, le bras est considéré comme **amputé** (WFJDR p.180). |
| **Corps** | Tous les Tests impliquant un mouvement deviennent **3 niveaux plus difficiles**. |
| **Jambe** | La jambe gonfle de façon grotesque. Pour la durée du gonflement, la jambe est considérée comme **amputée** (WFJDR p.180). |

**Traitements :**

- **Bain d'eau glacée** : Test étendu de Guérison Difficile (−20), +3 DR, réduit le gonflement de 2d10 heures. Chaque Test dure 1 heure. Le patient gagne +1 Exténué par Test.
- **Saignées** : Test étendu de Guérison Impossible (−50), +4 DR, réduit de (1d10 + BE du patient) heures. Chaque Test dure ½ heure. *(La Difficulté est réduite d'1 niveau par Blessure subie avant le Test.)*
- **Cataplasmes** : Test étendu de Guérison Complexe (−10), +5 DR, 1 cataplasme/Test, réduit de (2d10 + BE) heures. Chaque Test dure 10 minutes.

---

### Trait Contagieux (Type) (`EDO App.2 l.220-221`)

> La créature héberge la maladie indiquée, et elle peut la transmettre au toucher. Dans ce cas, la victime doit tester s'il y a Contraction, mais le **Test est de 2 niveaux plus difficile que la normale**. Si la maladie est contractée, son **incubation est changée en « Instantanée »**.

**Distinction vs Infecté** : Infecté → Blessure Purulente par défaut ; Contagieux → maladie nominée, difficulté aggravée, incubation instantanée.

---

## Suppléments — EDOC : maladies de l'exposition en voyage (Rhume commun, Pneumonie)

**Sources RAW** : `EDOC 08 l.88-122` (fichier `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon/08 - CHAPITRE 5 - Voyager.md`)

Deux maladies liées à l'option de voyage « Attraper Froid ». Elles forment une CHAÎNE : le rhume mue en
pneumonie, laquelle porte un Test de cycle QUOTIDIEN qui aggrave puis étend ses symptômes.

**Exposition** (`EDOC 08 l.90-92`) :

> « À la fin de chaque étape, tout Personnage exposé à la pluie ou à la neige sans un bon manteau et une tente, ou un autre abri, doit faire un Test d'**Exposition** (**WFJDR** page 181). Les Personnages exposés à une averse ou à un blizzard doivent faire le Test même s'ils ont à la fois un manteau et une tente, mais l'absence de l'un ou l'autre rend ce Test **Complexe (-10)**, tandis que l'absence des deux le rend **Difficile (-20)**. »

> « En hiver ou au printemps, tout Personnage ayant souffert de cette exposition aux éléments au cours d'une étape de son voyage contracte également un rhume, dont les effets se manifestent lors de la phase d'arrivée (voir page 38). »

---

### Pneumonie (`EDOC 08 l.94-108`)

> « Cette accumulation de liquide dans les poumons causée par d'autres maladies, provoque une inflammation, de la fièvre et parfois même la mort. La pneumonie est connue sous le nom familier de « hochet de Morr », à cause du bruit émis lorsque la personne infectée tente de respirer profondément. »

**Contraction :** Voir rhume commun

**Incubation :** Instantanée **Durée :** 3d10 jours

**Symptômes :** Toux et éternuements, fièvre, malaise.

**Cycle quotidien** (`EDOC 08 l.104-108`) :

> « Un Personnage atteint de pneumonie doit réussir un Test de **Résistance Intermédiaire (+0)** chaque jour où il fait des efforts en voyage, en combat ou toute autre activité physique. En cas d'échec, le symptôme Fièvre devient Grave. Tant que le symptôme Fièvre (Grave) est en vigueur, le même Test doit être réussi chaque jour, sinon la maladie développe également le symptôme Toxine. »

**Écart d'implémentation** (#674) : la condition « chaque jour où il fait des efforts » n'est pas portée
par le moteur — aucun signal d'effort à l'échelle de la JOURNÉE n'y existe (`Combatant.effortRounds`
compte des Rounds de combat, `LDB 16 l.97`). Le Test est donc roulé à chaque jour d'entretien.

---

### Rhume commun (`EDOC 08 l.110-122`)

> « Saisonnier, comme l'embrasement coloré des feuilles en automne, le rhume est néanmoins un fléau constant du Vieux Monde. Ce qui commence par une faible toux et quelques éternuements peut se transformer en quelque chose de plus grave en quelques jours, si l'on n'y prend garde. »

**Contraction :** si vous échouez à un Test de **Résistance Intermédiaire (+0)** lorsque vous êtes exposé aux éléments, ou lorsqu'une personne infectée éternue ou tousse dans votre voisinage immédiat.

**Incubation :** 20 + 4d10 heures

**Durée :** 1d10 jours

**Symptômes :** Toux et éternuements, malaise.

**Prolongation et MUE** (`EDOC 08 l.122`) :

> « Les Personnages atteints du rhume qui sont à nouveau exposés à la pluie ou à la neige voient la durée de la maladie prolongée de 1d10 jours. Si un Personnage souffre d'un rhume pendant plus de 14 jours, la maladie se transforme en pneumonie. »

**Voir aussi** : [`deplacement.md` § Option « Attraper Froid »](deplacement.md) — le déclencheur d'exposition par étape de voyage.

---

## Maladies et parasites aquatiques — MSRC 14

**Sources RAW** : `MSRC 16 l.4-160` (fichier `Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/16 - CHAPITRE 14 - Maladies transmises par l'eau.md`)

> « Les voies navigables de l'Empire s'étendent des ruisseaux de montagne étincelants aux marais et marécages fétides. Les rivières qui traversent les villes peuvent être de véritables égouts à ciel ouvert… Chaque fois qu'une personne boit de l'eau de rivière sans la faire bouillir au préalable, elle risque de contracter une maladie ou d'ingérer un parasite. »

**Déclencheurs d'exposition** (`MSRC 16 l.6-9`) :
- **Ingestion volontaire** d'eau de rivière non bouillie → Test de Résistance.
- **Ingestion involontaire** : échec à un Test de Natation → Test de **Force Mentale Intermédiaire (+0)** pour éviter d'avaler de l'eau.
- **Immersion avec blessures ouvertes** : à la discrétion du MJ.

### Tableau d'exposition 1 — Source d'eau (`MSRC 16 l.10-14`)

*S'applique à l'ingestion et à l'immersion.*

| Emplacement | Modificateur |
|---|---|
| Grande ville ; marais | −30 |
| Dans un rayon de 8 km en aval d'une grande ville ou d'une ville | −20 |
| Dans un rayon de 3 km en aval d'une ville | −10 |
| Campagne | 0 |
| En amont de toute habitation | +10 |

### Tableau d'exposition 2 — Blessures et États (`MSRC 16 l.35-47`)

*S'applique uniquement à l'immersion. Tous les modificateurs sont cumulables.*

| État | Modificateur |
|---|---|
| 1 Blessure ou moins restante | −30 |
| 5 Blessures ou plus perdues | −20 |
| 1-4 Blessures perdues | −10 |
| Par État Hémorragique | −10 |
| Par État Assommé | −5 |
| Par État Empêtré | −5 |
| Inconscient | −20 |

**Résolution** (`MSRC 16 l.16-49`) : Test de **Résistance Intermédiaire (+0)**, modifié par les deux tableaux ci-dessus (cumulables). En cas d'échec, lancer 1d100 + (+10 par DR négatif) sur le Tableau des maladies ci-dessous.

### Tableau des maladies transmissibles par l'eau (`MSRC 16 l.51-63`)

| 1d100 | Maladie |
|---|---|
| 01–40 | Courante Galopante *(LDB 20)* |
| 41–60 | Colique *(MSRC 14)* |
| 61–70 | Infection Mineure *(LDB 20)* [1] |
| 71–75 | Blessure Purulente *(LDB 20)* [1] |
| 76–80 | Vers de Carie *(MSRC 14)* |
| 81–90 | Vers du Reik *(MSRC 14)* |
| 91–00 | Flux Sanglant *(LDB 20)* |

[1] Relancez si le Personnage n'est pas blessé.

---

### Vers de Carie (`MSRC 16 l.71-86`)

> « Le ver de carie est un parasite inquiétant qui infeste les eaux sales et les denrées alimentaires avariées. D'une longueur d'environ 2,5 cm et d'une largeur de 6 mm, ce ver a une peau marbrée vert-brun qui forme un étrange motif de crâne au niveau de sa tête. »

**Contraction :** exposition à de l'eau sale ou à des aliments avariés ; Tests comme décrits dans les tableaux d'exposition ci-dessus.

**Incubation :** 5 + 1d10 jours.

**Durée :** 1 semaine.

**Symptômes :** spéciaux (progression en trois phases décrites ci-dessous).

**Phase 1 — Colonisation buccale** (`MSRC 16 l.76-76`) : Le ver s'enfonce dans les tissus mous de la bouche ou de la gorge, sécrétant un liquide anesthésiant. Tant qu'il demeure, pénalité de **−10 à tous les Tests**.
- Chaque jour : Test de **Perception Intermédiaire (+0)** pour détecter la présence du ver.
- **Retrait (Médecin/Personnage qualifié)** : Test de **Guérison Accessible (+20)**. Les non-qualifiés : Test de **Dextérité Intermédiaire (+0)** ; avec miroir si auto-traitement (−10). Échec → État *Hémorragique*.

**Phase 2 — Migration cérébrale** (`MSRC 16 l.77-79`) : Au bout d'une semaine sans extraction, le ver se dirige vers le cerveau. Détection : Test de **Perception Accessible (+20)** (sang s'écoulant de la bouche). Retrait désormais : Test de **Guérison Complexe (−10)** + Talent **Chirurgie** requis.

**Phase 3 — Ponte irréversible** (`MSRC 16 l.80-86`) : Après trois jours supplémentaires sans extraction, le retrait tue l'hôte. Chaque jour, Test d'**Endurance Accessible (+20)** ; sur un échec : 1d10 + DR négatifs sur le tableau suivant.

| Résultat modifié (1d10) | Effet |
|---|---|
| 1–2 | −1d10 Initiative |
| 3–4 | −1d10 Intelligence |
| 5–6 | −1d10 Force Mentale |
| 7–8 | −1d10 Sociabilité |
| 9 | Gain du Trait Nerveux |
| 10 | Gain du Trait Stupide |
| 11–12 | Gain du Trait Bestial |
| 13 | Mort |

Les œufs éclosent 1d10 jours après la ponte, suintant des narines. Toutes les pénalités sont **permanentes** (seuls des moyens magiques ou miraculeux peuvent les annuler).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MSRC 16` (l.4-160) → `waterTableSchema`, `waterAppliesToSchema`, `isWounded`, `onTickSchema`, `doc`, `autoExposureMods`, `DiseaseDef`, `OPS_FIELDS`, `water-exposure`, `Disease`, +41 — `src/data/combat-stakes.json`, `src/data/index.ts`, `src/data/maladies.json`, `src/data/regles.json`, `src/data/schemas/defs-scenes/worldmap.ts`, `src/data/schemas/defs/maladies.ts`, +20 fichiers

---

### Colique (`MSRC 16 l.104-118`)

> « Le patient est saisi par des douleurs abdominales aiguës qui donnent son nom à cette maladie. Elles surviennent de manière irrégulière, sans prévenir… »

**Contraction :** exposition à de l'eau sale ; Tests comme décrits dans les tableaux d'exposition ci-dessus.

**Incubation :** 2 heures.

**Durée :** 2d10 jours.

**Symptômes :** Crampes abdominales, Fièvre, Intoxication alimentaire (Modérée), Nausée.

**Traitement** (`MSRC 16 l.109-111`) : Aucun remède à base d'herbes n'est plus efficace qu'un autre. Seul vrai traitement : s'hydrater (compenser la perte de liquides) et attendre.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MSRC 16` (l.104-118) → `water-exposure`, `crampes-abdominales`, `applyOnFailInline`, `colique`, `vers-de-carie`, `vers-du-reik`, `tickDisease`, `exposition-hydrique`, `GameOp`, `SymptomCapabilities`, +1 — `src/data/combat-stakes.json`, `src/data/index.ts`, `src/data/maladies.json`, `src/data/regles.json`, `src/data/symptoms.json`, `src/engine/disease.ts`, +1 fichiers

---

### Vers du Reik (`MSRC 16 l.121-144`)

> « Lorsque la minuscule larve du ver du Reik pénètre dans le corps, elle s'enfonce profondément dans les intestins de son hôte, où elle se nourrit et se développe. Rapidement, le système immunitaire de l'hôte est affaibli, ce qui réduit sa résistance à d'autres maladies. »

**Contraction :** exposition à de l'eau sale ; Tests comme décrits dans les tableaux d'exposition ci-dessus.

**Incubation :** 85 + 1d10 jours.

**Durée :** 1 semaine (phase finale visible).

**Symptômes :** spéciaux (voir ci-dessous).

**Effets progressifs** (`MSRC 16 l.137-144`) :
- **Phase d'incubation** : pour chaque tranche de 30 jours complète d'infection, pénalité de **−5 à tous les Tests de Résistance contre les maladies**. Cette pénalité se réduit de 1 point/jour après la mort du ver.
- **Apparition de l'ampoule** (fin d'incubation) : la localisation est déterminée comme en combat (lancer de localisation). Tant que l'ampoule est présente : **−5 à tous les Tests d'Agilité** ; si visible, **−10 aux Tests de Sociabilité** en sus.
- **Jours 1–6 après l'ampoule** : aucun test requis.
- **Jour 7** : Test de **Résistance** toutes les heures. Au premier échec (ou à la dernière heure si tous réussis) : l'ampoule éclate → **1 Blessure** + État *Sonné*. Persiste jusqu'aux soins, peut être atténué temporairement par immersion dans l'eau froide.

**Traitement** : aucun traitement connu. Toute tentative d'extraction chirurgicale fait plus de mal que de bien.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MSRC 16` (l.121-144) → `onTickSchema`, `doc`, `DiseaseDef`, `OPS_FIELDS`, `Disease`, `diseaseTestModLines`, `snapshotInfectionResidual`, `crampes-abdominales`, `resolveInlineFlowTest`, `colique`, +15 — `src/data/index.ts`, `src/data/maladies.json`, `src/data/schemas/defs/maladies.ts`, `src/data/schemas/defs/symptoms.ts`, `src/data/symptoms.json`, `src/engine/conditions.ts`, +10 fichiers

---

### Nouveau symptôme — Crampes Abdominales (`MSRC 16 l.149-160`)

*Symptôme utilisé par la Colique. Non présent dans les 12 symptômes LDB 20.*

**Pénalité de base :** −20 à tous les Tests (crampes douloureuses permanentes).

| Résultat du Test raté | Effet supplémentaire |
|---|---|
| Échec (normal ou pire) | Incapable de bouger ou d'agir pendant le prochain Round ; gagne l'État *Sonné* |
| Échec Impressionnant ou pire | Test de **Force Mentale** ou tombe au sol → État *À Terre* |
| Échec Stupéfiant | S'évanouit → État *Inconscient* |

**Traitement** (`MSRC 16 l.160`) : infusion d'écorce de saule → bonus de +10 à tous les Tests résultant de la colique pendant 1d10 heures. Pas d'autre traitement.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MSRC 16` (l.149-160) → `onTickSchema`, `doc`, `Disease`, `crampes-abdominales`, `resolveInlineFlowTest`, `firingOwnTestFailed`, `colique`, `combatTestPenaltyParts`, `EffectTrigger`, `vers-du-reik`, +10 — `src/data/index.ts`, `src/data/maladies.json`, `src/data/schemas/defs/symptoms.ts`, `src/data/symptoms.json`, `src/engine/conditions.ts`, `src/engine/disease.ts`, +7 fichiers

---

## Remèdes à base de plantes — MSRC 2 (volet maladies)

**Sources RAW** : `MSRC 04 l.184-245` (fichier `Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/04 - CHAPITRE 2 - Les herbes et leurs usages.md`)

> Le chapitre 2 décrit les herbes de l'Empire telles que compilées par Hortensia Flaquepeton dans *La Concordance générale des herbes communes selon les régions*. Seul le volet « maladies » est extrait ici ; l'aspect Guérison des blessures renvoie à `competences.md § Guérison`.

### Table récapitulative — Herbes à usage médical

| Herbe | Préparation | Maladie/symptôme ciblé | Effet | Disponibilité | Saison | Coût |
|---|---|---|---|---|---|---|
| Gesundheit | Cataplasme | Blessure Purulente | Test Résistance Accessible (+20) ; −1 jour par DR ; 1 fois/jour | Limitée | Hiver, Printemps | 15/– |
| Racine des Tombes | Cataplasme | Blessure Purulente (créature mort-vivante) | +20 à tous les Tests de résistance à la blessure pendant 1 journée | Rare | Automne, Hiver | 5 CO |
| Rouille Mouchetée | Cru (dose/jour) | Vérole du Tanneur | +10 à tous les Tests liés à la maladie | Rare | Printemps | 2 CO |
| Rouille Mouchetée | Potion | Vérole du Tanneur | −1d10 jours de durée par dose ; >1 dose/jour → Nausée 1d10 h | Rare | Printemps | 2 CO |

---

### Gesundheit (`MSRC 04 l.184-189`)

**Préparation :** Cataplasme.

**Maladie ciblée :** Blessure Purulente.

> « Un cataplasme de feuilles de gesundheit appliqué sur une Blessure Purulente (WFJDR, p. 186) permet au patient de faire un Test de Résistance Accessible (+20) en réduire la durée d'un jour par DR obtenu. Cette opération peut être réalisée seulement une fois par jour, avec un cataplasme frais à chaque fois, et ce jusqu'à ce que la blessure cesse d'être Purulente. »

**Disponibilité** : Limitée. **Saison** : Hiver, Printemps. **Emplacement** : Forêts mixtes. **Coût** : 15/–.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MSRC 4` (l.184-245) → `blessDiseaseDuration`, `GameOp`, `applyOps`, `gesundheit`, `racine-des-tombes`, `rouille-mouchetee` — `src/data/trappings.json`, `src/engine/ops.ts`, `src/engine/rest.ts`

---

### Racine des Tombes (`MSRC 04 l.204-229`)

**Préparation :** Cataplasme (volet maladies uniquement ; la plante a d'autres usages combat/anti-mortvivant).

**Maladie ciblée :** Blessure Purulente causée par une créature **Mort-vivante** portant le Trait Infecté.

> « Un cataplasme de racine des tombes, appliqué à une Blessure Purulente causée par une créature Mort-vivante qui a le Trait Infecté, donne au patient un bonus de +20 à tous les Tests qu'il pourra faire pour résister à sa blessure pendant la journée. Il n'a aucun effet sur les Blessures Purulentes provoquées par des créatures qui ne sont pas mort-vivantes. »

**Disponibilité** : Rare. **Saison** : Automne, Hiver. **Emplacement** : Clairières, Cimetières. **Coût** : 5 CO.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MSRC 4` (l.204-229) → `gesundheit`, `racine-des-tombes`, `rouille-mouchetee` — `src/data/trappings.json`

---

### Rouille Mouchetée (`MSRC 04 l.241-252`)

**Préparation :** Cru (dose quotidienne) ou Potion.

**Maladie ciblée :** Vérole du Tanneur.

> **Forme crue :** « Si le patient reçoit une dose par jour jusqu'à ce qu'il soit guéri, il bénéficie d'un bonus de +10 à tous les Tests en lien avec la maladie. »
>
> **Forme potion :** « [Elle] peut être utilisée pour la traiter une fois qu'elle est là. Chaque dose réduit la durée de la maladie de 1d10 jours. Prendre plus d'une dose par jour provoque des Nausées (WFJDR, p. 189) pendant les 1d10 heures suivantes. »

*Note :* la potion ne prévient pas la maladie ; elle la traite uniquement après contraction.

**Disponibilité** : Rare. **Saison** : Printemps. **Emplacement** : Collines. **Coût** : 2 CO.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MSRC 4` (l.241-252) → `blessDiseaseDuration`, `GameOp`, `racine-des-tombes`, `rouille-mouchetee` — `src/data/trappings.json`, `src/engine/ops.ts`, `src/engine/rest.ts`

---

## Guérison et soins (renvoi)

**Sources RAW** : `LDB 09 l.262-269` (compétence Guérison), `LDB 10 l.178-184` (Talent Chirurgie), `LDB 41 l.?` (Bénédiction de Convalescence), `LDB 42 l.?` (Miracle Amère Catharsis)

- **Compétence Guérison** : Test réussi → protège le soignant pour ce jour ; chaque DR supplémentaire protège un autre personnage présent. Chaque journée complète aux bons soins : **durée maladie −1 (minimum 1)**. Échec stupéfiant : le patient contracte *Infection Mineure*.
- **Talent Chirurgie** : requis pour percer les Bubons (voir § Symptôme Bubons).
- **Talent Résistance (Maladie)** (`LDB 10`) : réussir automatiquement le premier Test de résistance à la Maladie, une fois par séance.
- **Bénédiction de Convalescence** (`LDB 41`) : réduire la durée d'une maladie active d'une journée. Une seule fois par maladie et par personne.
- **Miracle Amère Catharsis** (`LDB 42`) : aspire un poison ou une maladie, la retirant **complètement** de l'organisme.

→ Détails dans `competences.md § Guérison`.

---

## Règle optionnelle « disease-mode »

Implémentée dans le store (`rule('disease-mode')`) — contrôle l'activation des tests de Contraction en fin de combat :

| Valeur | Comportement |
|---|---|
| `'full'` | RAW complet : Infection Mineure post-critique (Très Facile +60) + Infecté (Facile +40) + Rongeur (Accessible +20) |
| `'off'` | Aucune contraction post-combat automatique (tous les tests supprimés) |
| *(autre)* | Infecté/Rongeur/Maladie(Type) actifs, mais **pas** l'Infection Mineure post-critique |

Source du choix : `LDB 20 l.33-35` (« Utiliser les maladies »).

---

---

## Voir aussi

- `docs/raw/4e/etats.md` — États Exténué / Inconscient / Sonné / Empoisonné / À Terre
- `docs/raw/4e/traumatisme.md` — Blessures critiques, Blessure Purulente post-critique (l.382), soins de blessures
- `docs/raw/4e/competences.md § Guérison` — règles de soins journaliers, réduction de durée, Chirurgie
- `docs/raw/4e/combat.md § Traits de créature` — Infecté, Maladie (Type) (LDB 85)
- `src/engine/disease.ts` — moteur pur
- `src/data/maladies.json` — données app-owned (9 maladies LDB 20 + MSRC Colique/Vers de carie/Vers du Reik)
- `Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/16 - CHAPITRE 14 - Maladies transmises par l'eau.md` — maladies aquatiques + parasites + tableaux d'exposition
- `Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/04 - CHAPITRE 2 - Les herbes et leurs usages.md` — herbes médicinales (Gesundheit, Racine des Tombes, Rouille Mouchetée)

---

<!-- MDG-INTEGRATION -->

## Maladies à bord — contagion et tonneaux contaminés (MDG)

**Sources RAW** : `MDG 14 l.204-209`

La promiscuité à bord et la mauvaise qualité de la nourriture et de la boisson font qu'une maladie se répand vite dans un équipage. Deux règles de contagion spécifiques au navire s'ajoutent au cycle de maladie standard du LDB :

- **Symptôme toux et éternuements à bord** : si un membre d'équipage souffre d'une maladie comportant le symptôme *toux et éternuements*, **tout le monde à bord y est exposé** (et non seulement l'environnement immédiat comme dans la règle générale du LDB chap. 20).
- **Tonneau d'eau contaminé** : un membre d'équipage atteint de *peste noire*, de *flux sanglant*, de *courante galopante* ou de *vérole urticante* qui boit dans un tonneau d'eau doit effectuer un Test de **Résistance Intermédiaire (+0)** ; en cas d'échec, le tonneau devient une **source de contagion** pour quiconque y boit ensuite. La *petite bière* échappe à cette règle.

> « Si un membre d'équipage souffre d'une maladie comportant le symptôme toux et éternuements, tout le monde à bord y est exposé. » — `MDG 14 l.208`

> « Si un membre d'équipage souffrant de la *peste noire*, du *flux sanglant*, de la *courante galopante* ou de la vé*role urticante* boit dans un tonneau d'eau, il doit effectuer un Test de **Résistance Intermédiaire (+0)**. En cas d'échec, le tonneau devient une source de contagion pour quiconque boit dedans ensuite. La *petite bière* n'est pas soumise à cette règle. » — `MDG 14 l.209`

**Voir aussi** : [Symptômes — 12 kinds LDB 20](#symptômes--12-kinds-ldb-20) (Toux et Éternuements) ; [Litanie de la Pestilence — 9 maladies LDB](#litanie-de-la-pestilence--9-maladies-ldb) (peste noire / flux sanglant / courante galopante / vérole urticante) ; [Provisions et privations en mer — eau, rations, faim (MDG)](#provisions-et-privations-en-mer--eau-rations-faim-mdg) (petite bière) ; `docs/raw/4e/etats.md`.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 14` (l.204-209) → `doc`, `MoraleBand`, `DiseaseDef`, `SeaVoyageState`, `mene-de-main-de-maitre`, `excellent-equipage`, `equipage-satisfait`, `canailles`, `mal-de-mer`, `scorbut`, +9 — `src/data/crew-morale.json`, `src/data/maladies.json`, `src/data/schemas/defs/maladies.ts`, `src/data/voyage-stakes.json`, `src/engine/crewMorale.ts`, `src/engine/disease.ts`, +3 fichiers

---

## Mal de mer (maladie MDG)

**Sources RAW** : `MDG 14 l.211-222`

Maladie spécifique de la navigation. La plupart des gens en souffrent à leur première sortie en mer, mais s'y accoutument à force de naviguer ; les **elfes y sont immunisés** (au grand agacement des marins nains). Sa Contraction repose sur deux déclencheurs (premier voyage ; mauvais temps), et sa Durée distingue **deux formes** (manque d'expérience ; océan déchaîné / autre effet temporaire) par la fréquence des Tests.

**Contraction** — les Personnages elfes sont immunisés ; pour les autres, éviter le mal de mer exige de réussir :
- un Test de **Résistance Complexe (−10)** lors d'un **premier** voyage en mer ;
- un Test de **Résistance Intermédiaire (+0)** par **mauvais temps** (Vent violent ou plus).

**Durée** :
- forme « manque d'expérience » : Test de **Résistance Intermédiaire (+0)** **après chaque jour** passé en mer ; un succès rend le Personnage définitivement immunisé à cette forme ;
- forme « océan déchaîné / effet temporaire » : Test de **Résistance Intermédiaire (+0)** **par heure**.

**Symptômes :** malaise, nausée.

> « les Personnages elfes sont immunisés au mal de mer. » — `MDG 14 l.215`

> « Un Test de **Résistance Complexe (-10)** s'ils entreprennent pour la première fois un voyage en mer » — `MDG 14 l.217`

> « Pour le mal de mer parce que l'océan est déchaîné ou à cause d'un autre effet temporaire, effectuez un Test de **Résistance Intermédiaire (+0)** par heure. » — `MDG 14 l.220`

> « **Symptômes :** malaise, nausée. » — `MDG 14 l.222`

**Voir aussi** : [Symptômes — 12 kinds LDB 20](#symptômes--12-kinds-ldb-20) (Malaise → Exténué, Nausée → Sonné) ; [Cycle de vie d'une maladie](#cycle-de-vie-dune-maladie) ; `docs/raw/4e/etats.md`.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 14` (l.211-222) → `doc`, `MoraleBand`, `DiseaseDef`, `SeaVoyageState`, `mene-de-main-de-maitre`, `excellent-equipage`, `equipage-satisfait`, `canailles`, `mal-de-mer`, `scorbut`, +12 — `src/data/crew-morale.json`, `src/data/index.ts`, `src/data/maladies.json`, `src/data/schemas/defs/maladies.ts`, `src/data/voyage-stakes.json`, `src/engine/crewMorale.ts`, +5 fichiers

---

## Scorbut (maladie de privation MDG)

**Sources RAW** : `MDG 14 l.224-234`

Maladie de **privation prolongée** qui frappe ceux qui restent longtemps en mer **sans nourriture correcte**. Progression narrative : fatigue / faiblesse / ennui, puis saignements spontanés et sang trop fluide (plaies ouvertes), enfin fragilisation des os et chute des dents.

**Contraction :** pour **chaque mois passé sans nourriture correcte**, le Personnage effectue un Test de **Résistance Intermédiaire (+0)** ; en cas d'échec, il contracte le scorbut. **Mitigation** — s'il mange régulièrement de la **soupe de chou fermenté**, le Test devient **Résistance Facile (+40)** pour ne pas contracter la maladie.

**Durée :** persiste jusqu'à **1d10 jours après avoir recommencé à manger régulièrement des fruits et des légumes frais** (la durée ne s'écoule pas tant que le régime n'est pas corrigé).

**Symptômes :** blessé, intoxication alimentaire, malaise, nausée. En outre, **1 % de chances de perdre une dent chaque jour**.

> « pour chaque mois passé sans nourriture correcte, le Personnage doit effectuer un Test de **Résistance Intermédiaire (+0)**. En cas d'échec, il a contracté le scorbut. Si le Personnage mange régulièrement de la soupe de chou fermenté, il effectue un Test de **Résistance Facile (+40)**  pour ne pas contracter la maladie. » — `MDG 14 l.230`

> « la maladie persiste jusqu'à 1d10 jours après avoir recommencé à manger régulièrement des fruits et des légumes frais. » — `MDG 14 l.232`

> « **Symptômes :** blessé, intoxication alimentaire, malaise, nausée. 1 % de chances de perdre une dent chaque jour. » — `MDG 14 l.234`

**Voir aussi** : [Provisions et privations en mer — eau, rations, faim (MDG)](#provisions-et-privations-en-mer--eau-rations-faim-mdg) (soupe de chou fermenté ; biscuits de mer ≠ nourriture correcte) ; [Symptômes — 12 kinds LDB 20](#symptômes--12-kinds-ldb-20) (Blessé, Intoxication Alimentaire, Malaise, Nausée) ; `docs/raw/4e/etats.md`.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 14` (l.224-234) → `mousse`, `shipboardSouls`, `scenario`, `SeaVoyageState`, `dailyWaterLitres`, `chirurgien`, `mene-de-main-de-maitre`, `excellent-equipage`, `consumeCrewProvisions`, `equipage-satisfait`, +13 — `src/data/crew-morale.json`, `src/data/crew-roles.json`, `src/data/index.ts`, `src/data/maladies.json`, `src/data/reglesOptionnelles.json`, `src/data/voyage-stakes.json`, +7 fichiers

---

## Provisions et privations en mer — eau, rations, faim (MDG)

**Sources RAW** : `MDG 14 l.236-271`, `MDG 14 l.247-252`, `MDG 15 l.169-170`

Planifier l'approvisionnement est vital pour un long voyage : l'équipage fournit un dur labeur et a besoin de beaucoup d'eau et de nourriture. Acheter n'importe quelle nourriture du marché risque le désastre, car elle **pourrit vite** ; seules les provisions ci-dessous sont prévues pour tenir en mer.

**Consommation et eau** — un tonneau d'eau douce contient **145 litres** ; un membre d'équipage **boit 2 à 3 litres d'eau par jour**. La **petite bière** (un tonneau d'eau + un tonnelet de bière) peut remplacer l'eau : si diluée, elle hydrate et **aide à empêcher la contamination de la boisson** (et échappe à la règle du tonneau contaminé, cf. § Maladies à bord).

> « Un tonneau contient 145 litres d'eau. Un membre d'équipage boit 2 à 3 litres d'eau par jour. » — `MDG 14 l.242`

**Qualité du régime et famine** — les **biscuits de mer** suffisent à **éviter la famine**, mais constituent un **régime très médiocre** (ils ne valent pas une « nourriture correcte » pour le scorbut). Hiérarchie des rations : biscuits de mer < nourriture préservée (viande salée, légumes confits) < soupe de chou fermenté (prévient le scorbut, cf. § Scorbut).

> « Les biscuits de mer suffisent à éviter la famine à bord, mais c'est un régime très médiocre. » — `MDG 14 l.263`

**Table des provisions** (`MDG 14 l.247-252`) — coût / Enc / disponibilité :

| Objet | Coût | Enc | Disponibilité |
|---|---|---|---|
| Tonneau d'eau douce | 8/6 | 9 | Commune |
| Tonneau de petite bière | 11/– | 9 | Commune |
| Ration de biscuits de mer (1 jour) | 1/– | 0 | Commune |
| Ration de nourriture préservée (1 jour) | 2/– | 0 | Commune |
| Ration de soupe de chou fermenté (1 jour) | 3/– | 0 | Limitée |

**Avarie des provisions** — pendant un long voyage, la nourriture peut moisir ou être infestée par la vermine : l'événement de bord **Pénurie de nourriture** gâte alors **la moitié des provisions à bord**.

> « Pénurie de nourriture. La nourriture a moisi ou a été infestée par de la vermine pendant le voyage. La moitié des provisions à bord<br>sont gâtées. » — `MDG 15 l.169-170`

**Voir aussi** : [Scorbut (maladie de privation MDG)](#scorbut-maladie-de-privation-mdg) (soupe de chou fermenté ; biscuits ≠ nourriture correcte) ; [Maladies à bord — contagion et tonneaux contaminés (MDG)](#maladies-à-bord--contagion-et-tonneaux-contaminés-mdg) (tonneau d'eau / petite bière) ; `docs/raw/4e/deplacement.md` (le voyage lui-même). Hors domaine : modificateurs de Moral liés à la nourriture (biscuits seuls / ration insuffisante) — `MDG 14 l.166`, `MDG 14 l.171`.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 14` (l.166, l.171, l.236-271) → `ship-criticals`, `paie-genereuse`, `capitaine-competent`, `faveur-de-manann`, `un-officier-pour-10`, `capitaine-vaillant`, `nourriture-au-dessus-des-rations`, `sealskinDR`, `bon-presage`, `paie-reguliere`, +55 — `src/data/crew-morale.json`, `src/data/crew-roles.json`, `src/data/etats.json`, `src/data/index.ts`, `src/data/maladies.json`, `src/data/reglesOptionnelles.json`, +15 fichiers
- `MDG 15` (l.169-170) → `triton`, `maelstrom`, `puissant-monstre-marin`, `ouragan`, `puissant-vortex`, `nemesis`, `langskip-skaeling`, `bateau-endommage`, `culte-de-la-personnalite`, `infestation-de-rats-geants`, +12 — `src/data/reglesOptionnelles.json`, `src/data/sea-events.json`, `src/i18n/messages/fr.ts`, `src/scenes/loup-et-saumure/loup-et-saumure-projet.json`, `src/state/seaVoyageFlow.ts`

