# Atlas RAW — Sources & conventions

Le **RAW** du projet = ces **livres** (VF — sauf le **CRB**, Core Rulebook 5e, en **VO** par arbitrage
utilisateur du 2026-09-18 — convertis en `.md` sous `Source/`, table complète ci-dessous). Référence exacte
dans [`../../AGENTS.md`](../../AGENTS.md) § *Sources VF*.

## Convention de référence

`<ABRÉV> <NN> l.<début>-<fin>` — exemple `LDB 13 l.142` :
- `<ABRÉV>` = l'abréviation du livre (table ci-dessous) ;
- `<NN>` = le **préfixe numérique** du fichier de chapitre (ex. `13` = `13 - Combat.md`) ;
- `l.<début>-<fin>` = les **numéros de ligne** du `.md` source (numérotation `cat -n` / éditeur).

C'est la même convention que les commentaires de code `// LDB 13 l.142` (1076 occurrences dans `src/`),
donc une ref de l'Atlas pointe le **même** endroit que le code.

## Les livres autorisés

| Abrév. | Livre | Dossier `Source/` | Rôle |
|---|---|---|---|
| **LDB** | Livre de base (version corrigée) | `Warhammer v4 - Livre de base version corrigee/` | Cœur des règles |
| **ADE I** | Les Archives de l'Empire, vol. 1 | `Warhammer v4 - Les archives de l'Empire volume 1/` | Carrières, talents, objets, créatures |
| **ADE II** | Les Archives de l'Empire, vol. 2 | `Warhammer v4 - Les archives de l'Empire volume 2/` | Ogres, carrières, talents, créatures |
| **AA** | Aux Armes (*Up in Arms*) | `WH - V4 - Aux Armes/` | Combat & armes, talents, sièges, montures |
| **ZI** | Le Zoo Impérial (*The Imperial Zoo*) | `WH - V4 - Le zoo imperial/` | Créatures exotiques, trait Redoutable, objets |
| **MCLB** | Middenheim, la cité du Loup Blanc | `Warhammer v4 - Middenheim la cite du Loup Blanc/` | 3 origines humaines, carrière Frère Loup |
| **EDO** | T1 — L'Ennemi dans l'Ombre | `Warhammer v4 - 1.0 L'ennemi dans l'Ombre/` | Sorts Tzeentch, créatures du Chaos, talents/traits |
| **EDOC** | T1 — Compagnon | `Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon/` | Véhicules, règles add. |
| **MSR** | T2 — Mort sur le Reik | `Warhammer v4 - 2.0 Mort sur le Reik/` | Créatures, règles spéciales (eau, navires…) |
| **MSRC** | T2 — Compagnon | `Warhammer v4 - 2.0 Mort sur le Reik Compagnon/` | Créatures, PNJ statblockés |
| **PDT** | T3 — Le Pouvoir derrière le Trône | `Warhammer v4 - 3.0 Le Pouvoir Derriere le Trone/` | Créatures, règles spéciales |
| **ACE** | Aldorf, la Couronne de l'Empire | `Warhammer v4 - Aldorf la Couronne de l'Empire/` | Objets magiques, gangs, règles de cadre |
| **AU1** | Aventures à Ubersreik | `Warhammer v4 - Aventures a Ubersreik/` | Contenu de cadre (peu de règles de combat) |
| **NADJ** | Nuits agitées & dures journées (*Rough Nights & Hard Days*) | `Warhammer v4 - Nuits agitees & dures journees/` | Créatures, jeux de taverne, règles spéciales |
| **MDG** | La Mer des Griffes (*Sea of Claws*) | `WH - V4 - La Mer de Griffe/` | Cadre côtier + règles navales : navires & artillerie, navigation/combat naval, carrières Côtier, cultes Manann/Stromfels, magie des mers, bestiaire marin |
| **VDM** | Les Vents de Magie (*Winds of Magic*) | `Warhammer v4 - Les Vents de Magie/` | Magie des 8 Collèges : règles d'incantation révisées + rituels, sorts par domaine, carrières de sorcier, artefacts magiques, créatures magiques (élémentaires/familiers), sites & lignes de force |
| **CRB** | Warhammer Fantasy Roleplay *5th Edition* — **VO** | `Warhammer Fantasy Roleplay 5e Core Rulebook/` | Cœur des règles de la 5e édition : création de personnage, classes & carrières, compétences & talents, règles générales et de combat, entre-aventures, religion & miracles, magie, direction de jeu, Reikland, équipement, bestiaire |

> **Règle 1 du projet** : toute règle vient de ces livres ; en cas de doute, **lire le `.md` et citer**.
> Les tomes/suppléments sont des **sources de règles** (leur donnée mécanique = RAW) ; seule leur prose
> d'intrigue n'est pas une *règle*. Mine-les aussi sérieusement que le LDB.

## EXCLU des règles

**Boîte d'Initiation WFRP 4e** (`Boite d'Initiation WFRP 4e Edition VF/`, `WH4_FR_BI_Livre_Aventure/`,
`WH4_FR_BI_Livre_Ubersreik/`) — **Starter Set à ruleset simplifié divergent** du LDB.
**JAMAIS** une source de règles ni de stats.

## Densité par livre (domaine Combat, à titre indicatif)

Nombre de passages-règles de combat repérés au survey du pilote :
`LDB ×143 · AA ×75 · ZI ×61 · EDO ×24 · EDOC ×18 · ADE II ×17 · NADJ ×12 · MSRC ×11 · MSR ×6 · ADE I ×4 ·
MCLB ×3 · ACE ×2 · PDT ×1 · AU1 ×0`. (La densité varie selon le domaine.)
