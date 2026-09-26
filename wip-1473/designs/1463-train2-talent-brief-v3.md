# Design v3 — train 2 du lot « ops à référence typées » : la référence de Talent (#1473, reprend #1646, #1621, intègre #1926), 2026-09-24

v2 (`1463-train2-talent-brief-v2.md`) RÉFUTÉE par `juge-design-socle` (run `wf_73c6cd86-258`, 2026-09-24) : 14 bloquants,
2 structurels (B6, B8), 0 écarté. Verdict : `/mnt/project-files/dettes/1463-train2v2-juge.md`. v1 était tombée sur « régime
hors schéma » ; v2 sur « le régime du porteur ne traverse pas la grammaire ». Deux passes sur la même classe : v3 remonte
d'un niveau. Le régime n'est plus un attribut de `gameOpSchema`, c'est un PARAMÈTRE de toute la grammaire mécanique.

Base du codeur : `chantier/1473-r2` APRÈS le commit de la fusion de #1897 (en cours de jugement) et la fusion de
`chantier/1473-r1` (correction 3 comprise). Toutes les lignes ci-dessous sont relues à l'arbre fusionné non committé de
`/home/claude/game/.wt-1473-r2` (2026-09-24) ; le codeur les relit à sa tête et nomme celles qui ont bougé.

Tickets : #1646 « Specs de talent HORS talents[] : 18 porteurs {talentId, spec} … » ; #1621 « specsOpen par TYPE = faux
verrou dans les DEUX sens … » ; #1926 « Sorts : 6 grantTalent posent un talent à spécialisation SANS spécialisation … » ;
#1924 « Création de personnage : createHero rend les AdvancementRef (ids) en LIBELLÉS puis les reparse » ; #1942
« Frénésie (à Volonté !) du Clan Pestilens : sa mécanique propre n'existe pas ».

## Invariant

1. #1646, corps, verbatim : « une ref de talent avec spec est le MÊME concept quel que soit son porteur (talents[]
   d'entité, passive d'une mutation/d'un trait, op d'un sort) ». Question : comment s'écrit une référence de Talent,
   et qui juge sa spécialisation, quel que soit son porteur ?
2. #1897, verdict du juge de design 2e-f1 (issuecomment-5805081053), verbatim : « `choix` s'ouvre sur opt-in, en une
   ligne, aux seuls porteurs d'EMPLACEMENT ». Question : où une spécialisation peut-elle rester non désignée ? Là
   seulement où un chemin d'application la désigne. La clé est donc le COUPLE (porteur, champ d'emplacement), pas le
   porteur entier (v2 B3, B9) ; et l'ouverture doit atteindre le champ quel que soit le chemin de schéma qui y mène
   (v2 B6, B8).
3. LDB 10 l.17, verbatim : « **Nom du Talent (utilisation) :** la dénomination du Talent. S'il y a des parenthèses, le
   mot à l'intérieur décrit une utilisation que le Talent influence. » Question : que porte la parenthèse d'un Talent ?
   Sa spécialisation, dont l'hôte est `spec` et le catalogue `talents.json#[].specs`.
4. `CLAUDE.md`, règle 7 : « une règle présente dans la source est IMPLÉMENTÉE, jamais reportée ». Question : que
   devient une règle du livre que la parenthèse nouvellement désignée fait apparaître et que le moteur ne porte pas
   (Frénésie à Volonté, désignation « au choix » d'un sort) ? Elle s'implémente dans le lot, ou elle a son ticket
   ouvert et cité avant la publication (#1942) ; un train du même lot publié ensemble est un séquençage, pas un report.

## Cas canonique déjà couvert

- La fabrique `refOuSpec(type, extra?, regime?)` de `grammaire/ref.ts` et ses régimes (`specSeule` par défaut,
  `specOuChoixFacultatifs`) ; porteur ouvert : `defs/creatures.ts:44` (Compétences de statbloc), désignées au spawn par
  `designateSpec` (`src/state/spawn.ts:144`, pool `specPoolOf`).
- Une grammaire construite UNE fois au chargement du module : `mecanique.ts` porte `OP_DEFS` (:31), `gameOpSchema`
  (:380), `effectOpSchema` (:618), `noeudTest` (:691), `flowSchema` (:732), `triggeredEffectSchema` (:797) ; 10
  `z.lazy(() => gameOpSchema)` dans `OP_DEFS` ; 87 lignes non-test de `src/data/schemas` nomment `gameOpSchema`.
- La parenthèse restreinte à un public, soldée par un ID DE CATALOGUE sourcé à sa phrase : `talents.json`
  `savoir-vivre.specs` `disciples-de-tzeentch` (`EDOC 13 l.524`), `suivants-de-khorne` (`MDG 07 l.250`), `pool: false`.
- Le catalogue ouvert PAR ENTRÉE : `entreeOuverte` (`ref.ts`), marqueur de `defs/talents.ts`.

Le nouveau cas en est une instance : chaque parenthèse de Talent est une `spec` désignée par `refOuSpec` ; ce qui varie
d'un porteur à l'autre est l'ensemble de ses OUVERTURES, et une ouverture est un argument de la grammaire, pas une
branche.

## Design

**E1. Graphie unique, homonymes et synonymes morts.**
- `grantTalent: { op, talent: <réf> }`, `grantCareerTalent: { op, talent: <réf> }`, `axes.talents: z.array(<réf>)` :
  toutes les références de Talent sont `refOuSpec('talent', extra?, regime)`, écrites AU SITE du porteur. La clé
  `talent` suit `grantCareerSkill.skill`. Migration datée sous `scripts/migrations/`, jouée par le job `migrations`. Les
  deux ops sortent d'`OPS_NON_TYPEES`.
- `talentRefSchema` (`grammaire/reference.ts:39`) MEURT (v2 B10) : chaque porteur appelle la fabrique à son site. Le
  codeur donne en sortie le régime de chaque site, avec son désignateur cité (`communs.ts:59`, `narratif.ts`, `creatures.ts:74`
  compris) ; un site sans désignateur est `specSeule`.
- Même classe, même geste : aucun nom partagé par deux schémas de formes différentes. Les `skillRefSchema` homonymes
  (`defs-scenes/communs.ts:24`, `defs/axes.ts`, `defs/creatures.ts`) prennent chacun un nom qui dit leur forme, ou
  meurent au profit de l'appel au site.
- Types (v2 B11) : le type moteur d'une référence est le type de la fabrique (`RefASpecialisation`, `RefDesignee`,
  `ref.ts`). Dans le périmètre des lecteurs que E6 réécrit, `SkillTalentRef` (`engine/talentEffects.ts`) meurt au
  profit de `RefASpecialisation` ; les types d'op de `engine/ops.ts` (`grantTalent`, `grantCareerTalent`,
  `grantCareerSkill`) se dérivent du type de la fabrique. `Ref` (`src/data/index.ts`) contre `RefDesignee`, et les deux
  `SkillRef` (`engine/skills.ts`, `src/data/index.ts`) : le codeur mesure leurs consommateurs ; dans le périmètre, un
  seul nom survit ; au-delà, ticket au gabarit #101, dédupliqué par label, cité au commit.

**E2. Les ouvertures sont un paramètre de TOUTE la grammaire mécanique (v2 B1, B2, B6, B8, B3, B9).**
- `mecanique.ts` expose UNE fabrique, `mecaniqueDe(ouvertures)`, qui construit la famille entière et la rend :
  `opDefs`, `gameOp`, `effectOp`, `flow`, `triggeredEffect` et tout autre nœud qui compose un `GameOp` (le codeur
  énumère : `noeudTest`, `travelTableEntry`, `shipCrewHit`… et dit lesquels sont atteints par un porteur ouvert).
  Mémoïsée par la forme canonique d'`ouvertures` (entrées triées). Les exports actuels deviennent l'instance sans
  ouverture : `OP_DEFS`, `gameOpSchema`, `flowSchema`… = `mecaniqueDe({})`. Les 87 sites qui nomment `gameOpSchema` ne
  changent pas.
- `ouvertures : Partial<Record<ChampDEmplacement, RegimeDeSpec>>`. `ChampDEmplacement` est le type des champs
  d'emplacement d'`OP_DEFS` (aujourd'hui `'grantTalent.talent' | 'grantCareerSkill.skill'`), déclaré À CÔTÉ de leurs
  définitions, pas dans une liste de la fabrique. Chaque champ d'emplacement lit SA clé :
  `refOuSpec('talent', extra, ouvertures['grantTalent.talent'] ?? 'specSeule')`. Les champs de DÉSIGNATION
  (`skillMod.skill`, `riderTest.skill`…) gardent `refOuSpec(type)`. `grantCareerTalent.talent` n'a aucun désignateur
  (`careerTalentAdditions` ne lit que `op.spec`) : il n'est pas un champ ouvrable tant qu'un désignateur n'existe pas.
- Les 10 `z.lazy` d'`OP_DEFS` et la récursion de `flow` pointent vers les membres de LEUR famille (fermeture), jamais
  vers le singleton du module. Chaque instance appelle `marquerOpAtteinte(ctx)` : la mesure au parse (`opsDuParse`,
  `slotsDuParse`) range l'identité des nœuds de DONNÉE, pas de schéma. `champsDOpASlot` et les docs lisent l'instance
  sans ouverture : mêmes champs quelle que soit l'ouverture.
- Porteurs ouverts, une ligne chacun, désignateur cité :
  - `defs/stars.ts:30` `ops` : `mecaniqueDe({ 'grantTalent.talent': 'specOuChoixFacultatifs' }).gameOp` ; désignateur :
    le créateur (`applyStarOps`, `src/engine/creation.ts:195` ; demande au joueur par `isUnresolvedChoice`).
  - `defs/talents.ts:94` `passive` (pas `effects`, :93) : `mecaniqueDe({ 'grantCareerSkill.skill':
    'specOuChoixFacultatifs' }).gameOp` ; désignateur : `careerSkillAdditions` (`src/engine/talentEffects.ts:162`), la spec
    du Talent porteur.
  - Train 3 : `defs/spells.ts:153` `effects: mecaniqueDe({ 'grantTalent.talent': 'specOuChoixFacultatifs' }).flow`,
    avec le désignateur au lancement. Coût N+1 d'un porteur désignateur neuf : une ligne au porteur, quel que soit le
    chemin de schéma sous lui.
- Fossile de transition, inscrit au registre de #1463 : la fusion de #1897 ouvre `grantCareerSkill.skill` AU CHAMP
  (`refOuSpec('skill', undefined, 'specOuChoixFacultatifs')`, `mecanique.ts:137`), donc pour tout porteur. Il meurt au
  train 2a : le champ revient à l'ouverture de `talents.passive`.
- La garde du masquage (`parse-de-mesure.test.ts`) reconnaît aujourd'hui l'émetteur d'op par l'identité
  `gameOpSchema.in` : elle doit reconnaître l'émetteur de TOUTE instance. Question en sortie : par `familleDuRepere`
  seul, ou par un registre des émetteurs tenu par la fabrique ?

**E3. Chaque parenthèse de Talent est une `spec` ; la classe « texte d'instance » meurt.** Données sourcées à la phrase
qui imprime chaque entrée :
- `destinee` : `specs` = les dix exemples de LDB 10 l.321-330 (ids slug, libellés verbatim), entrée ouverte (LDB 10
  l.315 « proposez une Destinée appropriée », l.319 « exemples … pour vous aider à créer votre propre Talent
  Destinée »). Les exemples restent au pool (pas de `pool: false`) : l.319 les offre au joueur qui crée sa Destinée.
  Les 21 textes de `creatures.json` restent des `spec` en texte libre admis par l'entrée ouverte. Le Maxi (LDB 10
  l.313 « **Maxi :** 1 ») attend l'arbitrage de Clément posé le 2026-09-24 (« Une seule » ou « Une par texte ») : sa
  réponse est consignée verbatim et datée à #1621. « Une seule » : l'entrée `destinee` déclare que son Maxi compte le
  Talent, par un champ de l'entrée (défaut : par parenthèse, comportement actuel de `talentMaxReached`,
  `careerSlots.ts:347`), lu par `talentMaxReached` ; le commentaire « Le Maxi se compte PAR spécialisation »
  (`careerSlots.ts:322`), aujourd'hui sans source, cite l'arbitrage. Sans réponse, le train ne se publie pas.
- `frenesie` : `specs` = `a-volonte`, libellé « à Volonté ! », source `frenchy-bzh` p.384, note
  `Habitants & Creatures 58 l.123`, `pool: false`. Sa mécanique : #1942, cité au commit.
- `attirant` : `specs` = `mutants-et-hommes-betes`, `pool: false`, source EDOC (folio relevé), note `EDOC 12 l.84`
  (« Gagne le Talent Attirant avec les mutants et les hommes-bêtes »). Libellé : la convention du précédent
  `savoir-vivre|disciples-de-tzeentch` face à SA phrase (`EDOC 13 l.524`), que le codeur cite et applique. Crête sur la
  tête écrit `{ id: 'attirant', spec: 'mutants-et-hommes-betes' }`.
- `bon-marcheur` : `specs` gagne `plaine`, source `frenchy-bzh`, note `frenchy.bzh 26 l.366` ; les 5 bornes deviennent
  `choix: ['foret', 'plaine']`, et `SPECS_DE_TALENT_A_CREER` meurt.
- Le cliquet `PLAFOND = 24` et son commentaire meurent ; `refs-migrated.test.ts` se réécrit sur la seule règle « toute
  spec de Talent résout au catalogue ou dans une entrée ouverte ».

**E4. Désignateur du spawn, un pour les deux types (v2 B4, B7, B13).** `designateSpec` (`spawn.ts:144`, aujourd'hui
`(sk: SkillData, …)`) devient `designateSpec(def, choix, seed)` pour toute def qui porte `specs`/`specsSource`
(`SkillData`, `TalentData`). Son pool est `specPoolOf(def)` (`src/data/index.ts:3516`, « ce qu'un choix joueur PROPOSE
d'office », sans `pool: false`), borné par `choix` quand c'est une liste. `talentsFromBook` (`spawn.ts:167`) prend la
même `seed` que `skillsFromBook` (`spawn.ts:153`, appelé `:238`) et l'appelle. Alors seulement les Talents de statbloc
(`creatures.ts:74`) s'ouvrent (`specOuChoixFacultatifs` au site), les 12 sentinelles « au choix » deviennent
`choix: true`, et la branche sentinelle de `defs-scenes/narratif.ts:120-127` meurt.

**E5. Données des sorts de #1926.** Sagesse de la chouette : `{ id: 'sens-aiguise', spec: 'vue' }` (LDB 43 l.307).
Cœurs ardents : une op `grantTalent` `coude-a-coude` rejoint les deux autres, et le fragment « Coude-à-coude …
(arbitrage MJ) » quitte la `narrative` (LDB 48 l.229). Les Deux Bœufs : `{ id: 'maitre-artisan', choix: true }` (ADE II
03 l.235), admis par l'ouverture de `stars.ts`. Sans peur nu (Flambeau, Cœurs ardents) : la `spec` de la réponse de
Clément à la carte du 2026-09-24, consignée verbatim et datée à #1926 ; sans réponse, ces deux ops restent telles
quelles et le train ne se publie pas. Instincts animaux, Traversée rapide, Dévotion : train 3.

**E6. Lecteurs, rendu d'un emplacement.** Les lecteurs d'op lisent `op.talent` et appellent
`refConcrete('talents', o.talent)`. Tout libellé d'une réf à `choix` passe par `choixLabel` (`index.ts:3621`) : Les Deux
Bœufs garde `isUnresolvedChoice(...) === true` (`CharacterCreator.tsx`, `creation.ts`), prouvé par un test promu de la
sonde du juge v1 `sonde-e3-deux-boeufs.mts`. Les deux chemins d'application de `grantTalent` (mutation de `c.talents`,
`ops.ts` ; lecture dérivée `traitGrantedTalents`, `talentEffects.ts:206`) lisent la même graphie.

**E7. Éditeurs (v2 B5, B13).** `TalentSpecListField` et `SkillSpecListField` deviennent des listes de `RefField`. La
liste des specs proposées vient de `specCatalogOf(def)` (`index.ts:3525`, « la liste qu'un écran de RÉFÉRENCE imprime
(Codex/éditeur) »), la saisie libre n'existe que si `entreeOuverte(type, id)`. `RefField` en mode spec ne propose
`choix` que si le schéma du champ l'admet : l'ouverture se lit sur l'instance de schéma qui porte le champ (la fabrique
d'E2 l'y dépose en méta), jamais d'un second registre. Question en sortie : par où `StructFields` et `GameOpEditor`
reçoivent-ils le schéma du champ qu'ils éditent (`fichier:ligne`) ? Test promu : éditer puis sauver Les Deux Bœufs
conserve `choix: true`. `OP_REF_FIELDS` (`GameOpEditor.tsx`) : ses entrées des ops typées se dérivent d'`OP_DEFS` ; il ne
reste à la main que les ops d'`OPS_NON_TYPEES` (lot de mort #1468), et le commentaire « SOURCE UNIQUE » qui le précède se
réécrit dans le même geste.

**E8. Ce qui meurt dans le geste (v2 B14).** Mesuré par grep des NOMS à la tête du codeur, pas par plages de lignes :
- `gameOpRefFk.mjs` : `grantTalent.talentId`, `grantCareerTalent.talentId`, `grantTalent.spec`,
  `grantCareerTalent.spec` (`coveredBy`) ;
- `grammaireStock.mjs` et les lignes `reference … talentId` de `structuresStock.mjs` ;
- `spec-pool-contrat.test.ts` (entrées des specs à créer) ;
- `refs-migrated.test.ts` : le cliquet `PLAFOND = 24` (E3), le cliquet des sentinelles `PLAFOND = 12` et sa phrase
  « se tranche à #1621 ; d'ici là, une 13e rougit » (E4), le contrôle positif qui lit `SPECS_DE_TALENT_A_CREER`
  (réécrit sans le stock) ;
- `grammaire/reference.ts` (`talentRefSchema`, E1) ; `narratif.ts` (branche sentinelle, E4) ;
- les mentions de #1621 dans `defs/trappings.ts` et `grammaire/formes-partagees.test.ts` (elles visent
  `qualityRefSchema`) : réancrées si #1621 se ferme avec ce lot.

**E9. La clé d'une instance de Talent (v2 B12).** `TalentInstance.talentId` et `ActiveEffect.grantedTalent.talentId`
(`src/engine/types.ts`) passent à `id`, comme `SkillInstance.id` : une seule clé pour le même concept à la couture
op → état. `talentConcrete` (`index.ts`) meurt, `refConcrete` sert les deux. Empreinte mesurée par le juge v2 : 200
lignes `talentId` dans 56 fichiers de `src` hors tests, 82 dans `src/data/*.json` ; migration datée des JSON et des
sauvegardes (`scripts/migrations/`). Train 2c, publié avec 2a et 2b.

## Questions au juge

1. E2 : `mecaniqueDe(ouvertures)` est-elle la seule couture ? Un nœud qui compose un `GameOp` échappe-t-il à la
   famille (sonde : tout `gameOpSchema`/`flowSchema` nommé DANS `mecanique.ts` après la réécriture) ?
2. E2 : `ChampDEmplacement` comme type des clés, lu par chaque champ : variante à branche, ou instance ?
3. E3 : les exemples de Destinée au pool, contre `pool: false` pour `a-volonte` et `mutants-et-hommes-betes` : la
   ligne de partage (offert au joueur par le livre, ou réservé à un public) tient-elle au Source cité ?
4. E9 : dans ce lot, ou ticket ? Coût mesuré contre le coût d'un synonyme laissé à la couture.

## Trains et dépendances

- Train 2a : E1, E2, E3, E5 (sauf trois sorts), E6, E7, E8. Bloqué par le commit de la fusion de #1897 dans
  `chantier/1473-r2` et par la fusion de `chantier/1473-r1` (correction 3).
- Train 2b : E4. Train 2c : E9. Même lot, même publication.
- Train 3 : désignateur au lancement, `defs/spells.ts` ouvert (une ligne), garde de classe de #1926, recette navigateur
  en joueur. Se publie avec 2a, 2b, 2c.
- Publication : bloquée par les réponses de Clément (Sans peur, Destinée).

## Portes (geste joueur)

Lancer Sagesse de la chouette : la fiche montre Sens aiguisé (Vue). Lancer Cœurs ardents : Coude-à-coude apparaît.
Créer un héros né sous Les Deux Bœufs : le créateur demande le Métier, le héros a Maître artisan (ce Métier). Un
héros qui reçoit Crête sur la tête voit « Attirant (…) » avec le libellé retenu. Un Moine de la peste en combat montre
« Frénésie (à Volonté !) ». Un Prêtre rôdeur de Taal a Bon marcheur (Forêt) ou (Plaine), le même à chaque projection.
Créer un héros humain : sa Destinée se choisit parmi les exemples ou s'écrit.

## Réponse au verdict v2 (14 bloquants)

1. Liste d'ops nommées dans la fabrique → E2 : `mecaniqueDe`, chaque champ lit sa clé, `OP_DEFS = mecaniqueDe({}).opDefs`.
2. [même classe que 6, 8] Flow hors régime → E2 : la famille entière, `spells.ts` en une ligne.
3. Régime par porteur entier → E2 : ouverture par (porteur, champ), `grantCareerTalent` non ouvrable.
4. `catalogueSpecs` → E4 : `specPoolOf`.
5. `specOptionsFor`, `RefField` perd `choix` → E7 : `specCatalogOf`, ouverture lue sur le schéma du champ, test promu.
6. [structurel] « une ligne » faux pour Flow → E2.
7. Prémisse fausse sur `catalogueSpecs` et `careerSlots.ts:33` → retirée, E4.
8. [structurel] `OP_DEFS` statique incompatible → E2 : `OP_DEFS` est l'instance sans ouverture.
9. Régime de document entier → E2 : clé (porteur, champ).
10. Homonymes `talentRefSchema`/`skillRefSchema` → E1.
11. Synonymes de type → E1.
12. `talentId`/`id` → E9.
13. Canon du pool ouvert → E4 (`specPoolOf`), E7 (`specCatalogOf`).
14. Inventaire des retraits → E8.
