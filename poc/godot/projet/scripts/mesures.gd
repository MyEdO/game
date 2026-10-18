## Modes de mesure du prototype #2793, lus dans `location.search` : `?mesure=pont`, `?sonde=exception`.
extends Node

const N_APPELS := 100


func _ready() -> void:
	if not Pont.est_web:
		return
	await get_tree().process_frame
	print("[chargement] ms=", Pont.evaluer("performance.now()"))


## Lance les modes demandés dans l'URL ; `vue` = la vue rendue par `demarrer`.
func lancer(vue: Dictionary) -> void:
	if _parametre("sonde") == "exception":
		var r: Variant = Pont.sonder_exception_nue()
		print("[sonde-exception] recu=", type_string(typeof(r)), " valeur=", str(r))
		Pont.relever_erreurs_globales("sondeExceptionNue")
	if _parametre("mesure") == "pont":
		_mesurer_pont(vue)


func _parametre(cle: String) -> String:
	return str(Pont.evaluer("String(new URLSearchParams(location.search).get('%s') ?? '')" % cle))


func _mesurer_pont(vue: Dictionary) -> void:
	var attaquant := ""
	var cible := ""
	for c in vue.combattants:
		if c.camp == "heros" and attaquant == "":
			attaquant = c.id
		elif c.camp == "adversaires" and cible == "":
			cible = c.id
	var appels_vue: Array[float] = []
	var echecs_vue := 0
	for i in N_APPELS:
		var t0 := Time.get_ticks_usec()
		var r: Variant = Pont.appeler_brut("vue")
		appels_vue.append((Time.get_ticks_usec() - t0) / 1000.0)
		if not (r is Dictionary and r.get("ok") == true):
			echecs_vue += 1
	var appels_attaque: Array[float] = []
	var echecs_attaque := 0
	for graine in range(1, N_APPELS + 1):
		var entree := {attaquant = attaquant, cible = cible, graine = graine}
		var t0 := Time.get_ticks_usec()
		var r: Variant = Pont.appeler_brut("simulerAttaque", entree)
		appels_attaque.append((Time.get_ticks_usec() - t0) / 1000.0)
		if not (r is Dictionary and r.get("ok") == true):
			echecs_attaque += 1
	print("[mesure-pont] ", JSON.stringify({
		vue = _statistiques(appels_vue, echecs_vue),
		simulerAttaque = _statistiques(appels_attaque, echecs_attaque),
	}))
	Pont.relever_erreurs_globales("simulerAttaque")


func _statistiques(durees_ms: Array[float], echecs: int) -> Dictionary:
	var triees := durees_ms.duplicate()
	triees.sort()
	var n := triees.size()
	var milieu := int(n / 2.0)
	var mediane: float = triees[milieu] if n % 2 == 1 else (triees[milieu - 1] + triees[milieu]) / 2.0
	var p95: float = triees[int(ceil(0.95 * n)) - 1]
	return {n = n, echecs = echecs, mediane_ms = snappedf(mediane, 0.001), p95_ms = snappedf(p95, 0.001)}
