"""Revue d'un véhicule (#2987) : ses configurations rendues comme l'hôte les monte (`postesMontes`,
`ameliorationsMontees`, `Combattant.monter_au_poste`, `Combattant.monter_l_amelioration`, `Combattant.cacher_selon`),
dans le studio de `rendu.py`. Les postes en vigueur sont ceux du manifeste, chaque bord que nomme
`selon.<amelioration>.postes` d'une Amélioration montée remplacé par les siens ; une pièce de poste à sa position, son +Z
vers son bord ; une pièce d'Amélioration à son ancrage, tournée comme le navire, ou, montée aux postes, à chaque poste de
son `selon`, `ouvert` devant une pièce, `ferme` sinon ; les nœuds `sans-<amelioration>` cachés quand elle est montée,
`avec-<amelioration>` quand elle ne l'est pas.

Chaque GLB s'habille comme le jeu l'habille, sans palette : chaque surface de son manifeste qui déclare une `matiere`
prend la texture de cette matière dans le catalogue (`<catalogue>/<matiere>.jpg`), en triplanaire dans le repère de
l'objet, un motif tous les 2 m ; une surface `blason` reçoit en couche de détail (UV « UVMap », le carré [0,1]²) un
emblème d'essai ; toute autre surface garde la couleur de son matériau.

Les configurations et les vues de l'intérieur sont la `REVUE` des données du modèle. Un GLB et son manifeste se
cherchent par id dans chaque dossier de `--modeles` : sortie de `construire.py` (`<id>/<id>.glb`,
`<id>/<id>.element.json`) ou destination d'import (`<id>.glb`, `<id>.manifeste.json`).

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/vehicule/revue.py <modele> --modeles <dossier>
        [--modeles <dossier>] --catalogue hotes/godot/projet/textures --sortie <dossier neuf> [--seules <noms>]
        [--gros-plans] [--seuls-gros-plans <noms>]
"""
import argparse
import json
import math
import runpy
import sys
import time
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent))

import rendu  # noqa: E402

LACETS = {"proue": 0.0, "tribord": -math.pi / 2, "poupe": math.pi, "babord": math.pi / 2}
TOUT = "tout"
METRES_PAR_MOTIF = 2.0           # `MiseEnPage.METRES_PAR_MOTIF` du monde Godot


def trouver(dossiers, id_):
    """Le GLB et le manifeste de `id_` dans le premier des `dossiers` qui les porte."""
    for d in dossiers:
        for glb, manifeste in ((d / id_ / f"{id_}.glb", d / id_ / f"{id_}.element.json"),
                               (d / f"{id_}.glb", d / f"{id_}.manifeste.json")):
            if glb.exists() and manifeste.exists():
                return glb, json.loads(manifeste.read_text(encoding="utf-8"))
    raise FileNotFoundError(f"{id_} : ni <id>/<id>.glb ni <id>.glb (avec son manifeste) sous {[str(d) for d in dossiers]}")


def en_vigueur(navire, ameliorations):
    """Les postes de chaque bord : ceux du manifeste, chaque bord que nomme une Amélioration montée remplacé par les siens."""
    postes = dict(navire["postes"])
    for am in ameliorations:
        postes.update(navire.get("selon", {}).get(am, {}).get("postes", {}))
    return postes


def caches(navire, ameliorations):
    """Les nœuds du navire à cacher selon ses Améliorations montées."""
    return [f"sans-{am}" if am in ameliorations else f"avec-{am}" for am in navire.get("selon", {})]


def blender(position):
    """Une position en mètres glTF dans le repère de Blender."""
    x, y, z = position
    return x, -z, y


def main():
    p = argparse.ArgumentParser()
    p.add_argument("modele", choices=sorted(d.parent.name for d in ICI.glob("*/donnees.py")))
    p.add_argument("--modeles", action="append", required=True, type=Path)
    p.add_argument("--catalogue", required=True, type=Path)
    p.add_argument("--sortie", required=True, type=Path)
    p.add_argument("--seules", default="")
    p.add_argument("--gros-plans", action="store_true")
    p.add_argument("--seuls-gros-plans", default="")
    args = p.parse_args()
    D = runpy.run_path(str(ICI / args.modele / "donnees.py"))
    if "REVUE" not in D:
        raise SystemExit(f"{args.modele} : aucune REVUE dans ses données ; son GLB seul se rend par rendu.py --input")
    revue = D["REVUE"]
    output = args.sortie.resolve()
    if output.exists() and any(output.iterdir()):
        raise ValueError(f"{output} : dossier de sortie neuf ou vide attendu")
    output.mkdir(parents=True, exist_ok=True)
    import bpy
    from mathutils import Vector
    glb_navire, navire = trouver(args.modeles, revue["vehicule"])
    glb_poste, poste = trouver(args.modeles, revue["aux_postes"])
    seules = set(filter(None, args.seules.split(",")))
    emblem = None

    def importer(glb, manifeste, position, lacet):
        avant = set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(glb.resolve(strict=True)))
        nouveaux = [o for o in bpy.context.scene.objects if o not in avant]
        surfaces = {s["nom"]: s for s in manifeste.get("surfaces", [])}
        vus = set()
        for o in nouveaux:
            if o.type != "MESH":
                continue
            for mat in o.data.materials:
                if mat and mat.name not in vus and mat.name.split(".")[0] in surfaces:
                    vus.add(mat.name)
                    habiller(bpy, mat, surfaces[mat.name.split(".")[0]], o.data.uv_layers[0].name if o.data.uv_layers else "",
                             emblem, args.catalogue)
        ancre = bpy.data.objects.new("ancre", None)
        bpy.context.scene.collection.objects.link(ancre)
        ancre.location = blender(position)
        ancre.rotation_euler = (0.0, 0.0, lacet)
        for o in nouveaux:
            if o.parent is None:
                o.parent = ancre
        return nouveaux

    def composer(armement, ameliorations):
        nonlocal emblem
        bpy.ops.wm.read_factory_settings(use_empty=True)
        emblem = embleme_d_essai(bpy)
        importer(glb_navire, navire, (0, 0, 0), 0.0)
        postes = en_vigueur(navire, ameliorations)
        arme = lambda bord, i: armement == TOUT or i in armement.get(bord, ())  # noqa: E731
        for bord, positions in postes.items():
            for i, pos in enumerate(positions):
                if arme(bord, i):
                    importer(glb_poste, poste, pos, LACETS[bord])
        for am in ameliorations:
            glb, manifeste = trouver(args.modeles, f"amelioration--{am}")
            if manifeste["montage"] == "postes":
                for bord, positions in navire["selon"][am]["postes"].items():
                    for i, pos in enumerate(positions):
                        objets = importer(glb, manifeste, pos, LACETS[bord])
                        montre = "ouvert" if postes[bord] is positions and arme(bord, i) else "ferme"
                        for o in objets:
                            if o.type == "MESH" and o.name.split(".")[0] in ("ouvert", "ferme"):
                                o.hide_render = o.name.split(".")[0] != montre
            else:
                for pos in navire["ancrages"][am]:
                    importer(glb, manifeste, pos, 0.0)
        for o in bpy.context.scene.objects:
            if o.name.split(".")[0] in caches(navire, ameliorations):
                o.hide_render = True

    for nom, titre, armement, ameliorations in revue["configurations"]:
        if seules and nom not in seules:
            continue
        composer(armement, ameliorations)
        visibles = [o for o in bpy.context.scene.objects if o.type == "MESH" and not o.hide_render]
        low, high = rendu.bornes(bpy, visibles)
        center = (low + high) / 2
        extent = max(high - low)
        vue = rendu.studio(bpy, low, center, extent, output, time.monotonic())
        vue(f"{nom}-face.png", (0.65, -1, 0.17), center, extent * 1.12, 1000, 720)
        vue(f"{nom}-dos.png", (-0.65, 1, 0.17), center, extent * 1.12, 1000, 720)
        (output / f"{nom}.txt").write_text(titre, encoding="utf-8")
    if args.gros_plans:
        seuls = set(filter(None, args.seuls_gros_plans.split(",")))
        for nom, fichier, oeil, vise, focale in revue["gros_plans"]:
            if seuls and fichier not in seuls:
                continue
            armement, ameliorations = next((c[2], c[3]) for c in revue["configurations"] if c[0] == nom)
            composer(armement, ameliorations)
            gros_plan(bpy, output, fichier, Vector(blender(oeil)), Vector(blender(vise)), focale)


def embleme_d_essai(bpy):
    """Emblème d'essai 256 px : écu parti azur et or bordé de sable, coins transparents (le cadre [0,1]² d'une surface
    `blason`, que `HORS_BLASON` du constructeur vise hors de l'écu)."""
    import numpy as np
    n = 256
    img = bpy.data.images.new("embleme-essai", n, n, alpha=True)
    u, v = np.meshgrid((np.arange(n) + 0.5) / n, (np.arange(n) + 0.5) / n)
    x, h = (u - 0.5) * 2, v
    dedans = (np.abs(x) < 0.82) & (h > 0.08) & ((h > 0.55) | (x ** 2 + ((0.55 - h) / 0.47) ** 2 * 0.67 < 0.67))
    dedans &= h < 0.92
    bord = dedans & ~((np.abs(x) < 0.72) & (h > 0.15) & (h < 0.86) & ((h > 0.55) | (x ** 2 + ((0.55 - h) / 0.40) ** 2 * 0.52 < 0.52)))
    px = np.zeros((n, n, 4))
    px[dedans] = (0.05, 0.12, 0.45, 1.0)
    px[dedans & (x > 0)] = (0.80, 0.60, 0.12, 1.0)
    px[bord] = (0.02, 0.02, 0.02, 1.0)
    img.pixels.foreach_set(px.ravel().astype(np.float32))
    return img


def habiller(bpy, mat, surface, couche_blason, emblem, catalogue):
    """La surface du manifeste comme le jeu l'habille : la texture de sa `matiere` du catalogue, en projection triplanaire
    dans le repère de l'objet (Box, fondu 0.2), un motif tous les `METRES_PAR_MOTIF`, sans teinte ; sans matière, la
    couleur de son matériau ; l'emblème d'essai en couche de détail (UV « UVMap ») si `blason`."""
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    base = bsdf.inputs["Base Color"]
    sortie = None
    if surface.get("matiere"):
        for lien in list(nt.links):
            if lien.to_socket == base:
                nt.links.remove(lien)
        coord = nt.nodes.new("ShaderNodeTexCoord")
        echelle = nt.nodes.new("ShaderNodeMapping")
        echelle.inputs["Scale"].default_value = (1 / METRES_PAR_MOTIF,) * 3
        nt.links.new(coord.outputs["Object"], echelle.inputs["Vector"])
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(str((catalogue / f"{surface['matiere']}.jpg").resolve(strict=True)), check_existing=True)
        tex.projection, tex.projection_blend = "BOX", 0.2
        nt.links.new(echelle.outputs["Vector"], tex.inputs["Vector"])
        sortie = tex.outputs["Color"]
    if surface.get("blason"):
        uv = nt.nodes.new("ShaderNodeUVMap")
        uv.uv_map = couche_blason
        det = nt.nodes.new("ShaderNodeTexImage")
        det.image, det.extension = emblem, "CLIP"
        nt.links.new(uv.outputs["UV"], det.inputs["Vector"])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        nt.links.new(det.outputs["Alpha"], mix.inputs["Factor"])
        a = next(s for s in mix.inputs if s.name == "A" and s.type == "RGBA")
        if sortie is not None:
            nt.links.new(sortie, a)
        else:
            a.default_value = base.default_value
        nt.links.new(det.outputs["Color"], next(s for s in mix.inputs if s.name == "B" and s.type == "RGBA"))
        sortie = next(s for s in mix.outputs if s.type == "RGBA")
    if sortie is not None:
        nt.links.new(sortie, base)


def gros_plan(bpy, output, fichier, oeil, vise, focale):
    """Vue en perspective de l'intérieur, de `oeil` vers `vise` (repère de Blender) : ciel, soleil, une lanterne entre
    l'œil et la visée et une ambiance à l'œil."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("Ciel")
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.55, 0.62, 0.70, 1)
    bg.inputs["Strength"].default_value = 1.2
    scene.world = world
    soleil = bpy.data.objects.new("soleil", bpy.data.lights.new("soleil", "SUN"))
    soleil.data.energy = 3.0
    soleil.rotation_euler = (math.radians(40), 0.0, math.radians(-60))
    scene.collection.objects.link(soleil)
    for nom, energie, couleur, lieu, rayon in (("lanterne", 450.0, (1.0, 0.93, 0.83), oeil + (vise - oeil) * 0.4, 0.15),
                                                ("ambiance", 90.0, (1.0, 1.0, 1.0), oeil, 0.6)):
        lampe = bpy.data.objects.new(nom, bpy.data.lights.new(nom, "POINT"))
        lampe.data.energy, lampe.data.color, lampe.data.shadow_soft_size = energie, couleur, rayon
        lampe.location = lieu
        scene.collection.objects.link(lampe)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.lens, cam.data.clip_start = focale, 0.05
    cam.location = oeil
    cam.rotation_euler = (vise - oeil).to_track_quat("-Z", "Y").to_euler()
    scene.render.resolution_x, scene.render.resolution_y = 1000, 640
    scene.render.filepath = str(output / f"{fichier}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", fichier, flush=True)


if __name__ == "__main__":
    main()
