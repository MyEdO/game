# Générateur de `src/data/progression-schemas.derived.json` — le SCHÉMA DE PROGRESSION
# (affectation marque -> Caractéristique, par niveau de Carrière) LU DANS LE PDF FR.
#
# Pourquoi ce générateur : la garde `src/data/refs-migrated.test.ts` ne contrôlait que la CARDINALITÉ
# (3/1/1/1) et la disjonction des `characteristics` d'un niveau — une PERMUTATION entre deux niveaux
# passait au vert (mesuré sur `tueur`, LDB folio 76, niveaux 3/4 intervertis). Le PDF n'étant pas
# rejouable en CI (pas de pdfminer dans la chaîne Node), l'ARTEFACT COMMITTÉ est la vérité dérivée ;
# la garde `scripts/guards/lib/progressionSchemas.mjs` le joint à `careerLevels.json`.
#
# Technique de lecture (mesurée, pas devinée), par le lecteur géométrique `scripts/raw/lib/pdf_geometrie.py` :
#   - le folio IMPRIMÉ se lit SUR la page (chiffres en police `DwarvenAxeBB`, pied de page) : jamais
#     un offset folio<->page PDF, qui n'est pas constant (piège vécu : « folio 116 » -> Villageois) ;
#   - le titre de Carrière est la ligne en `CaslonAntique-Bold` >= 17 pt (les intertitres sont en
#     `CaslonAntique-Bold-SC700`, taille 12,6/18 : exclus par le nom de police) ;
#   - niveau 1 = glyphes de la police `crossbatstfb` ; niveaux 2/3/4 = `LTRect` PLEINS distingués par
#     `non_stroking_color` : cuivre ~0.357 -> 2, argent ~0.815 -> 3, or ~0.000 -> 4 ;
#   - les 10 colonnes sont AUTO-CALIBRÉES sur la ligne d'en-tête « CC CT F E I Ag Dex Int FM Soc »
#     trouvée au-dessus de chaque bande — jamais une grille en dur (LDB 22,8 pt / VDM 21,1 pt).
#
# Toute anomalie (bande sans en-tête calibrable, page sans folio lisible, bande sans titre au-dessus,
# marque hors colonne) est un ÉCHEC EXPLICITE avec page/y/candidats — jamais un saut silencieux.
#
# OUTILLAGE MESURÉ : pdfminer.six 20251107. L'artefact est byte-stable À VERSION ÉGALE — un changement
# de version de pdfminer peut déplacer une abscisse au dixième près et faire diverger le md5 sans que
# la LECTURE (colonne, niveau, folio) change. `--check` compare donc l'octet : une divergence se lit
# comme « regénérer et relire le diff », pas comme une réfutation de la donnée.
#
# Usage :
#   python scripts/data/gen-progression-schemas.py               # tous les livres déclarés
#   python scripts/data/gen-progression-schemas.py --check       # n'écrit rien, exit 1 si divergent
#   python scripts/data/gen-progression-schemas.py --book livre-de-base --pages 55-120
#   python scripts/data/gen-progression-schemas.py --probe --book aux-armes   # sonde, n'écrit rien
import argparse
import io
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts", "raw", "lib"))
from pdf_geometrie import lire_pages, pdfs_de, police_de, printed_folio  # noqa: E402

OUT = os.path.join(ROOT, "src", "data", "progression-schemas.derived.json")

# Ordre des colonnes du schéma imprimé == ordre de `CHAR_KEYS` (`src/engine/types.ts:41`).
COLS = ["CC", "CT", "F", "E", "I", "Ag", "Dex", "Int", "FM", "Soc"]
CHAR_KEY = {
    "CC": "capacite-de-combat",
    "CT": "capacite-de-tir",
    "F": "force",
    "E": "endurance",
    "I": "initiative",
    "Ag": "agilite",
    "Dex": "dexterite",
    "Int": "intelligence",
    "FM": "force-mentale",
    "Soc": "sociabilite",
}

CAREERS = os.path.join(ROOT, "src", "data", "careers.json")


def livres_porteurs():
    """Ids STABLES des livres qui portent une Carrière (`source.book` de `src/data/careers.json`), triés."""
    with open(CAREERS, encoding="utf-8") as f:
        return sorted({c["source"]["book"] for c in json.load(f) if (c.get("source") or {}).get("book")})


# Nuanciers MESURÉS des marques de niveau, par livre — un `LTRect` est une marque s'il tombe à moins
# de `SWATCH_MAX` d'un de ces échantillons. Deux familles cohabitent : les livres qui impriment les
# trois marques en GRIS (LDB/VDM/ADE/Middenheim) et ceux qui les impriment en COULEUR (Aux Armes).
# Le seuil serré est ce qui écarte les fonds de rangée des tableaux (gris 0.917 LDB p.121, 0.928 MDG
# folio 63) : une borne large les prenait pour de l'argent.
SWATCHES = [
    (2, (0.357, 0.357, 0.357), "cuivre gris (LDB folio 76, VDM folio 38)"),
    (2, (0.346, 0.346, 0.346), "cuivre gris (ADE I folio 88)"),
    (2, (0.765, 0.515, 0.346), "cuivre couleur (Aux Armes folio 10)"),
    (3, (0.815, 0.815, 0.815), "argent gris (LDB folio 76)"),
    (3, (0.793, 0.793, 0.793), "argent gris (ADE I folio 88)"),
    (3, (0.779, 0.785, 0.793), "argent couleur (Aux Armes folio 10)"),
    (4, (0.0, 0.0, 0.0), "or noir (LDB folio 76)"),
    (4, (1.0, 0.889, 0.0), "or couleur (Aux Armes folio 10)"),
]
SWATCH_MAX = 0.06


def _rgb(nsc):
    v = [float(nsc)] if isinstance(nsc, (int, float)) else [float(x) for x in nsc]
    return tuple(v) if len(v) == 3 else (v[0], v[0], v[0])


def mark_level(nsc):
    """Niveau (2/3/4) d'un aplat, par sa couleur de remplissage ; None si l'aplat n'est pas une marque."""
    r, g, b = _rgb(nsc)
    best, level = SWATCH_MAX, None
    for lv, (sr, sg, sb), _ in SWATCHES:
        d = ((r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2) ** 0.5
        if d < best:
            best, level = d, lv
    return level


def jsonable(o):
    """Ramène les flottants ENTIERS à des entiers, récursivement.

    `JSON.stringify` écrit `0` là où `json.dump` écrit `0.0` : sans ce passage, le round-trip
    `serializeDataset` de `src/data/serialize.test.ts` échoue sur chaque teinte noire et chaque `y`
    tombé rond.
    """
    if isinstance(o, dict):
        return {k: jsonable(v) for k, v in o.items()}
    if isinstance(o, list):
        return [jsonable(v) for v in o]
    if isinstance(o, float) and o.is_integer():
        return int(o)
    return o


def teinte(nsc):
    """Couleur MESURÉE de l'aplat, telle qu'elle sera rapportée par la garde."""
    r, g, b = _rgb(nsc)
    return [round(r, 3), round(g, 3), round(b, 3)]


def column_centers(chars, ymax):
    """Centres des 10 colonnes, depuis la ligne d'en-tête la plus proche au-dessus de `ymax`."""
    lines = {}
    for c in chars:
        if c.y0 <= ymax or c.y0 > ymax + 40:
            continue
        lines.setdefault(round(c.y0, 0), []).append(c)
    for y in sorted(lines):
        cs = sorted(lines[y], key=lambda c: c.x0)
        s = "".join(c.get_text() for c in cs).replace(" ", "")
        # Comparaison en CAPITALES : Aux Armes compose l'en-tête en petites capitales, dont la couche
        # texte rend « ccctFeiagDexintFMSoc » (mesuré folio 78) — la casse n'y est pas une information.
        if not s.upper().startswith("CCCTFEIAGDEXINTFMSOC"):
            continue
        groups, cur = [], [cs[0]]
        for a, b in zip(cs, cs[1:]):
            if b.x0 - a.x1 > 2.0:
                groups.append(cur)
                cur = []
            cur.append(b)
        groups.append(cur)
        groups = [g for g in groups if "".join(x.get_text() for x in g).strip()]
        if len(groups) >= 10:
            groups = groups[:10]
            return [(g[0].x0 + g[-1].x1) / 2 for g in groups]
    return None


TITLE_MIN_SIZE = 12
TITLE_HEAD_SIZE = 17


def page_titles(chars):
    """Titres imprimés de la page : (y0, texte), du plus haut au plus bas.

    Deux compositions cohabitent dans le corpus FR : capitales pleines en `CaslonAntique-Bold` 19 pt
    (LDB « TUEUR », Aux Armes « ARCHER », MDG « ARTILLEUR DE NAVIRE ») et petites capitales
    `CaslonAntique-Bold-SC700` où l'initiale 18 pt et la suite 12,6 pt sont deux runs distincts
    (VDM « Hiérophante », ADE I « Chevaucheur de blaireau », Middenheim « Frère Loup »). D'où le
    regroupement par bande de y (tolérance 3 pt) avec tri des glyphes par x : la seconde compose
    « frèreloup », que le rapprochement de la garde normalise (casse/accents/espaces).

    Deux mesures écartent le bruit : le plancher `TITLE_MIN_SIZE` (la légende « SCHÉMA DE PROGRESSION
    DU CHANSONNIER » à 10 pt partage la bande de y du titre 19 pt, MDG folio 66 ; idem une italique
    de citation, ADE II folio 36) et la reprise des lignes de CONTINUATION (Aux Armes folio 32 compose
    « CHEVALIER DU » / « LOUP BLANC » sur deux lignes de même corps, 18 pt d'écart).
    """
    lines = {}
    for c in chars:
        fn = police_de(c)
        if not fn.startswith("CaslonAntique") or c.size < TITLE_MIN_SIZE:
            continue
        for y in lines:
            if abs(y - c.y0) <= 3.0:
                lines[y].append(c)
                break
        else:
            lines[c.y0] = [c]
    rows = []
    for y, cs in lines.items():
        if max(c.size for c in cs) < TITLE_HEAD_SIZE:
            continue
        s = "".join(x.get_text() for x in sorted(cs, key=lambda c: c.x0)).strip()
        if s:
            rows.append((y, " ".join(s.split()), max(c.size for c in cs)))
    rows.sort(key=lambda t: -t[0])
    out = []
    for y, s, size in rows:
        if out and abs(out[-1][2] - size) <= 1 and 0 < out[-1][0] - y <= 25:
            out[-1] = (out[-1][0], f"{out[-1][1]} {s}", out[-1][2])
        else:
            out.append((y, s, size))
    return [(y, s) for y, s, _ in out]


def cluster_bands(rects):
    """Regroupe les aplats en BANDES par y (tolérance 2 pt — l'arrondi seul coupait 389,49/389,51).

    Une bande de schéma porte au moins deux marques (niveaux 2/3/4, une chacun) : un aplat SEUL sur sa
    ligne n'est pas un schéma, c'est une puce (mesuré : 21 carrés noirs 17×17 en colonne sur la page
    de crédits de Middenheim). Ce filtre porte sur la GÉOMÉTRIE, pas sur le contenu : une bande à deux
    marques ou plus reste candidate, et son absence d'en-tête reste une ANOMALIE, jamais un saut.
    """
    bands = []
    for r in sorted(rects, key=lambda r: -r.y0):
        for b in bands:
            if abs(b[0] - r.y0) <= 2.0:
                b[1].append(r)
                break
        else:
            bands.append((r.y0, [r]))
    return [b for b in bands if len(b[1]) >= 2]


def read_book(book_id, pdf_path, pages, errors):
    schemas = []
    for page in lire_pages(pdf_path, pages if pages else None):
        pdfpage = page.numero  # 1-based, index PDF (diagnostic seulement)
        chars = page.chars
        rects = [
            o
            for o in page.rects
            if o.fill and 15 < o.width < 40 and 6 < o.height < 30 and mark_level(o.non_stroking_color)
        ]
        bands = cluster_bands(rects)
        if not bands:
            continue
        glyphs = [o for o in chars if "crossbat" in (o.fontname or "").lower() and o.get_text().strip()]
        folio = printed_folio(chars)
        titles = page_titles(chars)
        for y, rs in bands:
            top = y + max(r.height for r in rs) - 2
            centers = column_centers(chars, top)
            if centers is None:
                errors.append(f"{book_id} page PDF {pdfpage} y={y:.1f} : bande sans en-tête « CC CT F E I Ag Dex Int FM Soc » calibrable")
                continue
            if folio is None:
                errors.append(f"{book_id} page PDF {pdfpage} y={y:.1f} : folio imprimé illisible (pied de page)")
                continue
            # Le titre se dérive de la POSITION : le plus proche AU-DESSUS de la bande. Prendre le
            # titre de tête de page se trompe dès qu'une page en porte deux (VDM folio 188 imprime
            # « Familier de combat » et « Familier de sorts », deux bandes : la seconde héritait du
            # premier titre). Les intertitres (« Évolution de carrière ») sont imprimés SOUS la bande
            # dans les 7 livres mesurés, ils ne peuvent donc pas la coiffer.
            above = [t for t in titles if t[0] > y]
            if not titles:
                errors.append(
                    f"{book_id} page PDF {pdfpage} folio {folio} y={y:.1f} : bande sans aucun titre imprimé sur la page"
                )
                continue
            # `career: null` = la bande n'est coiffée par AUCUN titre de sa page. Cas mesuré : VDM
            # folio 188, la bande de tête de la COLONNE DE DROITE (y=753,1) appartient au bloc commencé
            # à la page précédente. Lui prêter le titre de la colonne de gauche serait une attribution
            # inventée ; la garde la traite comme une bande à rapprocher par les titres de la page,
            # et la RAPPORTE si rien ne la réclame.
            title = above[-1][1] if above else None

            def col_of(x):
                d = [abs(x - c) for c in centers]
                j = d.index(min(d))
                return COLS[j] if d[j] < 12 else None

            lv = {1: [], 2: [], 3: [], 4: []}
            for g in glyphs:
                if abs(g.y0 - y) >= 14:
                    continue
                c = col_of((g.x0 + g.x1) / 2)
                if c is None:
                    errors.append(f"{book_id} page PDF {pdfpage} folio {folio} « {title} » : marque de niveau 1 hors colonne (x={g.x0:.1f})")
                    continue
                lv[1].append({"col": c, "characteristic": CHAR_KEY[c], "x": round((g.x0 + g.x1) / 2, 1)})
            for r in rs:
                k = mark_level(r.non_stroking_color)
                c = col_of((r.x0 + r.x1) / 2)
                if c is None:
                    errors.append(f"{book_id} page PDF {pdfpage} folio {folio} « {title} » : aplat hors colonne (x={r.x0:.1f}, teinte {teinte(r.non_stroking_color)})")
                    continue
                lv[k].append({"col": c, "characteristic": CHAR_KEY[c], "x": round((r.x0 + r.x1) / 2, 1), "teinte": teinte(r.non_stroking_color)})
            for n in lv:
                lv[n] = sorted({m["col"]: m for m in lv[n]}.values(), key=lambda m: COLS.index(m["col"]))
            schemas.append(
                {
                    "book": book_id,
                    "page": folio,
                    "career": title,
                    "titresPage": [t[1] for t in titles],
                    "pdfpage": pdfpage,
                    "y": round(y, 1),
                    "lv": {str(n): lv[n] for n in sorted(lv)},
                }
            )
    return schemas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--book", action="append", help="id de livre (défaut : tous)")
    ap.add_argument("--pages", help="fenêtre de pages PDF 1-based, ex. 55-120")
    ap.add_argument("--probe", action="store_true", help="sonde : imprime, n'écrit pas l'artefact")
    ap.add_argument(
        "--check",
        action="store_true",
        help="régénère en mémoire et compare l'OCTET à l'artefact committé ; exit 1 si divergent",
    )
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()

    pages = None
    if args.pages:
        a, b = args.pages.split("-")
        pages = list(range(int(a) - 1, int(b)))

    books = [b for b in livres_porteurs() if not args.book or b in args.book]
    if not books:
        print("aucun livre sélectionné", file=sys.stderr)
        return 2

    errors = []
    schemas = []
    for b, path in zip(books, pdfs_de(books)):
        got = read_book(b, path, pages, errors)
        print(f"{b} : {len(got)} schémas", file=sys.stderr)
        schemas.extend(got)

    schemas.sort(key=lambda s: (s["book"], s["page"], -s["y"]))
    if args.probe:
        for s in schemas:
            print(s["book"], s["page"], s["career"], {k: [m["col"] for m in v] for k, v in s["lv"].items()})
        for e in errors:
            print("ANOMALIE:", e, file=sys.stderr)
        print(f"total {len(schemas)} schémas, {len(errors)} anomalies", file=sys.stderr)
        return 1 if errors else 0

    if errors:
        for e in errors:
            print("ANOMALIE:", e, file=sys.stderr)
        print(f"{len(errors)} anomalie(s) — artefact NON écrit", file=sys.stderr)
        return 1

    # ENVELOPPE de document (#1467 L1b) : `id`/`type`/`label` en tête, comme tout document authoré —
    # la fabrique `document()` les EXIGE au parse (`defs/progression-schemas-derived.ts`). Les deux
    # méta-clés de prose d'outillage (`__genere`/`__lecture`) ont quitté l'artefact : ce que le
    # générateur EST et comment il LIT se disent au JSDoc de ce def, pas dans la donnée.
    doc = {
        "id": "progression-schemas-derived",
        "type": "progression-schemas.derived",
        "label": "Schémas de progression (relevé dérivé)",
        "livres": books,
        "schemas": schemas,
    }
    # Forme canonique des datasets app-owned : `serializeDataset` (`src/data/serialize.ts`) =
    # `JSON.stringify(v, null, 2)`, SANS saut de ligne final. `src/data/serialize.test.ts` exige le
    # round-trip byte-identique sur TOUT `src/data/*.json` — un artefact généré n'y échappe pas.
    # `jsonable` ramène en plus les flottants entiers à des entiers : Python écrit `0.0` là où
    # `JSON.stringify` écrit `0`.
    texte = json.dumps(jsonable(doc), ensure_ascii=False, indent=2)

    if args.check:
        try:
            actuel = io.open(args.out, "r", encoding="utf-8", newline="").read()
        except FileNotFoundError:
            print(f"artefact ABSENT : {os.path.relpath(args.out, ROOT)}", file=sys.stderr)
            return 1
        if actuel != texte:
            print(
                f"{os.path.relpath(args.out, ROOT)} DIVERGE de la relecture des PDF "
                f"({len(actuel)} octets sur disque, {len(texte)} relus) — relancer le générateur et relire le diff.",
                file=sys.stderr,
            )
            return 1
        print(f"gen-progression-schemas --check — OK ({len(schemas)} schémas, artefact à jour)", file=sys.stderr)
        return 0

    with io.open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(texte)
    print(f"{len(schemas)} schémas -> {os.path.relpath(args.out, ROOT)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
