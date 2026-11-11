# Atlas RAW — Psychologie

> Référentiel autosuffisant des règles WFRP4 (RAW). Chaque règle cite `LDB NN l.X-Y` (source = dernier recours). Voir [`sources.md`](../sources.md), [`00-index.md`](00-index.md).
> Les champs **Implémente** référencent le [rapport calculé](../implemente.generated.md) (`npm run raw:implemente`).

## Sommaire

- [Vue d'ensemble](#vue-densemble)
- [Test de Psychologie — principe général](#test-de-psychologie--principe-général)
- [Traits Psychologiques courants](#traits-psychologiques-courants)
  - [Animosité (Cible)](#animosité-cible)
  - [Peur (Indice)](#peur-indice)
  - [Terreur (Indice)](#terreur-indice)
  - [Frénésie](#frénésie)
  - [Haine (Cible)](#haine-cible)
  - [Préjugé (Cible)](#préjugé-cible)
- [Traits Psychologiques personnalisés](#traits-psychologiques-personnalisés)
  - [Amour](#amour)
  - [Camaraderie](#camaraderie)
  - [Phobie](#phobie)
  - [Trauma](#trauma)
- [Traits de créature psychologiques](#traits-de-créature-psychologiques)
  - [Animosité (Cible) — créature](#animosité-cible--créature)
  - [Belliqueux](#belliqueux)
  - [Effrayé (Cible)](#effrayé-cible)
  - [Frénésie — créature](#frénésie--créature)
  - [Haine (Cible) — créature](#haine-cible--créature)
  - [Immunité Psychologique](#immunité-psychologique)
  - [Nuée — immunité psy](#nuée--immunité-psy)
  - [Peur (Indice) — créature](#peur-indice--créature)
  - [Préjugé (Cible) — créature](#préjugé-cible--créature)
  - [Rage](#rage)
  - [Terreur par Taille](#terreur-par-taille)
  - [À Sang-Froid](#à-sang-froid)
- [Talents liés à la Psychologie](#talents-liés-à-la-psychologie)
  - [Contrôle de la Frénésie](#contrôle-de-la-frénésie)
  - [Effrayant](#effrayant)
  - [Frénésie (talent)](#frénésie-talent)
  - [Haine (Groupe) (talent)](#haine-groupe-talent)
  - [Vice (Cible) (talent et trait)](#vice-cible-talent-et-trait)
  - [Sans Peur (Ennemi)](#sans-peur-ennemi)
- [État Brisé — lien avec la Psychologie](#état-brisé--lien-avec-la-psychologie)
- [Détermination contre la Psychologie](#détermination-contre-la-psychologie)
- [Table récapitulative](#table-récapitulative)

---

## Vue d'ensemble

Les instincts et émotions influencent fortement la façon dont les personnages réagissent en situation. Les règles de Psychologie constituent un système de Traits qui se déclenchent à la rencontre de certains groupes ou créatures, et dont les effets sont résistés ou surmontés par un Test de **Calme** (compétence = FM + avances Calme).

> « Nos instincts et nos émotions ont une très forte influence sur la façon dont nous réagissons en fonction des circonstances. » — `LDB 21 l.5`

- Lieu, lecture recommandée, révisable (#3045) : une scène porte des Groupes (`Scene.groups`) et en est la source, en vue partout dans la scène, en combat comme hors combat (`etiquetteDeScene`) ; elle n'a ni Taille, ni Indice de statbloc, ni hostilité, ni menace, et ni un Groupe joker ni un Groupe relatif ne la visent. Lecture contraire : seuls les personnes et les créatures sont des sources.
- Emprises plus fines, lectures révisables sans porteur (#3045) : la magie d'une zone de sort (Q1), le feu des zones de sort (Q3), l'eau d'un terrain (Q8) et l'élément qui a presque tué le porteur d'une Animosité acquise (Q16, `ADE II 09 l.15`) n'ont aucun porteur ; le lieu porte l'étiquette par `Scene.groups`.
- Cibles de conduite, lecture révisable sans porteur de catalogue (#3629) : les Groupes qu'un statbloc définit par la conduite ou le jugement de son porteur, comme les maigrichons (`LDB 77 l.66`), les nains lâches (`MCLB 02 l.2014`), les Ulricains pas assez zélés (`MCLB 03 l.108`), les créanciers, les réactionnaires et les utilisateurs de mystracine (`MCLB 07 l.299`), n'ont aucun porteur de catalogue : l'auteur les pose sur le statbloc (`CustomStatblock.groups`), et la lumière (`ZI 05 l.298`) ou le sel (`MSRC 15 l.40`) sur le lieu (`Scene.groups`). Lecture contraire : un porteur se déduit de sa carrière ou de ses possessions.
- Porteurs de catalogue, lecture recommandée, révisable (#3045) : les carrières de guerre, d'autorité et religieuses portent les Figures/Symboles du même nom (Q14 A) ; les carrières religieuses, chaque culte qui accorde des Bénédictions (par le Talent Béni), le Trait Béni et Traudl Bauer portent `religion` ; Sorcier dissident, Sorcier de village et Johen portent `sorcieres` (`LDB 08 l.1865`) ; les Humains de Middenheim et du Middenland portent `teutogen` ; les Traits Dressé, les animaux de `LDB 70 l.13-26` (chevaux, chiens, mule, poney, poulet, singe, pigeon) et le mouton et le cochon du coût de l'animal (`EDOC 07 l.100-101`) portent `animaux-domestiques` (Q7 A) ; une liste fermée de bêtes (loup, ours, araignée géante, serpent, griffon, demigriffon, vouivre, manticore, hydre, chimère, chat sauvage, lion de guerre de Chrace), avec les créatures de leur genre, porte `predateur` (`LDB 79 l.160`). La prose `maison` de chaque entrée de `groups.json` nomme ses porteurs. Lecture contraire : seule une donnée d'auteur (statbloc de scène) range un combattant dans ces Groupes.
- Porteurs du bestiaire, lecture recommandée, révisable (#3045) : chaque créature porte le Groupe de nature que son livre lui donne, sur son entrée ou par son `genre` ; hors des bêtes monstrueuses de `LDB 79`, `monstres` va à une liste fermée : arachnarok, razorgor, gueule d'effroi, preyton, cockatrice, chimère, grand taurus, léviathan, sirène, wyrm des mers, volée de noctecorbes, expérience unique du clan Moulder, et les créatures fantastiques des Terres du Sud (stégadon, cornu, carnosaure, `ZI 10 l.34`) au Zoo impérial ; baudroye, crabe boxeur, anguille mâcheprise, gargantuan, kharibde, sangsue des abysses, léviathan-phare, léviathan noir (`MDG 16 l.5`) et l'hydre d'os, bête elle aussi (`MDG 16 l.215`), en Mer des Griffes. Hors de cette liste : le stylet, poisson comestible (`MDG 16 l.75`), la syrène bleue, morte-vivante, et le brochet du Stir, le rat-loup et le rat ogre briseur d'os, que leur texte dit monstres en passant (`ZI 04 l.59`, `l.158`, `l.194`). Une nuée porte les Groupes de ses membres ; un PNJ au profil humain sans espèce écrite porte `humain` ; le rat géant porte `rats`, le rhinox `grandes-betes` (`ADE II 02 l.943`). Sans Groupe de nature : l'amibe (`ZI 05 l.11`), le Triton, les esprits de la nature, les élémentaires, ce qui est fabriqué par magie et les familiers, dont l'auteur pose le Groupe de leur forme sur le statbloc (`CustomStatblock.groups`). Lecture contraire : `monstres` réservé aux bêtes monstrueuses de `LDB 79`.
- Porteurs de fiche, lecture recommandée, révisable (#3045) : qui lance des sorts porte `magie` (Talents Magie des Arcanes, Magie mineure, Sorcier !, Magie du Chaos, Bénédiction de Tzeentch (`EDOC 13 l.85`), Trait Lanceur de Sorts, et Triton (`MDG 16 l.309`) ; Q1 A) ; la Magie du Chaos porte aussi le Groupe des suivants de son Dieu (Khorne, Nurgle, Slaanesh, Tzeentch) ; le porteur d'une maladie déclarée porte `maladie`, symptômes suspendus compris (Q2 A) ; un combattant *En flammes* et l'Élémentaire incarné du Feu portent `feu` (Q3 A) ; qui pratique la Démonologie, Magie des Arcanes ou Lanceur de Sorts qui nomme ce Domaine (`EDOC 13 l.198`, `LDB 79 l.67`, `LDB 50 l.9`), porte `demonologue` (`EDOC 13 l.606`) ; le Trait Béni porte les Groupes de son culte, comme le Talent. Un État ou une maladie porte son Groupe tant qu'il dure (`groupesDe`). Coupé : le Démoniste (`LDB 08 l.3341`), qui n'octroie pas le Domaine. Un sorcier qui se cache reste perçu `magie` (`groupesPercus` ne retire que les Groupes des Traits dissimulés). Lecture contraire : seuls les Traits de créature portent ces Groupes.

**Sources RAW** :
- `LDB 21 l.5-11` — introduction générale

**Voir aussi** : État *Brisé* (`etats.md`), Détermination (`destin.md`)
**Implémente :** [État calculé](../implemente.generated.md#4epsychologievue-d-ensemble)

---

## Test de Psychologie — principe général

Lorsqu'un personnage est exposé à un Trait Psychologique, il peut tenter de résister en réussissant un **Test de Calme** au début du Round. La Difficulté est déterminée par le MJ.

> « Sur un succès, les effets sont annulés jusqu'à la fin de la rencontre, même si d'autres Tests peuvent être nécessaires si les circonstances changent. » — `LDB 21 l.9`

La mécanique exacte (Test simple ou étendu, Indice à surmonter) varie selon le Trait (détaillée ci-après pour chacun).

**Sources RAW** :
- `LDB 21 l.7-11` — principe général + exemple Animosité d'un nain face à des elfes

**Implémente :** [État calculé](../implemente.generated.md#4epsychologietest-de-psychologie-principe-general)

---

## Traits Psychologiques courants

### Animosité (Cible)

**Déclencheur** : rencontrer un membre du groupe-Cible (« nordlanders », « hommes-bêtes »…).

**Test de Psychologie** : Test de **Calme** (Difficulté MJ) au début du Round.

**Sur un succès** : marmonnements possibles, mais seulement **-20** aux Tests de Sociabilité envers ce groupe.

**Sur un échec** : *Animosité* (l'État actif).

**Effets de l'*Animosité* active** :
- Doit immédiatement s'en prendre au groupe (verbalement ou physiquement selon les circonstances).
- **+1 DR** à tous les Tests impliquant ce groupe (social ou physique).
- *Animosité* est annulé par *Peur* et *Terreur*.

**Fin de l'*Animosité*** : à la fin de chaque Round suivant, *peut* tenter un nouveau Test de Psychologie. Sans nouveau test, les effets cessent naturellement lorsque :
- tous les membres du groupe en Ligne de Vue se sont calmés ou ont disparu, OU
- le personnage gagne l'État *Sonné* ou *Inconscient*, OU
- il tombe sous le coup d'un autre effet psychologique.

- Calmé, lecture recommandée, révisable (#3045) : un membre hors d'action ou Brisé s'est calmé ; un membre en action reste hostile s'il est agressif envers le porteur (`agressifEnvers` : adversaire déclaré, Engagé avec lui, ou l'ayant attaqué ce Round ; Q11 A), sinon il s'est calmé (`cibleEnVue` à `hostiles`). Lecture contraire : seules la fuite et la reddition calment.
- Fin naturelle, lecture recommandée, révisable (#3045) : l'affliction se désactive et garde son marqueur de rencontre (`LDB 21 l.9`), si bien que le Groupe ne redéclenche aucun Test dans la même rencontre. Lecture contraire : un membre du Groupe qui entre ensuite en vue redéclenche un Test.
- Moment, lecture recommandée, révisable (#3045) : la Ligne de Vue se juge à la fin de chaque Round, au moment du nouveau Test (`trigger: onRoundEnd`, Condition `cibleEnVue`) ; un État gagné en combat finit l'affliction sur-le-champ (`trigger: onGainCondition`, qui ne joue qu'en combat). Lecture contraire : la Ligne de Vue se juge à tout instant.

> « Vous gagnez également +1 DR dès que vous vous en prenez au groupe, que cela soit socialement ou physiquement. *Animosité* est annulé par *Peur* et *Terreur*. » — `LDB 21 l.21`

**Acquise sur un Destin dépensé** (ADE II, règle optionnelle `psycho-acquisition-optionnelle`) :

> « Si la cible est un membre de la propre Race du Personnage, il obtient une *Animosité* envers les Reiklanders, les miliciens, les nains impériaux, etc., plutôt que juste les humains ou les nains. Si la cible est un membre d'une autre Race, le Personnage est plus susceptible de développer une *Animosité* pour la Race entière, par exemple les nains, les humains, les orcs ou les elfes. » — `ADE II 09 l.15`

- Les Races sont les Groupes à marqueur `race` (`racesDe`) : celles du porteur se lisent sur son appartenance, celles du tueur sur sa vue perçue (`groupesPercus`) ; ses sous-groupes sont ses Groupes perçus hors Race (`ciblesDAnimositeAcquise`) ; les candidats suivent l'ordre de `groups.json`.
- Animosité déjà possédée envers la Cible retenue, sur la fiche ou suspendue par un effet : la *Haine* remplace toutes ses instances (`traitAcquis`, « celle-ci devient de la *Haine* », `ADE II 09 l.15`) ; l'étape `cibleAcquise` dit, à chaque Cible, le Trait qu'elle donnera.
- *Haine* déjà possédée envers la Cible retenue, lecture recommandée, révisable (#3045) : l'Animosité s'acquiert à côté de la *Haine*. Lecture contraire : la *Haine* l'absorbe et rien ne s'acquiert.
- *Haine* qui remplace une Animosité suspendue par un effet ou accordée pour une durée, lecture recommandée, révisable (#3045) : elle se pose sur la fiche, permanente et non suspendue, et l'affliction active de l'Animosité remplacée se désactive (`desactiverLAfflictionSansTrait`). Lecture contraire : la *Haine* hérite de la suspension ou de la durée de l'Animosité.
- Tueur de la Race du Personnage : le joueur choisit parmi ses sous-groupes, à l'étape `cibleAcquise` ; un porteur non surfacé prend le premier dans l'ordre de `groups.json`.
- Tueur d'une autre Race, lecture recommandée, révisable (#3045) : le joueur choisit entre sa Race et ses sous-groupes ; un porteur non surfacé prend la Race. Lecture contraire : la Race seule.
- Tueur sans sous-groupe, lecture révisable (#3045) : de même Race, l'individu (« en prenant pour cible l'individu ou l'élément qui l'a presque tué », `ADE II 09 l.15`) ; d'une autre Race, la Race. Lecture contraire : de même Race, la Race.
- Tueur sans Race, lecture révisable (#3045) : ses Groupes perçus au choix, sinon l'individu. Lecture contraire : toujours l'individu.

**Sources RAW** :
- `LDB 21 l.17-21` — définition complète d'Animosité, effets actifs, conditions de fin
- `ADE II 09 l.15` — Animosité acquise sur un Destin dépensé, Haine sur une Animosité déjà possédée

**Voir aussi** : Haine (Cible), Préjugé (Cible)
**Implémente :** [État calculé](../implemente.generated.md#4epsychologieanimosite-cible)

---

### Peur (Indice)

**Déclencheur** : présence d'une créature ou situation possédant un *Indice* de Peur.

**Test** : Test **étendu** de **Calme** (Intermédiaire +0 par défaut), une fois par Round.

**Mécanique** : le DR cumulé (de Round en Round) doit atteindre ou dépasser l'*Indice* de Peur pour vaincre la Peur.

> « La *Peur* représente une aversion extrême pour quelque chose. Les créatures qui causent la *Peur* possèdent un *Indice* de *Peur* ; cette valeur représente le DR que vous devez atteindre lorsque vous effectuez votre Test étendu de Calme pour vaincre cette *Peur*. » — `LDB 21 l.25`

- Moment, lecture recommandée, révisable (#3045) : la Peur pèse dès la rencontre (« Tant que ce n'est pas le cas, vous êtes sujet à la *Peur* », `LDB 21 l.25`), posée sans Test au début du Round ; son Test étendu, premier compris, se joue à la fin de chaque Round, de même pour la Peur héritée d'une Terreur (`LDB 21 l.56`). Une source apparue en cours de Round se pose et se teste à la fin de ce Round. Lecture contraire : le premier Test se joue à la rencontre, au début du Round.

**Effets tant que sous Peur** :
- **-1 DR** à tous les Tests en rapport avec la source de la Peur.
- Impossible de se rapprocher de la source sans réussir un **Test de Calme Intermédiaire (+0)**.
- Si la source s'approche : Test de **Calme Intermédiaire (+0)** ou gain d'un **État Brisé**.

> « Lorsque vous êtes sous le coup de la *Peur*, vous subissez -1 DR à tous les Tests en rapport avec la source de votre peur. Vous êtes incapable de vous rapprocher de ce qui provoque cette *Peur* à moins de réussir un Test de **Calme Intermédiaire (+0)**. Si la source de votre *Peur* se rapproche de vous, vous devez réussir un Test de **Calme Intermédiaire (+0)** ou gagner un État *Brisé*. » — `LDB 21 l.27`

- Fin à la chute de la source, lecture existante, révisable (#3045) : le texte ne nomme aucune fin hors du Test étendu ; une Peur (une Terreur devenue Peur comprise) causée par une créature finit dès que celle-ci est hors d'action, Inconscient compris (`clearPsychOf`). Lecture contraire : seul le Test étendu réussi la finit (`LDB 21 l.25`), une source hors d'action restant source de Peur.

**Sources RAW** :
- `LDB 21 l.23-27` — définition, Test étendu, effets sous Peur, approche de la source

**Voir aussi** : Terreur (Indice), État Brisé (`etats.md`)
**Implémente :** [État calculé](../implemente.generated.md#4epsychologiepeur-indice)

---

### Terreur (Indice)

**Déclencheur** : première rencontre avec une créature qui inspire la Terreur.

**Test** : Test de **Calme** (Intermédiaire +0) — **une seule fois** à la première rencontre.

**Sur un succès** : aucun effet supplémentaire dû à la Terreur. La créature cause ensuite la *Peur* d'Indice équivalent.

**Sur un échec** : gain d'un nombre d'États **Brisé** égal à l'*Indice* de Terreur **+ les DR négatifs** (DR < 0).

> « Sur un succès, vous ne subissez aucun effet supplémentaire à cause de la *Terreur*. Sur un échec, vous gagnez autant d'États *Brisé* que l'*Indice* de *Terreur* de la créature, auquel vous rajoutez les DR inférieurs à 0. » — `LDB 21 l.54`

**Après le test** (succès ou échec) : la créature cause la *Peur* avec un *Indice* de Peur équivalent à son *Indice* de Terreur.

> « Une fois ce Test de Psychologie effectué, la créature cause la *Peur*, avec un *Indice* de *Peur* équivalent à son *Indice* de *Terreur*. » — `LDB 21 l.56`

**Sources RAW** :
- `LDB 21 l.54-56` — déclencheur, test unique, calcul des États Brisé, transition vers Peur

**Voir aussi** : Peur (Indice), État Brisé (`etats.md`)
**Implémente :** [État calculé](../implemente.generated.md#4epsychologieterreur-indice)

---

### Frénésie

**Déclencheur** : le personnage choisit d'entrer en Frénésie ; un **Test de Force Mentale** (non précisé comme Intermédiaire dans le texte, mais implémenté comme tel — cf. ci-dessous) est requis.

> « Vous pouvez, par le biais d'un Test de Force Mentale, vous mettre dans un état psychologique dans lequel vous allez vous surmotiver, mordre votre bouclier, etc. Sur un succès, vous entrez en *Frénésie*. » — `LDB 21 l.31`

**Effets en Frénésie** :
- Immunité à **tous les autres Traits Psychologiques**.
- Impossible de fuir ou de battre en retraite.
- Obligation de se déplacer au maximum vers l'ennemi le plus proche en Ligne de Vue pour l'attaquer.
- La seule Action possible est un Test de **Capacité de Combat** ou un Test d'**Athlétisme** (pour atteindre l'ennemi).
- **Attaque gratuite de Corps à corps** supplémentaire par Round.
- **+1 Bonus de Force** (grâce à la férocité).

> « Tant que vous êtes en *Frénésie*, vous êtes immunisé à tous les autres Traits Psychologiques, et sous aucun prétexte vous ne fuirez, ni ne battrez en retraite. À l'inverse, vous devez vous déplacer à votre maximum en direction de l'ennemi le plus proche dans votre Ligne de Vue pour l'attaquer. La seule Action possible est un Test de **Capacité de Combat** ou un Test d'**Athlétisme** pour atteindre votre ennemi le plus rapidement possible. De plus, vous pouvez effectuer un Test de **Capacité de Combat** gratuit chaque Round car vous vous lancez à corps perdu dans votre attaque. Enfin, vous gagnez un Bonus de Force de +1 grâce à votre férocité. » — `LDB 21 l.33`

**Fin de la Frénésie** : quand tous les ennemis en Ligne de Vue sont neutralisés, OU gain d'un État *Sonné* ou *Inconscient*.

**Conséquence** : à la fin de la Frénésie, gain immédiat de l'État **Exténué**.

> « Vous restez en *Frénésie* jusqu'à ce que tous les ennemis dans votre Ligne de Vue soient neutralisés ou que vous gagniez l'État *Sonné* ou *Inconscient*. Dès que votre *Frénésie* s'achève, vous gagnez l'État *Exténué*. » — `LDB 21 l.35`

**Sources RAW** :
- `LDB 21 l.29-33` — déclencheur, Test de FM, effets complets, conditions de fin, gain Exténué

**Voir aussi** : Talent Frénésie, Talent Contrôle de la Frénésie, État Exténué (`etats.md`)
**Implémente :** [État calculé](../implemente.generated.md#4epsychologiefrenesie)

---

### Haine (Cible)

**Déclencheur** : rencontrer un membre du groupe haï.

**Test** : Test de **Calme** (Difficulté MJ). Sur un succès, le personnage peut interagir normalement malgré ses sentiments (il n'interagira « jamais » volontiers, mais le Test le retient).

**Sur un échec** : *Haine* active.

**Effets de la *Haine* active** :
- Doit faire tout son possible pour **détruire le groupe haï**, le plus rapidement et violemment possible.
- **+1 DR** à tous les Tests de Combat contre ce groupe.
- **Immunité à *Peur* et *Intimidation*** causées par ce groupe (mais **pas** à *Terreur*).

**Fin de la Haine** : à la fin de chaque Round suivant, *peut* tenter un autre Test de Psychologie. Sans test, les effets cessent lorsque tous les membres en Ligne de Vue sont morts ou ont disparu, ou que le personnage gagne l'État *Inconscient*.

- Disparu, lecture recommandée, révisable (#3045) : seuls comptent les membres dans la Ligne de Vue du porteur au moment où elle se juge, si bien qu'un membre qui en sort ne la retient plus ; un membre Inconscient n'est ni mort ni disparu, il reste en vue ; un membre mort, rendu ou sorti de la rencontre a disparu (`cibleEnVue`). Lecture contraire : tout membre hors d'action a disparu.
- Fin naturelle, lecture recommandée, révisable (#3045) : l'affliction se désactive et garde son marqueur de rencontre (`LDB 21 l.9`), si bien que le Groupe ne redéclenche aucun Test dans la même rencontre. Lecture contraire : un membre du Groupe qui entre ensuite en vue redéclenche un Test.
- Moment, lecture recommandée, révisable (#3045) : la Ligne de Vue se juge à la fin de chaque Round, au moment du nouveau Test (`trigger: onRoundEnd`, Condition `cibleEnVue`) ; un État gagné en combat finit l'affliction sur-le-champ (`trigger: onGainCondition`, qui ne joue qu'en combat). Lecture contraire : la Ligne de Vue se juge à tout instant.

> « Tant que vous ressentez de la *Haine*, vous devez faire tout ce qui est en votre pouvoir pour détruire le groupe haï, et ce, le plus rapidement et de manière la plus violente possible. Vous gagnez +1 DR à tous vos Tests de Combat effectués contre le groupe en question, et êtes immunisé à *Peur* et *Intimidation* (mais pas *Terreur*) causés par ceux de ce groupe. » — `LDB 21 l.41`

**Sources RAW** :
- `LDB 21 l.37-39` — définition, déclencheur, Test, effets, immunités partielles, conditions de fin

**Voir aussi** : Talent Haine (Groupe)
**Implémente :** [État calculé](../implemente.generated.md#4epsychologiehaine-cible)

---

### Préjugé (Cible)

**Déclencheur** : rencontrer un membre du groupe ciblé.

**Test** : Test de **Calme** (Difficulté MJ).

**Sur un succès** : froncements de sourcils possibles, mais comportement normal ; seulement **-10** aux Tests de Sociabilité envers ce groupe.

**Sur un échec** : *Préjugés* actifs → doit copieusement insulter la Cible à haute et intelligible voix.

**Fin des Préjugés** : à partir du Round suivant, peut tenter un nouveau Test. Sinon, cessent d'eux-mêmes lorsque tous les membres du groupe en Ligne de Vue ont disparu, que le personnage gagne l'État *Sonné* ou *Inconscient*, ou tombe sous un autre Trait Psychologique.

- Nouveau Test, lecture recommandée, révisable (#3045) : au début de chaque Round qui suit le déclenchement (« À partir du Round qui suivra », `LDB 21 l.48` ; `retestAt` absent), là où l'Animosité et la Haine se re-testent à la fin (`retestAt: roundEnd`, `LDB 21 l.19`, `l.39`). Lecture contraire : à la fin de chaque Round suivant, comme elles.

- Disparu, lecture recommandée, révisable (#3045) : seuls comptent les membres dans la Ligne de Vue du porteur au moment où elle se juge, si bien qu'un membre qui en sort ne la retient plus ; un membre Inconscient n'est ni mort ni disparu, il reste en vue ; un membre mort, rendu ou sorti de la rencontre a disparu (`cibleEnVue`). Lecture contraire : tout membre hors d'action a disparu.
- « Qui étaient dans votre Ligne de Vue » (`LDB 21 l.48`), lecture recommandée, révisable (#3045) : les membres dans la Ligne de Vue ACTUELLE du porteur, comme pour l'Animosité et la Haine. Lecture contraire : les membres vus au déclenchement, qui retiennent le Préjugé où qu'ils soient tant qu'ils n'ont pas disparu.
- Fin naturelle, lecture recommandée, révisable (#3045) : l'affliction se désactive et garde son marqueur de rencontre (`LDB 21 l.9`), si bien que le Groupe ne redéclenche aucun Test dans la même rencontre. Lecture contraire : un membre du Groupe qui entre ensuite en vue redéclenche un Test.
- Moment, lecture recommandée, révisable (#3045) : la Ligne de Vue se juge à la fin de chaque Round, au moment du nouveau Test (`trigger: onRoundEnd`, Condition `cibleEnVue`) ; un État gagné en combat finit l'affliction sur-le-champ (`trigger: onGainCondition`, qui ne joue qu'en combat). Lecture contraire : la Ligne de Vue se juge à tout instant.

**Sources RAW** :
- `LDB 21 l.43-50` — définition, succès/échec, comportement obligatoire, conditions de fin

**Préjugé (Étrangers)**, lecture recommandée, révisable (#3045) : le Groupe relatif `etranger` (`VDM 05 l.142` ; `relatif: etrangersAuPorteur`) vise tout combattant hors du camp du porteur et que ne vise pas un de ses liens (Amour, Camaraderie : `triggerOn: threatened`, `LDB 21 l.75`, `l.81`) ; le « groupe » d'un PNJ est son camp. Un interlocuteur de Test social est étranger, sauf si ses Groupes sont visés par un de ces liens (Q15 A). Lecture contraire : les non-natifs de la région de la scène.

**Implémente :** [État calculé](../implemente.generated.md#4epsychologieprejuge-cible)

---

## Traits Psychologiques personnalisés

Le LDB propose des exemples de Traits personnalisés que le MJ peut créer pour ses scénarios. Les Traits ci-dessous en font partie.

### Amour

Reflète une très forte relation émotionnelle (romantique, familiale, amitié profonde).

**Obligation** : venir en aide à la personne aimée si elle est menacée physiquement ou verbalement.

**Bénéfices** :
- Immunité à *Peur* et *Intimidation* tant que le personnage défend les êtres aimés.
- **+1 DR** à tous les Tests en rapport avec cette défense.

**Sources RAW** :
- `LDB 21 l.73-77` — définition et effets

**Implémente :** [État calculé](../implemente.generated.md#4epsychologieamour)

---

### Camaraderie

Sentiments positifs envers un groupe d'individus.

**Obligation** : leur venir en aide si le groupe est menacé.

**Bénéfice** : **+1 DR** lors des Tests effectués pour défendre ce groupe.

**Sources RAW** :
- `LDB 21 l.79-83` — définition et effets

**Implémente :** [État calculé](../implemente.generated.md#4epsychologiecamaraderie)

---

### Phobie

Peur spécifique envers un Type de créature, un objet ou une situation.

**Règle** : traiter l'objet de la Phobie comme causant **Peur 1** (Indice augmentable si la Phobie est particulièrement forte).

**Phobie du noir** (ADE II, règle optionnelle `psycho-acquisition-optionnelle`) :

> « Cette *Phobie* est liée à la cause de la *Terreur* qu'il a subi le plus récemment ou le plus souvent. Elle doit avoir un rapport avec une créature ou une situation que le Personnage peut rencontrer fréquemment. » — `ADE II 09 l.9`

- Seul un combattant qui suit les règles de Personnage mémorise (`followsCharacterRules` : un héros, sous contrôle de l'IA compris, ou un PNJ modélisé qui les déclare ; « Personnages », `ADE II 09 l.5`, l.9) ; un autre PNJ ne mémorise aucune Terreur.
- Chaque Terreur subie se mémorise avec ses États *Brisé* et les Groupes perçus de sa cause (`Combatant.terreursSubies`), par un seul point d'écriture (`subirLaTerreur`) qu'empruntent la passe de Round d'un combattant en combat (rangée surfacée ou jet sans pilote) et la rencontre hors combat, où la cause est le PNJ de la scène qui la porte ; la Phobie vient quand leur cumul atteint le Bonus de Force Mentale, et la mémoire se vide dès la Phobie acquise, avant même le choix de sa Cible (`ADE II 09 l.11`).
- Lecture recommandée, révisable (#3045) : le joueur choisit, à l'étape `cibleAcquise`, entre les Groupes de la cause la plus récente et les Groupes les plus fréquents des causes, tous les ex æquo compris (`ciblesDePhobieDuNoir`), dans l'ordre de `groups.json` ; un porteur non surfacé prend le premier Groupe de la plus récente, ou, si elle n'en offre aucun, le premier des plus fréquents. Lecture contraire : toujours la cause la plus récente ; ou, à fréquence égale, aucun Groupe n'est « le plus souvent » subi et seule la plus récente s'offre.
- Terreur sans créature pour cause (Terreur d'auteur, `inflictPsychology`), lecture recommandée, révisable (#3045) : ses États *Brisé* comptent au seuil, sa cause n'offre aucun Groupe ; tant qu'aucune cause mémorisée n'offre de Groupe, aucune Phobie ne vient et le compteur reste. Lecture contraire : une Phobie de la situation elle-même.
- Un Groupe mémorisé puis retiré de `groups.json` ne compte ni comme cause la plus récente ni comme la plus fréquente.
- Terreur résistée (Calme réussi, aucun État *Brisé*), lecture recommandée, révisable (#3045) : elle ne se mémorise pas, « souffre de *Terreur* » se lisant comme les États *Brisé* subis (`ADE II 09 l.9`). Lecture contraire : toute Terreur affrontée compte comme cause pour « le plus souvent », avec zéro État *Brisé*.
- Phobie déjà possédée envers la Cible retenue, lecture recommandée, révisable (#3045) : une seconde Phobie s'acquiert. Lecture contraire : la Phobie possédée suffit et rien ne s'acquiert, ou son Indice augmente (« Vous pouvez vouloir augmenter l'*Indice* de *Peur* si la *Phobie* est particulièrement forte. » — `LDB 21 l.87`).

**Sources RAW** :
- `LDB 21 l.85-89` — définition ; traitement comme Peur 1
- `ADE II 09 l.9-11` — Phobie du noir : seuil, cause, remise à zéro

**Implémente :** [État calculé](../implemente.generated.md#4epsychologiephobie)

---

### Trauma

Conséquence d'une expérience traumatisante. Peut se manifester de diverses façons (cauchemars, Haine, Phobie, flash-backs, Hostilité).

**Exemple RAW** :
- Un personnage traumatisé par un incendie doit réussir un **Test de Calme Intermédiaire (+0)** à la vue d'un personnage *En flammes* ; sur un échec, gagne un État *Sonné* + un État *Sonné* par DR négatif.
- Chaque nuit : Test de **Calme Facile (+40)** ; sur un échec, gain de l'État *Exténué* (cauchemars).

**Sources RAW** :
- `LDB 21 l.91-95` — description + exemple de Trauma (incendie, cauchemars)

**Voir aussi** : `src/data/traumatisme.md` (`traumatisme.md` pour les Blessures Critiques)
**Implémente :** [État calculé](../implemente.generated.md#4epsychologietrauma)

---

## Traits de créature psychologiques

### Animosité (Cible) — créature

> « La créature n'aime pas la *Cible*. Voir page 190 pour les règles concernant l'*Animosité*. » — `LDB 85`

Applique les mêmes règles que le Trait Psychologique Animosité (section ci-dessus).

**Sources RAW** : `LDB 85 l.23` — renvoi LDB 21

---

### Belliqueux

> « La créature adore combattre. Tant qu'elle a plus d'Avantages que son adversaire, elle gagne Immunité Psychologique. » — `LDB 85 l.51`

L'immunité est conditionnelle : elle ne s'applique que si la créature a **plus d'Avantages** que l'adversaire ciblé.

**Sources RAW** : `LDB 85 l.51` — condition d'immunité

**Implémente :** [État calculé](../implemente.generated.md#4epsychologiebelliqueux)

---

### Effrayé (Cible)

> « La créature a *Peur* 0 de la *Cible*. Voir **Psychologie** dans le **Chapitre 5 : Règles** à la page 190 pour les règles concernant la *Peur*. » — `LDB 85 l.122`

La créature est sujette à la Peur envers la Cible désignée, avec un Indice de 0 (seuil minimal).

**Sources RAW** : `LDB 85 l.122` — Peur 0 de la Cible

---

### Frénésie — créature

> « La créature peut entrer en *Frénésie*. Voir page 190. » — `LDB 85 l.150`

Applique exactement les mêmes règles que la Frénésie des personnages (section ci-dessus).

**Sources RAW** : `LDB 85 l.150` — renvoi LDB 21

**Implémente :** [État calculé](../implemente.generated.md#4epsychologiefrenesie-creature)

---

### Haine (Cible) — créature

> « La créature hait profondément la *Cible*. Voir *Haine* à la page 190. » — `LDB 85 l.166`

Applique les mêmes règles que la Haine des personnages (section ci-dessus).

**Sources RAW** : `LDB 85 l.166` — renvoi LDB 21

---

### Immunité Psychologique

> « Peu importe que la créature soit téméraire, extrêmement stupide ou juste dans le feu de l'action, elle n'a peur de rien. Elle ignore les règles de la Psychologie. Voir page 190. » — `LDB 85 l.179-180`

La créature ignore **toutes** les règles de Psychologie sans Test.

**Sources RAW** :
- `LDB 85 l.178-179` — définition

**Implémente :** [État calculé](../implemente.generated.md#4epsychologieimmunite-psychologique)

---

### Nuée — immunité psy

> « Elles ignorent les règles de Psychologie (voir page 190)… » — `LDB 85 l.253`

Les nuées ignorent automatiquement la Psychologie, au même titre que les créatures avec Immunité Psychologique.

**Sources RAW** : `LDB 85 l.253`

---

### Peur (Indice) — créature

> « La nature de la créature engendre de la *Peur* surnaturelle chez les autres créatures, égale à *Indice*. Voir page 190. » — `LDB 85 l.266`

La créature cause la Peur (Indice) aux adversaires. Applique les règles de Peur (Indice) décrites ci-dessus.

**Sources RAW** : `LDB 85 l.266` — renvoi LDB 21 + Indice défini dans le statbloc

**Implémente :** [État calculé](../implemente.generated.md#4epsychologiepeur-indice-creature)

---

### Préjugé (Cible) — créature

> « La créature n'apprécie pas la *Cible*. Voir page 190 pour les règles concernant les *Préjugés*. » — `LDB 85 l.274`

Applique les mêmes règles que le Préjugé des personnages.

La *Cible* peut être un groupe de COMPORTEMENT, que ni l'espèce ni la carrière ne confèrent (`groups.json`) :

> « **Traits :** À distance (Arbalète) +9 (60), Arme (Épées) +7, Armure (Veste de cuir) 1, Préjugé (Criminels, Personnes qui ne leur offrent rien) » — `EDO 02 l.301`

> « **Traits :** Arme (Poings) +3, Préjugé (Rustres et Idiots) » — `EDO 02 l.327`

**Sources RAW** : `LDB 85 l.274` — renvoi LDB 21 ; cibles de comportement `EDO 02 l.301`, `EDO 02 l.327`

---

### Rage

> « La créature peut entrer dans une rage dévorante. Elle peut dépenser tous ses Avantages (minimum 1) pour que celui devienne *Haine* envers ses adversaires en combat rapproché. Elle peut aussi dépenser tous ses Avantages (minimum 3) pour entrer en *Frénésie*. Voir page 190. » — `LDB 85 l.282`

Deux options de dépense d'Avantages :
- **Minimum 1 Avantage** : Avantages remplacés par *Haine* vs adversaires en mêlée.
- **Minimum 3 Avantages** : entrée directe en *Frénésie*.

**Cible de la Haine**, lecture recommandée, révisable (#3045) : une seule *Haine*, envers le Groupe relatif `adversaires-engages` (`groups.json`, `relatif: engagesAvecPorteur`) : tout combattant Engagé avec la créature tant que dure la *Haine*, sans filtre de camp (Q12 B). Pas de nouvelle dépense tant que cette *Haine* est active, ni sans adversaire Engagé. Lecture contraire, citable : les seuls individus Engagés au moment de la dépense.

**Sources RAW** : `LDB 85 l.282`

---

### Terreur par Taille

Les créatures agressives de grande Taille inspirent automatiquement Peur ou Terreur aux créatures plus petites, **même sans trait Peur/Terreur explicite** dans leur statbloc.

> « Si la créature est considérée comme agressive, elle provoquera la *Peur* chez toute créature plus petite qu'elle, et de la *Terreur* à toute créature plus petite qu'elle d'au moins deux catégories. Le niveau de *Peur* ou de *Terreur* égale la différence de catégories de Taille. Ainsi, si elle est de catégorie Grande et son adversaire de catégorie Petite, elle lui cause *Terreur* 2. » — `LDB 85 l.383-384`

**Table des catégories de Taille** (pour référence) :

| Catégorie | Exemples |
|-----------|----------|
| Minuscule | Papillon, souris, pigeon |
| Très petite | Chat, faucon, bébé humain |
| Petite | Rat géant, halfling, enfant humain |
| Moyenne | Nain, elfe, humain |
| Grande | Cheval, ogre, troll |
| Énorme | Griffon, vouivre, manticore |
| Monstrueuse | Dragon, géant, Prince démon |

**Règle d'effet** :
- Écart ≥ 1 catégorie → **Peur** (Indice = écart de catégories)
- Écart ≥ 2 catégories → **Terreur** (Indice = écart de catégories)

**Sources RAW** :
- `LDB 85 l.382-383` — règle Peur/Terreur par Taille

**Implémente :** [État calculé](../implemente.generated.md#4epsychologieterreur-par-taille)

---

### À Sang-Froid

> « La créature est à sang-froid et lente à réagir. Elle peut inverser tous ses Tests de **Force Mentale** échoués. » — `LDB 85 l.13`

Un Test de FM raté est relu avec ses chiffres inversés (ex. 91 → 19) ; si le résultat inversé est un succès, le Test est considéré réussi.

**Sources RAW** : `LDB 85 l.13`

**Implémente :** [État calculé](../implemente.generated.md#4epsychologiea-sang-froid)

---

## Talents liés à la Psychologie

### Contrôle de la Frénésie

**Maxi** : Bonus de Force Mentale

**Tests** : Corps à corps quand en Frénésie

> « Vous êtes davantage en mesure de contrôler votre *Frénésie* en combat. Vous pouvez y mettre fin avec un Test de Calme réussi à la fin du Round. » — `LDB 10 l.255`

Par défaut (sans ce Talent), la Frénésie ne peut pas être terminée volontairement.

**Sources RAW** : `LDB 10 l.255`

---

### Effrayant

**Maxi** : Bonus de Force

> « Toute personne saine d'esprit réfléchit à deux fois avant de vous approcher. Si vous le souhaitez, vous avez un *Indice* de Peur de 1 (voir page 190). Ajoutez +1 à cet *Indice* par nombre de fois supplémentaires que vous avez pris ce Talent. » — `LDB 10 l.398`

Un personnage avec ce Talent peut activer un Indice de Peur de 1+ (selon les niveaux du Talent).

**Sources RAW** : `LDB 10 l.398`

---

### Frénésie (talent)

**Maxi** : 1

> « Vous pouvez entrer en *Frénésie* comme décrit à la page 190. » — `LDB 10 l.506`

Confère le Trait de créature *Frénésie* (`confereTrait`, `talents.json`), lu par le même chemin que le Trait posé (`traitsConferes`, `isFrenzyCapable`).

**Sources RAW** : `LDB 10 l.506`

**Implémente :** [État calculé](../implemente.generated.md#4epsychologiefrenesie-talent)

---

### Haine (Groupe) (talent)

**Maxi** : Bonus de Force Mentale

**Tests** : Force Mentale (Groupe à combattre)

> « Vous êtes consumé par la haine pour quelque chose dans le Vieux Monde, comme décrit à la page 190. Chaque fois que vous prenez ce Talent, vous développez une certaine haine envers un nouveau groupe. » — `LDB 10 l.548`

Exemples de groupes : hommes-bêtes, peaux-vertes, monstres, hors-la-loi, sigmarites, morts-vivants, Sorciers dissidents.

Confère le Trait *Haine* (`confereTrait`, `talents.json`), sa spécialisation pour Cible : un Groupe de `groups.json` (`specsSource: ciblesPsy`), dérivé à la lecture par le même chemin que le Trait posé (`traitsConferes`, `parsePsychTraits`), pour un héros comme pour un PNJ. Sous un effet de suppression des Traits psy (Baume pour un esprit blessé, `LDB 43 l.70`), un Trait conféré n'est plus effectif.

- Pluriel ramené au Groupe : Morts-vivants → `mort-vivant` (`MDG 16 l.360`), Cultistes → `cultiste` (`EDOC 10 l.130`), Suivants du Chaos → `chaos` (`MDG 11 l.127`).
- Groupes de culte, portés par le culte (`gods.json`, `grantGroups`) : Manannites → `manannite` (`MDG 11 l.127`), Suivants de Stromfels → `stromfelsien` (`MDG 09 l.700`).
- Hérétiques (`LDB 08 l.1718`), lecture recommandée, révisable (#3045) : le Groupe `heretiques` inclut les cultistes, adorateurs des Puissances de la Ruine. Lecture contraire : les seuls porteurs déclarés du Groupe.

**Sources RAW** : `LDB 10 l.548` ; effets à la page 190 = `LDB 21 l.37-39`

**Implémente :** [État calculé](../implemente.generated.md#4epsychologiehaine-groupe-talent)

---

### Vice (Cible) (talent et trait)

Talent qui confère le Trait psychologique *Vice* ; sa Cible est un vice (alcool, nourriture, stupéfiants, plaisir), pas un Groupe : Test de Psychologie à la confrontation, abandon au Vice jusqu'à la perte de connaissance, État *Exténué*.

**Sources RAW** : `ADE II 02 l.258-265` (Talent) ; `ADE II 02 l.267-269` (Trait)

**Implémente :** [État calculé](../implemente.generated.md#4epsychologievice-cible-talent-et-trait)

---

### Sans Peur (Ennemi)

**Maxi** : Bonus de Force Mentale

**Tests** : Calme pour s'opposer à l'Intimidation, la *Peur* et la *Terreur* de l'Ennemi

> « Vous êtes suffisamment courageux ou fou pour que la peur de certains ennemis ne soit qu'un lointain souvenir. Avec un seul Test de **Calme Accessible (+20)**, vous pouvez ignorer les effets d'Intimidation, de *Peur* ou de *Terreur* de l'ennemi spécifié quand vous le rencontrez. » — `LDB 10 l.1051`

**Ennemis courants** : hommes-bêtes, peaux-vertes, hors-la-loi, vampires, gardes, Sorciers dissidents.

**Mécanique** : ce Talent ne confère **pas** l'immunité automatique — il accorde **un seul Test de Calme Accessible (+20)** pour ignorer les effets. En cas d'échec, le personnage est sujet aux règles normales de Peur (avec Tests à Intermédiaire +0 les Rounds suivants).

- Moment, lecture recommandée, révisable (#3045) : le Test allégé se joue au début du Round de la rencontre et tient lieu du Test étendu de la Peur pour ce Round (pas de second Test à sa fin). Lecture contraire : un Test en plus du pas de fin de Round.

**L'Ennemi est un Groupe**, lecture recommandée, révisable (Q13 A, #3045) : la spécialisation de Sans Peur est un id de `groups.json` hors des Groupes relatifs (source `groupesDAppartenance`, la sous-liste `CIBLE_D_APPARTENANCE`), lue par `sansPeurVs` comme une Cible de Groupe.
- Pluriel ramené au Groupe existant : Criminels → `criminel`, Gardes → `garde`, Hommes-bêtes → `homme-bete`, Morts-vivants → `mort-vivant`, Peaux-vertes → `peau-verte`.
- Groupes de spécialisation : Animaux (`LDB 08 l.3514`), Hors-la-loi (`LDB 08 l.1852`, `LDB 10 l.1051`), Hérétiques (`LDB 08 l.1732`), Intrus (`LDB 08 l.1203`), Miliciens (`LDB 08 l.490`), Naufrageurs (`LDB 08 l.2928`), Patrouilleurs fluviaux (`LDB 08 l.2582`), Patrouilleurs routiers (`LDB 08 l.3125`), Primes (`LDB 08 l.1559`), Rats (`LDB 08 l.596`), Sorciers dissidents et Vampires (`LDB 10 l.1051`), Sorcières (`LDB 08 l.1907`), Chaos (`AA 03 l.420`), Cavalerie (`AA 04 l.204`), Grandes bêtes (`ADE II 02 l.927`).
- Composites (`inclut`) : Animaux = bêtes et animaux domestiques ; Animaux sauvages = bêtes, hormis les animaux domestiques et les monstres (`LDB 78 l.5`, `LDB 79 l.5`), donc hormis toute bête Dressée ; Chaos = démons, cultistes et mutants. Tout Groupe-cible, joker ou composite, retranche les porteurs de ses Groupes exclus (`exceptGroups`). Lecture contraire : les hommes-bêtes dans Chaos (« les véritables enfants du Chaos », `LDB 83 l.11`).
- Cavalerie : tout combattant monté (`mountId`), dérivée comme Mutants. Lecture contraire : un Groupe déclaré par les seules troupes montées du bestiaire.
- Choix du joueur, lecture révisable (#3045) : le pool propose toute cette sous-liste, étiquettes du Tableau des Obsessions comprises (feu, eau, pauvreté, bonheur, richesse, objets inanimés, `EDOC 12 l.170`), qui ne sont pas des ennemis au sens de « l'ennemi spécifié quand vous le rencontrez » (`LDB 10 l.1051`). Lecture contraire : un pool restreint aux Groupes de personnes et de créatures.

**Sources RAW** :
- `LDB 10 l.1051` — définition, Test Accessible (+20), liste d'ennemis courants

**Implémente :** [État calculé](../implemente.generated.md#4epsychologiesans-peur-ennemi)

---

## État Brisé — lien avec la Psychologie

L'État *Brisé* est l'état principal produit par les mécanismes de Psychologie :
- Un Test de Peur raté quand la **source s'approche** → 1 État Brisé (`LDB 21 l.27`).
- Un Test de Terreur raté → nombre d'États Brisé = **Indice + |DR négatifs|** (`LDB 21 l.54-56`).

La **récupération** de l'État Brisé se fait par Test de Calme (Difficulté selon les circonstances), ou en se cachant hors de vue un Round entier. Voir description complète dans `etats.md` → section Brisé.

**Sources RAW** :
- `LDB 21 l.27` — Peur (approche source) → Brisé
- `LDB 21 l.54-56` — Terreur → Brisé (formule)
- `LDB 16 l.50-58` — récupération de l'État Brisé (cf. `etats.md`)

**Voir aussi** : `etats.md` → Brisé

---

## Détermination contre la Psychologie

Un Point de **Détermination** permet d'être immunisé à la Psychologie jusqu'à la fin du prochain Round.

> « Détermination (LDB 17 l.59) : immunité à la Psychologie jusqu'à la fin du prochain Round. » — commentaire `psychology.ts l.158`

Cette immunité ne supprime pas les afflictions déjà actives de façon permanente — elle **retarde** les déclencheurs : à expiration, les effets psy reprennent si la source est toujours présente.

**Sources RAW** :
- `LDB 17 l.59` — Détermination vs Psychologie

**Voir aussi** : `destin.md` (Détermination)
**Implémente :** [État calculé](../implemente.generated.md#4epsychologiedetermination-contre-la-psychologie)

---

## Table récapitulative

| Trait | Test requis | Difficulté | Sur succès | Sur échec | Fin de l'effet |
|-------|-------------|-----------|------------|-----------|----------------|
| **Animosité** | Calme | MJ | -20 Sociabilité seul. | Doit s'en prendre au groupe (+1 DR offensif) | Re-test fin de Round ou groupe absent/Sonné/Inconscient |
| **Peur (Indice)** | Calme (étendu) | Intermédiaire (+0) | DR cumulé ≥ Indice → vaincue | -1 DR vs source ; ne peut approcher (Test +0) ; source approche → Brisé (Test +0) | Vaincue quand DR cumulé ≥ Indice |
| **Terreur (Indice)** | Calme (unique) | Intermédiaire (+0) | Aucun effet supp. ; puis Peur d'Indice équiv. | Brisé × (Indice + |DR négatifs|) ; puis Peur d'Indice équiv. | Test unique à la 1ʳᵉ rencontre |
| **Frénésie** | Force Mentale | Intermédiaire (+0) | Entre en Frénésie (+1BF, attaque gratuite, immunité psy) | Pas de Frénésie | Ennemis LoV neutralisés ou Sonné/Inconscient → Exténué |
| **Haine** | Calme | MJ | Interaction limitée ; -0 (comportement libre) | Doit détruire (+1 DR Combat, immunité Peur/Intimidation sauf Terreur) | Re-test fin de Round ou groupe mort/disparu/Inconscient |
| **Préjugé** | Calme | MJ | -10 Sociabilité seul. | Doit insulter la cible à voix haute | Re-test au Round suivant ou groupe disparu/Sonné/Inconscient |
| **Phobie** | Calme (étendu) | Intermédiaire (+0) | — | Comme Peur 1 (ou Indice supérieur) | Même que Peur |
| **Amour/Camaraderie** | — | — | — | Obligation d'aide, +1 DR, immunité Peur/Intimidation (Amour) | Selon circonstances |

**Immunités croisées** :

| Trait actif | Immunisé contre |
|-------------|-----------------|
| Frénésie | Tous autres Traits Psychologiques |
| Haine | Peur et Intimidation du groupe haï (pas Terreur) |
| Amour (défense) | Peur et Intimidation |
| Immunité Psychologique (trait) | Tout |
| Belliqueux (si + Avantages) | Tout |
| Animosité active | Annulée par Peur et Terreur |

**Sources RAW récapitulatives** :
- `LDB 21 l.5-95` — toutes les règles de Psychologie (Traits courants + personnalisés)
- `LDB 85 l.178-179` — Immunité Psychologique
- `LDB 85 l.382-383` — Peur/Terreur par Taille
- `LDB 10 l.1051` — Talent Sans Peur (Ennemi)
- `LDB 17 l.59` — Détermination vs Psychologie

**Implémente :** [État calculé](../implemente.generated.md#4epsychologietable-recapitulative)

---

## Créatures — instances à consulter

Les créatures qui portent les traits Peur, Terreur, Immunité Psychologique, Frénésie, Haine ou Animosité dans leur statbloc sont listées dans le bestiaire du jeu. Ce document couvre la **règle** ; les **instances** (quelle créature porte quel Indice) appartiennent au futur `bestiaire.md`.

**Voir aussi** : futur `bestiaire.md`
