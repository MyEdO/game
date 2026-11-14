## La disposition de la fenêtre (#3328) : la scène d'éditeur, sans script, qui range les zones de la fenêtre qui tient
## la main. Celle que la vue nomme (`vue.disposition`, `res://ecrans/<disposition>.tscn`) quand elle existe, sinon la
## générique (`GENERIQUE`) ; elle s'instancie juste après ce nœud, sous les panneaux de la scène, et remplace la précédente.
class_name Disposition
extends Node

## @contrat L'écran de Godot
## L'écran (`projet/scenes/Ecran.tscn`) se partage en trois : le journal à droite, le groupe au pied, et la scène
## (`Scene`), l'espace qui reste, que la fiche ouverte rétrécit à sa gauche, où se posent la disposition, le tour, l'actif
## et le dialogue, et où se cadre le monde (`Monde.cadre`) ; rien ne recouvre le groupe ni le journal. Une disposition
## qui range elle-même les lignes du journal (`journal.lignes`) le tient dans sa scène : son panneau se cache et la
## scène prend sa largeur. Les zones de la
## fenêtre vivent dans sa disposition, une scène d'éditeur sans script que le nœud `Disposition`
## (`projet/scripts/disposition.gd`) de l'écran instancie : `projet/ecrans/<disposition>.tscn` quand elle existe, la
## générique `projet/ecrans/fenetre.tscn` sinon. Une disposition dédiée range autrement les mêmes sources : une zone qui
## nomme des `ids` n'en montre que ces éléments, un id fini par `/` nommant toute la famille des ids qui commencent par
## lui, une zone sans `ids` ceux qu'aucune autre zone de sa source ne nomme (`Zone.montrer_toutes`), si bien qu'aucun
## élément ne se perd. Les fenêtres de jet héritent du cadre `projet/cadres/fenetre_de_jet.tscn`, posé en bas à droite
## de la scène, à l'écart du panneau de l'actif (`Hud/Gauche`) en haut à gauche. L'écran d'attaque
## (`projet/ecrans/cascade/attaque.tscn`) montre la cible,
## l'arme et ses pastilles, le jet de l'attaquant face à celui de la défense (le nombre à atteindre et le dé en gros),
## l'issue, les options du coup puis les gestes en rangée ; l'écran de Défense (`projet/ecrans/cascade/defense.tscn`),
## sa réaction et son score à atteindre avant le dé face au jet de l'attaquant, révélé une fois le dé tombé. La fenêtre
## d'incantation (`projet/ecrans/cascade/incantation.tscn`) montre le sort et sa
## cible, le jet du lanceur (son NI au libellé), la zone et le budget de Surincantation en pastilles, l'issue, puis
## chaque axe que le sort ouvre en choix de pas, de 0 au budget, chaque pas de trop refusé avec sa raison. L'écran du
## lieu et la carte du monde sont la couche « monde », plein écran, jamais une fenêtre posée par-dessus : chacun hérite
## du cadre `projet/cadres/monde.tscn`, posé sous les panneaux de la scène comme toute disposition, le titre en grand
## et les gestes en tête, la bourse du groupe dessous quand l'écran la montre (`bourse`), et n'y ajoute que son
## contenu. L'écran du lieu (`projet/ecrans/ecranDuLieu.tscn`) ouvre la carte en tête (`lieu/carte`), dit sa
## description sous son titre quand il en a une (`lieu/description`) et se partage en deux : à gauche le plan de la
## carte vu d'ici, sur son parchemin (`lieu/plan`, ici en `alerte`) puis, sous leur titre (`lieu/trajets`), les
## trajets qui en partent, un par ligne, chacun sa destination et son départ ; à droite, sous leur titre
## (`lieu/services`), ses services (`service/` : le fond de leur vignette, leur icône, le boniment de leur hôte, ce
## qu'on y fait) et les points d'intérêt de son plan qui mènent à une scène (`poi/`, chacun le choix `ecranDuLieu`
## `entrer`), en cartes ; la carte (`projet/ecrans/carteDuMonde.tscn`),
## son plan (`carte/plan` : chaque lieu visible, ici en `alerte`, sous chaque destination le départ du trajet qui y
## mène, le même élément qu'à l'écran du lieu, et chaque route entre deux lieux visibles, celles qui partent d'ici et
## sont ouvertes en `reussite`), puis la reprise d'un voyage interrompu. L'échoppe (`projet/ecrans/marchand.tscn`, lue
## par `marchandEnVue`, `src/noyau/marchandEnVue.ts`) montre côte à côte l'étal rangé par famille (`etal/` : chaque
## article à son prix, pressé tant que le panier en tient) et le comptoir : le panier (`panier` : chaque ligne qui en
## ôte une unité, puis le paiement de son total, refusé avec sa raison), les possessions de chaque héros (`vente/` :
## chacune à son gain, pressée tant qu'elle est au lot) et la vente du lot. Le marché de cargaison, à la halle
## (`projet/ecrans/marcheDeTerre.tscn`) comme au port (`projet/ecrans/port.tscn`, qui en hérite), est lu par
## `marcheEnVue` (`src/noyau/marcheEnVue.ts`) sur la formule de sa fenêtre (`FORMULES_DES_MARCHES`,
## `src/noyau/cargaison.ts`) : à gauche chaque offre (`offre/` : son Enc disponible, son prix de base par Enc, la
## qualité de son vin évalué ou son évaluation, l'estimation de son achat, puis son achat, qui la compose : le porteur
## qui la charge, le premier qui le peut saisi d'avance, l'Enc et la conclusion sont les choix du marché), à droite
## chaque lot des porteurs du groupe (`lot/` : son porteur et son Enc, son prix de base, sa vente, son bradage, puis
## son transfert en formulaire vers un porteur co-localisé). Le voyage
## (`projet/ecrans/voyage.tscn`) est la disposition de toute étape d'une séquence jouée en route (`voyageEnVue`,
## `src/noyau/voyageEnVue.ts`) : la journée ne s'y arrête qu'aux vrais choix (`jouerLaJournee`, `src/noyau/cascade.ts`),
## le reste va au journal. C'est une scène, jamais une fenêtre : son paysage tient tout le cadre (`scene/paysage`, les
## couches du moment, de la voie, de l'équipage et de la météo, que `Dessin` trace l'une sur l'autre) et tout s'y pose.
## En haut à gauche l'objet du temps, un cartouche (`Cartouche`) : le ciel du moment dans son arche (`scene/ciel`, en
## `arche`), le jour de la semaine, la date et le jour de route (`scene/jour`, `scene/date`, en `rubrique`), le
## pictogramme de la météo et le moment (`scene/meteo`, `scene/moment`) ; en haut à droite, dans un cartouche, le titre
## de la carte (`voyage/titre`, en `rubrique`) sur la carte du trajet (`voyage/carte`, en `carteDuVoyage` : chaque
## lieu, le départ et l'arrivée nommés, le groupe sur sa route) ; à droite le récit : le
## titre de ce qui tient la journée, le journal de la partie, ses dernières lignes au pied et le reste au défilement, les jets qu'aucun
## héros ne jette (`jets/`), puis ses gestes ; au pied les km qui restent avant l'arrivée (`voyage/reste`, en `reste`)
## sur la frise (`voyage/frise`, en `frise`, chaque point en `etapeDeFrise` : le départ, chaque nuit passée en route à
## son km sous son croissant, le groupe, l'arrivée).
## Le jet d'un héros (en `jetDeHeros` : son dé dans une pastille à son ton, puis son test et son issue) et les gestes
## qui le désignent sont sur sa carte (`groupe.heros`), cerclée quand c'est à lui d'agir. La halte de nuit
## (`projet/ecrans/repos.tscn`) est la même scène, hors d'un trajet comme en route : son paysage est celui de la nuit
## et de son toit, son arche le ciel de nuit, son moment la nuit et son lieu ; la nuit de chaque dormeur, son couchage et sa pitance, est sur sa
## carte.
## Le document remis (`projet/ecrans/document.tscn`) se pose au centre, son texte dans un
## défilement : le Markdown verbatim de la donnée, montré tel quel. Un écran dédié neuf, c'est une scène de plus sous
## `projet/ecrans/`, sans ligne de GDScript.

const GENERIQUE := "res://ecrans/fenetre.tscn"
## La source des lignes du journal : la disposition qui la range tient le journal dans sa scène.
const LIGNES_DU_JOURNAL := "journal.lignes"

## Le panneau du journal de l'écran, caché sous une disposition qui range elle-même ses lignes.
@export var journal: Control

## Le chemin de la scène posée, `""` avant la première.
var scene := ""
var _posee: Node = null


## La scène de `disposition` posée (`null` : la générique) ; vrai si elle a remplacé la précédente, ses zones neuves.
func disposer(disposition: Variant) -> bool:
	var chemin := GENERIQUE
	if disposition != null and ResourceLoader.exists("res://ecrans/%s.tscn" % disposition):
		chemin = "res://ecrans/%s.tscn" % disposition
	if chemin == scene:
		return false
	if _posee != null:
		_posee.get_parent().remove_child(_posee)
		_posee.queue_free()
	_posee = load(chemin).instantiate()
	add_sibling(_posee)
	journal.visible = not Zone.racines(_posee).any(func(zone: Zone) -> bool: return zone.source == LIGNES_DU_JOURNAL)
	scene = chemin
	return true
