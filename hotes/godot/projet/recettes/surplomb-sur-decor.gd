extends SceneTree

## Le volume servi par l'éditeur (#3833) : le même tablier à 4 m, sur un rez à 1 m, reçoit un
## tonneau au-dessous. Le morceau du sol de l'étage reçu en octets garde ses tranches et ses montants.

const RECETTE_AUTONOME := true
const PROJET := "arene"
const ETAGE := "sol/1/0/0"
const POSE := "pose/0/0/0"
const REZ_M := 1.0
const DESSOUS_M := 3.7
const ETAGE_M := 4.0
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	var pont: PontDuNoyau = root.get_node("Pont")
	if await pont.rejoindre(_fautes.append, _fautes.append):
		var libre := _etage(pont, false)
		var meuble := _etage(pont, true)
		if not libre.is_empty() and not meuble.is_empty() and libre != meuble:
			_fautes.append("le tonneau change le morceau de l’étage : %s → %s" % [libre.empreinte, meuble.empreinte])
	else:
		_fautes.append("le pont du noyau ne s’est pas ouvert")
	for faute in _fautes:
		push_error("[surplomb-sur-decor] " + faute)
	print("[surplomb-sur-decor] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


func _etage(pont: PontDuNoyau, meuble: bool) -> Dictionary:
	var cas := "avec tonneau" if meuble else "sans tonneau"
	var edition := pont.appeler("editer", {ouvrir = PROJET, projet = JSON.stringify(_projet(meuble))})
	if edition.get("ok") != true:
		_fautes.append("%s : l’ouverture du projet n’a pas abouti" % cas)
		return {}
	var manifestes: Array = edition.monde.morceaux.map(func(m: Dictionary) -> String: return m.cle)
	if manifestes.has(POSE) != meuble:
		_fautes.append("%s : le manifeste contient %s" % [cas, manifestes])
	var recus := pont.appeler("morceaux", {source = "edition", volume = [ETAGE], toits = [], couronnes = []})
	if recus.get("ok") != true or recus.volume.size() != 1:
		_fautes.append("%s : le morceau %s n'est pas reçu" % [cas, ETAGE])
		return {}
	var bloc: Dictionary = recus.volume[0]
	var tranche := _bornes(bloc, "relief--pierre")
	var montant := _bornes(bloc, "relief--pilier")
	if not tranche.is_equal_approx(Vector2(DESSOUS_M, ETAGE_M)) or not montant.is_equal_approx(Vector2(REZ_M, DESSOUS_M)):
		_fautes.append("%s : tranche %s, montants %s" % [cas, tranche, montant])
	print("[surplomb-sur-decor] %s : %s, tranche %s, montants %s" % [cas, bloc.empreinte, tranche, montant])
	return bloc


func _bornes(bloc: Dictionary, matiere: String) -> Vector2:
	var basse := INF
	var haute := -INF
	for surface: Dictionary in bloc.surfaces:
		if surface.matiere != matiere:
			continue
		for sommet in range(int(surface.debut), int(surface.fin)):
			var y: float = bloc.positions[3 * sommet + 1]
			basse = minf(basse, y)
			haute = maxf(haute, y)
	return Vector2(basse, haute)


func _projet(meuble: bool) -> Dictionary:
	var rez := []
	var etage := []
	var hauteurs := []
	rez.resize(16)
	rez.fill("plancher")
	etage.resize(16)
	etage.fill("vide")
	hauteurs.resize(16)
	hauteurs.fill(REZ_M)
	etage[5] = "terre"
	var haut := hauteurs.duplicate()
	haut.fill(0.0)
	haut[5] = ETAGE_M
	var tonneau := {id = "tonneau-de-recette", kind = "prop", decor = {id = "tonneau"}, pos = {x = 1, y = 1}}
	return {
		id = PROJET, type = "projet", label = "Recette du surplomb", icon = "scenario/arene", versionContenu = 1,
		maison = "Carte de recette",
		narratif = {affaires = [], indices = [], presetsPnj = [], objets = [], documents = [], etats = []},
		scenes = [{
			id = "surplomb-sur-decor", type = "scene", label = "Tablier", dimensions = {w = 4, h = 4},
			reliefDefaults = {cliff = {id = "terre"}, ramp = {id = "terre"}, deck = {id = "pierre"}, pilier = {id = "pilier"}},
			roofDefaults = {material = {id = "toit-ardoise"}, pitchDeg = 45, riseMaxStoreys = 1},
			layers = [{z = 0, tiles = rez, height = hauteurs}, {z = 1, tiles = etage, height = haut}],
			entities = [tonneau] if meuble else [],
		}],
	}
