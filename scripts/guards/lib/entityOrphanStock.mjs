// STOCK CLIQUETÉ des entités de catalogue SANS CONSOMMATEUR (« curée, jamais atteinte = dette ») —
// consommé par `src/data/entity-orphans.test.ts`, GÉNÉRÉ par
// `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/entityConsumers.mjs` depuis la mesure
// de `entityConsumers.mjs` (`orphelinesMesurees`) — la MÊME que celle du rapport `docs/orphelines-donnees.md`.
//
// Une entrée de `traits.json`/`talents.json`/`qualities.json`/`maneuvers.json`/`skills.json`/
// `props.json`/`vehicles.json`/`creatures.json` (périmètre retenu, cf. `build-entity-orphans.mjs`) dont
// NI un AUTRE `src/data/*.json`, NI le code de prod (`src/**/*.ts(x)` hors tests, hors commentaires,
// citation littérale OU sélection par prédicat de champ — MODE 1/MODE 2, cf. en-tête de
// `entityConsumers.mjs`), NI une entrée `META_CATALOG_ENTRIES` ne couvre — est un ornement : la
// mécanique est juste, aucun chemin ne mène à elle. Mesuré, ce n'est PAS un artefact de repli par
// LABEL (`findTalent(name)?.id ?? slugId(name)`, `findSkill`, `traitIdByLabel`…) : pour les entrées
// ci-dessous, ni l'id ni le LABEL n'apparaissent ailleurs que dans leur propre déclaration (vérifié à
// la main avant bootstrap, #entity-orphans).
//
// FORME DES ENTRÉES — `{ fichier, ref, occurrence }`, la forme UNIQUE de tout stock nominatif du
// dépôt (`cleDeSite`, `scripts/guards/lib/stock.mjs`) : `fichier` = le dataset où l'entité est
// DÉCLARÉE (constant par catégorie, et c'est juste — c'est ce fichier que la porte de plage voit, et
// celui que l'auteur ouvre pour câbler), `ref` = l'id de l'entité. Une orpheline neuve est une ligne
// de plus qui NOMME son dataset ; une clé nue (`'traits:marque-de-tzeentch'`) est INVISIBLE à
// `croissanceDesStocks`, et un append n'y coûte rien. Toute prose posée ENTRE les entrées est mangée
// à la régénération — les dispositions vivent dans cet en-tête.
//
// UN SEUL CONTRAT : l'ensemble EXACT, dans les deux sens (`ecartDuVolet` — une orpheline hors stock
// échoue, une entrée que plus aucune orpheline ne porte échoue). Aucun PLAFOND, et aucune
// ligne-FAMILLE `(catégorie, livre) + compte` : un compte de famille laisse passer la SUBSTITUTION
// (une orpheline câblée, une autre créée — compte inchangé, garde verte), et surtout il est
// INVISIBLE à la porte de plage, qui ne lit pas les docs et ne voit qu'une entrée qui nomme un
// fichier. Le rapport `docs/orphelines-donnees.md` reste nominatif, mais un `.md` généré ne rougit
// pas : un doc n'est pas une garde. Une famille compte des ENTITÉS nommées, qui se câblent une à
// une : la dette est PAR ENTITÉ, et elle s'écrit entité par entité.
//
// Une entrée se solde en CÂBLANT l'entité (citation dans une donnée qui l'utilise réellement, ou
// dans le code de prod) puis en relançant le régénérateur — jamais en retirant la ligne à la main.
//
// DISPOSITIONS (ce que chaque groupe attend pour se solder ; la ligne, elle, est générée) :
//   — `traits:marque-de-tzeentch`, `talents:benediction-de-tzeentch`/`disciple-du-changement`/
//     `double-vie`/`empreint-de-la-magie` : bloqué par #676 — porteur attendu = carrière « Magus du
//     Culte de Tzeentch », absente de `careers.json` (EDOC 9).
//   — `traits:absorption`, `traits:contagieux` : bloqué par #921 (cause A) — mécanique `effects`
//     COMPLÈTE (et testée, `src/state/contagieux.test.ts`), aucune créature EDO ne porte le Trait.
//   — `traits:amorphe`, `traits:decerebre`, `traits:voleur-de-chair` : bloqué par #921 (cause B) —
//     prose seule, vocabulaire moteur absent (réduction de Blessures par type de dégâts et immunité
//     aux Critiques ; « joue toujours en dernier » et substitution BF/BFM ; possession de cadavre
//     avec prérequis Trait Démoniaque).
//   — `talents:sang-neuf` : bloqué par #744 — lignage éonir toriour absent de `species.json`.
//   — `qualities:filet-barbele`, `qualities:deroutante` : qualités d'ARME (`subType: 'arme'`) ;
//     aucun trapping ne les porte, cf. `assommante`/`defensive` sur les armes de base.
//     `noyau/interludeFlow.ts` (`falseQualities()`) les sélectionne par champ mais ne les exploite
//     que par LABEL (rumeurs de Particularité fausses, ADE II) — MODE 2 les rejette.
//   — `creatures` HORS bestiaires de livre : 7 PNJ `named` (`pol-dankels`, `isrogdal-lempresse`,
//     `ugrik-legaree`, `nazzaalta-affabule`, `artur-piedmarteau`, `p-tarix-celui-qui-ecrit`,
//     `xirat-p-celui-qui-lit`) — un personnage de scénario n'a de chemin que par la scène qui le
//     pose ; et 10 entrées de bestiaire isolé (`hyppogriffe`/`demigriffon-adulte` absentes de
//     `montures.json` donc jamais montables ; `chauve-souris-vampire-varghulf` absente de `groups.json` ;
//     `brochet-du-stir-fluvial` doublon de libellé de `brochet-du-stir` (seul l'exemplaire ZI a un
//     chemin) ; `sangsue-geante`/`sangsue-des-arbres`/`naiade` du « Bestiaire fluvial », qu'aucune
//     rencontre fluviale ne tire ; `familier-de-combat`/`familier-de-pouvoir`/`familier-de-sorts`
//     sans `appearance` et jamais citées par un Talent ou un sort).
//   — `creatures` des TROIS bestiaires de livre entièrement curés, qu'aucune scène ne convoque :
//     `middenheim` (#1637), `zoo-imperial` (#1638), et la faune `mer-des-griffes` hors des
//     événements de mer (#1639). Elles sont ÉNUMÉRÉES comme les autres : une dette de plusieurs
//     centaines qui se cache derrière trois lignes reste une dette de plusieurs centaines, et une
//     créature NEUVE de ces livres serait orpheline gratuitement et invisiblement sous un prédicat
//     de livre.

export const ENTITY_ORPHAN_RATCHET = [
  { fichier: 'src/data/creatures.json', ref: 'agna-lottrisdottir', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'alfric-demi-nez-brisenclume', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'amphisbaena', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'andrea-bruhn', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'arachnarok', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'artur-piedmarteau', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'athlete', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'baudroye', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'beate-moser', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'brigitte-schleigel', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'brise-krag', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'brochet-du-stir-fluvial', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'caledair-la-faux-de-feu', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'chamane-gobelin-des-forets', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'chauve-souris-vampire-varghulf', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'chef-de-meute-du-clan-moulder', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'chevalier-mort-vivant-revenant', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'crabe-boxeur', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'cultiste-de-la-lune-imprevisible', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'demigriffon-adulte', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'dragon-de-la-foret', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'elementaire-de-mer', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'emmille-munzstatter', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'experience-unique-du-clan-moulder', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'familier-de-combat', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'familier-de-pouvoir', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'familier-de-sorts', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'frere-bengt', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'gargantuan', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'gerdon-salzwed', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'gnawretch-skrray', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'gobelin-de-la-nuit', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'grain-d-achillee', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'grand-taurus', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'grand-vizir-bhar', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'griffon-zoo-imperial', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'gueule-d-effroi', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'hasso-schroeter', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'helmut-beckenbauer', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'hugo-vallonvert', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'hydre-d-os', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'hyppogriffe', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'isrogdal-lempresse', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'jacopo-schmidt', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'jetsam-la-gelee-intelligente', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'kat-sperber', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'kharibde', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'l-abominable-halagrundsor', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'l-ombre-du-fleuve', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'la-bete-de-l-oblast', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'le-fantasma', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'le-vieil-otto', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'le-vieux-dos-de-pus', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'leviathan-noir', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'leviathan-phare', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'long-drong-silver', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'loup-blanc', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'maitre-moulder-skree', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'mangeuse-d-hommes-de-la-drakwald-araignee-geante', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'marta-gerbenshreiber', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'moritz-valgeir', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'naiade', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'nazzaalta-affabule', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'nuee-de-squigs-des-cavernes', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'p-tarix-celui-qui-ecrit', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'pegase-noir', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'pol-dankels', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'prototype-du-clan-skryre', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'rat-ogre-briseur-d-os', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'raukos', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'razorgor', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'ritta', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'sangsue-cameleon', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'sangsue-des-abysses', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'sangsue-des-arbres', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'sangsue-geante', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'sorciere-troll-des-rivieres', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'spectre-middenheim', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'stylet', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'syrene-bleue', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'technomage-du-clan-skryre', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'theresia-kleist', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'traudl-bauer', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'ugrik-legaree', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'ver-des-marais', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'volee-de-noctecorbes', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'vouivre-zoo-imperial', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'vrisk-gratte-le-fer', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'waldtraud-blass', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'walpurga-wurklich', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'wereburga-krotpreffer', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'wulfric-tore', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'wulfrik', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'wulfrum-viert', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'wyrm-des-mers', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'xirat-p-celui-qui-lit', occurrence: 1 },
  { fichier: 'src/data/creatures.json', ref: 'yanni-weber', occurrence: 1 },
  { fichier: 'src/data/qualities.json', ref: 'deroutante', occurrence: 1 },
  { fichier: 'src/data/qualities.json', ref: 'filet-barbele', occurrence: 1 },
  { fichier: 'src/data/talents.json', ref: 'benediction-de-tzeentch', occurrence: 1 },
  { fichier: 'src/data/talents.json', ref: 'disciple-du-changement', occurrence: 1 },
  { fichier: 'src/data/talents.json', ref: 'double-vie', occurrence: 1 },
  { fichier: 'src/data/talents.json', ref: 'empreint-de-la-magie', occurrence: 1 },
  { fichier: 'src/data/talents.json', ref: 'sang-neuf', occurrence: 1 },
  { fichier: 'src/data/traits.json', ref: 'absorption', occurrence: 1 },
  { fichier: 'src/data/traits.json', ref: 'amorphe', occurrence: 1 },
  { fichier: 'src/data/traits.json', ref: 'contagieux', occurrence: 1 },
  { fichier: 'src/data/traits.json', ref: 'decerebre', occurrence: 1 },
  { fichier: 'src/data/traits.json', ref: 'marque-de-tzeentch', occurrence: 1 },
  { fichier: 'src/data/traits.json', ref: 'voleur-de-chair', occurrence: 1 },
]
