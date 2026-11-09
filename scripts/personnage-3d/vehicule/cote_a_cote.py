"""Côte à côte d'un navire et de son illustration (#3790), la pièce du juge qui statue signe identitaire par signe
identitaire (chapitre 9 de la procédure), la coque à la même longueur (`LARGEUR` px, l'étrave et l'étambot alignés) dans
chaque bande, les stations f = 0..1 par dixièmes :

- `profil.png` : le profil de `ILLUSTRATION` (`vehicule/<type>/donnees.py`) recadré dans l'illustration, puis le rendu
  orthographique du GLB dans la même orientation, la flottaison et les hauteurs de mètre en mètre ;
- `pont-<z>.png`, pour chaque pont z de `ILLUSTRATION["ponts"]` : ses plans recadrés dans l'illustration, le rendu
  orthographique de dessus du GLB coupé `COUPE` m au-dessus du sol de ce pont (aucune coupe au pont du haut), puis le
  plan de jeu vu de dessus (la case la plus haute des ponts 0..z, teinte selon sa hauteur ; cloisons, portes, échelles,
  sabords et fenêtres de `ponts`) et les postes d'arme du manifeste `<id>.element.json` voisin du GLB.

Hors du dépôt, sans autre dépendance que bpy :

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/vehicule/cote_a_cote.py <type> --glb <glb> --illustrations <dossier du recueil> --sortie <dossier hors du dépôt>
"""
import argparse
import json
import math
import runpy
import sys
import tempfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path[:0] = [str(ICI), str(ICI.parent)]

import bpy  # noqa: E402
import bmesh  # noqa: E402  (après bpy, qui le charge)
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import habillage  # noqa: E402
import navire  # noqa: E402
import plan_de_jeu  # noqa: E402

LARGEUR = 1000          # px de coque
MARGE = 60              # px de part et d'autre de la coque
ECART = 8               # px blancs entre deux bandes
COUPE = 1.2             # m au-dessus du sol d'un pont
STATION, EAU, METRE = (0.0, 0.67, 0.0), (0.9, 0.0, 0.0), (0.0, 0.47, 1.0)
BAS, HAUT, GRILLE = (0.80, 0.88, 0.96), (0.98, 0.78, 0.50), (0.6, 0.6, 0.6)
ARETES = {"|": (0, 0, 0), "-": (0, 0, 0), ":": (0.6, 0.3, 0.0), "H": (0.0, 0.6, 0.0), "x": (0.9, 0.0, 0.0),
          "o": (0.0, 0.3, 1.0)}
POSTE = (0.85, 0.0, 0.85)


def image(chemin):
    """Les pixels RGB de l'image `chemin`, du haut vers le bas."""
    im = bpy.data.images.load(str(chemin))
    w, h = im.size
    px = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, :3]
    bpy.data.images.remove(im)
    return px


def ecrire(px, chemin):
    im = bpy.data.images.new(chemin.stem, px.shape[1], px.shape[0])
    im.pixels = np.concatenate([px[::-1], np.ones(px.shape[:2] + (1,), dtype=np.float32)], axis=2).ravel()
    im.filepath_raw, im.file_format = str(chemin), "PNG"
    im.save()
    bpy.data.images.remove(im)


def mise_a_l_echelle(px, k):
    """`px` agrandie ou réduite du facteur `k`, bilinéaire."""
    h, w, _ = px.shape
    H, W = max(1, round(h * k)), max(1, round(w * k))
    ys, xs = np.clip((np.arange(H) + 0.5) / k - 0.5, 0, h - 1), np.clip((np.arange(W) + 0.5) / k - 0.5, 0, w - 1)
    y0, x0 = np.floor(ys).astype(int), np.floor(xs).astype(int)
    y1, x1 = np.minimum(y0 + 1, h - 1), np.minimum(x0 + 1, w - 1)
    fy, fx = (ys - y0)[:, None, None], (xs - x0)[None, :, None]
    haut = px[y0][:, x0] * (1 - fx) + px[y0][:, x1] * fx
    bas = px[y1][:, x0] * (1 - fx) + px[y1][:, x1] * fx
    return haut * (1 - fy) + bas * fy


def bande(px, etrave, etambot, haut, bas, eau=None, metres=None):
    """La bande de `px` de la ligne `haut` à `bas`, la coque (de l'abscisse px `etrave` à `etambot`) ramenée à `LARGEUR`
    et décalée de `MARGE` ; stations, flottaison à la ligne `eau` et, si `metres`, une ligne par mètre au-dessus d'elle
    (la coque mesurant `metres` mètres)."""
    k = LARGEUR / abs(etambot - etrave)
    if etrave > etambot:
        px, etrave = px[:, ::-1], px.shape[1] - 1 - etrave
    gauche = round(etrave - MARGE / k)
    largeur = round((LARGEUR + 2 * MARGE) / k)
    plein = np.ones((bas - haut, largeur, 3), dtype=np.float32)
    a, b = max(gauche, 0), min(gauche + largeur, px.shape[1])
    plein[:, a - gauche:b - gauche] = px[haut:bas, a:b]
    sortie = mise_a_l_echelle(plein, k)
    for j in range(11):
        sortie[:, min(round(MARGE + j * LARGEUR / 10), sortie.shape[1] - 1)] = STATION
    if eau is not None:
        y = round((eau - haut) * k)
        if metres:
            pxm = LARGEUR / metres
            for m in range(1, int(y / pxm) + 1):
                sortie[max(y - round(m * pxm), 0), ::3] = METRE
        if 0 <= y < sortie.shape[0]:
            sortie[y] = EAU
    return sortie


def empiler(bandes, chemin):
    W = max(b.shape[1] for b in bandes)
    toile = np.ones((sum(b.shape[0] + ECART for b in bandes), W, 3), dtype=np.float32)
    y = 0
    for b in bandes:
        toile[y:y + b.shape[0], :b.shape[1]] = b
        y += b.shape[0] + ECART
    ecrire(toile, chemin)
    print("COTE A COTE", chemin, W, toile.shape[0])


def vues(D, P):
    """Les vues de `ILLUSTRATION` : (nom, recadrages dans l'illustration, pont, hauteur de coupe), le profil d'abord,
    puis les ponts de haut en bas."""
    I = D["ILLUSTRATION"]
    sortie = [("profil", (I["profil"],), None, None)]
    for z in sorted(I["ponts"], reverse=True):
        sol = min(P["hauteurs"][g] for (_, _, zz), g in P["cases"].items() if zz == z)
        sortie.append((f"pont-{z}", I["ponts"][z], z, None if z == P["ponts"] - 1 else sol + COUPE))
    return sortie


def couper(hauteur):
    """Les maillages de la scène coupés au plan horizontal `hauteur`, le dessus retiré."""
    for o in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
        o.data = o.data.copy()
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.transform(o.matrix_world)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, hauteur),
                               plane_no=(0, 0, 1), clear_outer=True)
        bm.transform(o.matrix_world.inverted())
        bm.to_mesh(o.data)
        bm.free()


class Cadre:
    """Le cadre orthographique d'une vue du GLB : la boîte du modèle entier élargie d'un mètre, `pxm` px par mètre, la
    proue à gauche si `a_gauche` ; de dessus, tribord en haut."""

    def __init__(self, lo, hi, pxm, a_gauche):
        self.lo, self.hi, self.pxm, self.a_gauche = lo, hi, pxm, a_gauche

    def colonne(self, y):
        return ((y - self.lo.y) if self.a_gauche else (self.hi.y - y)) * self.pxm

    def ligne(self, x):
        """La ligne px, de dessus, du point d'abscisse x."""
        return ((x - self.lo.x) if self.a_gauche else (self.hi.x - x)) * self.pxm

    def taille(self, vue):
        haut = self.hi.z - self.lo.z if vue == "profil" else self.hi.x - self.lo.x
        return round(haut * self.pxm), round((self.hi.y - self.lo.y) * self.pxm)


def rendus(glb, C, V, dossier):
    """Les rendus orthographiques du GLB pour chaque vue de `V` (`vues`), dans l'orientation de son illustration, et
    leur cadre : {nom: (png, cadre)}."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    graphe = bpy.context.evaluated_depsgraph_get()
    pts = np.array([tuple(o.matrix_world @ v.co) for o in bpy.context.scene.objects if o.type == "MESH"
                    for v in o.evaluated_get(graphe).data.vertices])
    lo, hi = Vector(pts.min(axis=0) - 1.0), Vector(pts.max(axis=0) + 1.0)
    pxm = LARGEUR / abs(C.y(1.0) - C.y(0.0))
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device, sc.cycles.samples, sc.cycles.use_denoising = "CPU", 16, False
    sc.render.resolution_percentage = 100
    sc.world = bpy.data.worlds.new("fond")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.85, 0.87, 0.9, 1)
    for rot in ((0.6, 0.2, 0.8), (0.9, -0.3, -2.4)):
        soleil = bpy.data.objects.new("soleil", bpy.data.lights.new("soleil", "SUN"))
        soleil.data.energy = 3.0
        soleil.rotation_euler = rot
        sc.collection.objects.link(soleil)
    camera = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    sc.collection.objects.link(camera)
    sc.camera = camera
    camera.data.type, camera.data.clip_end = "ORTHO", 500
    cy = (hi.y + lo.y) / 2
    sortie = {}
    for nom, recadrages, _, coupe in sorted(V, key=lambda v: -math.inf if v[3] is None else -v[3]):
        cadre = Cadre(lo, hi, pxm, recadrages[0]["etrave"] < recadrages[0]["etambot"])
        if coupe is not None:
            couper(coupe)
        if nom == "profil":
            cote = 1 if cadre.a_gauche else -1                          # depuis bâbord (+x), la proue (-y) à gauche
            camera.location = Vector((cote * (abs(lo.x) + abs(hi.x) + 50), cy, (hi.z + lo.z) / 2))
            camera.rotation_euler = (math.pi / 2, 0, cote * math.pi / 2)
        else:
            camera.location = Vector(((hi.x + lo.x) / 2, cy, hi.z + 50))
            camera.rotation_euler = (0, 0, math.pi / 2 if cadre.a_gauche else -math.pi / 2)
        ry, rx = cadre.taille(nom)
        sc.render.resolution_x, sc.render.resolution_y = rx, ry
        camera.data.ortho_scale = max(rx, ry) / pxm
        sc.render.filepath = str(dossier / f"{nom}.png")
        bpy.ops.render.render(write_still=True)
        sortie[nom] = (dossier / f"{nom}.png", cadre)
    return sortie


def plan(P, C, z, coupe, postes, cadre):
    """Le plan de jeu vu de dessus dans le cadre de la vue du pont `z` : la case la plus haute des ponts 0..z teinte
    selon sa hauteur ; l'arête de deux cases lue sur le plus haut de leurs ponts, comme le noyau, l'échelle sur le sien ;
    les postes d'arme entre le sol du pont et la coupe."""
    px = np.ones(cadre.taille("dessus") + (3,), dtype=np.float32)

    def peindre(x0, y0, x1, y1, couleur, bord=0):
        l0, l1 = sorted((cadre.ligne(x0), cadre.ligne(x1)))
        c0, c1 = sorted((cadre.colonne(y0), cadre.colonne(y1)))
        px[max(round(l0) - bord, 0):round(l1) + bord, max(round(c0) - bord, 0):round(c1) + bord] = couleur

    dessus = {}
    for (x, y, zz) in P["cases"]:
        if zz <= z:
            dessus[(x, y)] = max(dessus.get((x, y), zz), zz)
    hauteurs = [plan_de_jeu.hauteur(P, zz, x, y) for (x, y), zz in dessus.items()]
    h0, h1 = min(hauteurs), max(hauteurs)
    for ((x, y), zz), h in zip(dessus.items(), hauteurs):
        t = (h - h0) / (h1 - h0) if h1 > h0 else 0.0
        peindre(C.x_du_plan(y), C.y_du_plan(x), C.x_du_plan(y + 1), C.y_du_plan(x + 1), GRILLE)
        peindre(C.x_du_plan(y), C.y_du_plan(x), C.x_du_plan(y + 1), C.y_du_plan(x + 1),
                tuple(a + (b - a) * t for a, b in zip(BAS, HAUT)), -1)
    for s, x, y, zz, mot in P["aretes"]:
        vues_de = [dessus[v] for v in plan_de_jeu.voisines(s, x, y) if v in dessus]
        if mot in ARETES and vues_de and (zz == max(vues_de) or mot == plan_de_jeu.ECHELLE and zz in vues_de):
            if s == "t":
                peindre(C.x_du_plan(y), C.y_du_plan(x), C.x_du_plan(y + 1), C.y_du_plan(x), ARETES[mot], 2)
            else:
                peindre(C.x_du_plan(y), C.y_du_plan(x), C.x_du_plan(y), C.y_du_plan(x + 1), ARETES[mot], 2)
    sol = min(P["hauteurs"][g] for (_, _, zz), g in P["cases"].items() if zz == z)
    for bord, p in postes:
        if sol - 0.1 <= p.z and (coupe is None or p.z < coupe):
            peindre(p.x, p.y, p.x, p.y, POSTE, 7)
            q = p + navire.AXES[bord] * 0.4
            peindre(min(p.x, q.x), min(p.y, q.y), max(p.x, q.x), max(p.y, q.y), POSTE, 2)
    return px


def postes_du_manifeste(chemin):
    """Les postes d'arme du manifeste (tous les états de `selon` compris) : [(bord, point Blender)]."""
    M = json.loads(chemin.read_text(encoding="utf-8"))
    tables = [M.get("postes", {})] + [etat["postes"] for etat in M.get("selon", {}).values() if "postes" in etat]
    return [(bord, Vector((gx, -gz, gy))) for t in tables for bord, pts in t.items() for gx, gy, gz in pts]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("type")
    parser.add_argument("--glb", required=True, help="le GLB d'un dossier de production, son `<id>.element.json` voisin")
    parser.add_argument("--illustrations", required=True, help="le dossier du recueil où vit `ILLUSTRATION['fichier']`")
    parser.add_argument("--sortie", required=True, help="le dossier des PNG, hors du dépôt")
    args = parser.parse_args()
    sortie = Path(args.sortie).resolve()
    if habillage.DEPOT == sortie or habillage.DEPOT in sortie.parents:
        raise ValueError(f"{sortie} : images dans le dépôt {habillage.DEPOT}")
    sortie.mkdir(parents=True, exist_ok=True)
    glb = Path(args.glb).resolve()
    D = runpy.run_path(str(ICI / args.type / "donnees.py"))
    fiche = next(iter(c for e in runpy.run_path(str(ICI / args.type / "modele.py"))["elements"](D) for _, c in e["cles"]))
    P = plan_de_jeu.lire(fiche["definition"])
    C = navire.Coque(D, P)
    postes = postes_du_manifeste(glb.with_name(glb.stem + ".element.json"))
    illustration = image(Path(args.illustrations) / D["ILLUSTRATION"]["fichier"])
    longueur = abs(C.y(1.0) - C.y(0.0))
    V = vues(D, P)
    with tempfile.TemporaryDirectory() as dossier:
        calages = rendus(glb, C, V, Path(dossier))
        for nom, recadrages, z, coupe in V:
            png, cadre = calages[nom]
            etrave, etambot = round(cadre.colonne(C.y(0.0))), round(cadre.colonne(C.y(1.0)))
            rendu = image(png)
            if z is None:
                R = recadrages[0]
                eau = round(cadre.hi.z * cadre.pxm)
                bandes = [bande(illustration, R["etrave"], R["etambot"], R["haut"], R["bas"], R["eau"], longueur),
                          bande(rendu, etrave, etambot, 0, rendu.shape[0], eau, longueur)]
            else:
                bandes = [bande(illustration, R["etrave"], R["etambot"], R["haut"], R["bas"]) for R in recadrages]
                bandes += [bande(rendu, etrave, etambot, 0, rendu.shape[0]),
                           bande(plan(P, C, z, coupe, postes, cadre), etrave, etambot, 0, rendu.shape[0])]
            empiler(bandes, sortie / f"{nom}.png")


if __name__ == "__main__":
    main()
