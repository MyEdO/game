# BOÎTES et LIGNES de texte d'un PDF de livre (#1739), telles que pdfminer les LIT : l'analyse de mise
# en page (`LAParams`) est de la LECTURE et vit ici ; `scripts/raw/lib/colonnes.mjs` ne fait
# qu'ORDONNER les boîtes, pour la sonde `scripts/raw/sonde-titres.mjs`.
# `LAParams(all_texts=True)` : les réglages par défaut de pdfminer (ceux de `lire_pages`), plus
# l'analyse du texte posé dans des figures — les encadrés du CRB en sont (sans lui, leurs caractères
# restent hors de toute boîte).
# Écrit en UTF-8 dans un FICHIER (jamais stdout : la console Windows est cp1252) :
#   [{ "page", "largeur", "boites": [{ "x0", "y0", "x1", "y1",
#      "lignes": [{ "x0", "y0", "x1", "y1", "texte", "spans": [[texte, police, taille]…] }] }],
#      "cercles": [{ "x0", "y0", "x1", "y1" }] }]
# `cercles` : les courbes TRACÉES (contour) d'emprise carrée à 1 pt près, de 8 à 25 pt — la pastille
# d'un appel de figure, que la sonde des titres lit.
# Une boîte dont le centre sort de la page (la page en regard) n'est pas rendue.
# Usage : python scripts/raw/lib/pdf-lignes.py <id du livre> <sortie.json>
import json
import os
import sys

from pdfminer.high_level import extract_pages
from pdfminer.layout import LAParams, LTChar, LTContainer, LTCurve, LTTextBoxHorizontal, LTTextLineHorizontal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_geometrie import pdfs_de, police_de  # noqa: E402

LAPARAMS = LAParams(all_texts=True)


def boites_de(o):
    if isinstance(o, LTTextBoxHorizontal):
        yield o
    elif isinstance(o, LTContainer):
        for c in o:
            yield from boites_de(c)


def cercles_de(o):
    """Courbes tracées d'emprise carrée (1 pt près), de 8 à 25 pt."""
    if isinstance(o, LTCurve):
        if o.stroke and 8 < o.width < 25 and abs(o.width - o.height) < 1:
            yield o
    elif isinstance(o, LTContainer):
        for c in o:
            yield from cercles_de(c)


def spans_de(ligne):
    """Suites de caractères de même police et même corps, blancs (`LTAnno` compris) accrochés au span
    qu'ils suivent."""
    out = []
    for c in ligne:
        if isinstance(c, LTChar) and c.get_text().strip():
            cle = (police_de(c), round(c.size, 1))
            if not out or (out[-1][1], out[-1][2]) != cle:
                out.append([c.get_text(), cle[0], cle[1]])
                continue
        if out:
            out[-1][0] += c.get_text()
    return [[t.strip(), p, s] for t, p, s in out]


def bb(o):
    return {"x0": round(o.x0, 2), "y0": round(o.y0, 2), "x1": round(o.x1, 2), "y1": round(o.y1, 2)}


def main():
    id_, sortie = sys.argv[1], sys.argv[2]
    out = []
    for n, page in enumerate(extract_pages(pdfs_de([id_])[0], laparams=LAPARAMS), 1):
        boites = []
        for b in boites_de(page):
            if not 0 <= (b.x0 + b.x1) / 2 <= page.width:
                continue
            lignes = [
                {**bb(l), "texte": l.get_text().strip(), "spans": spans_de(l)}
                for l in b
                if isinstance(l, LTTextLineHorizontal) and l.get_text().strip()
            ]
            if lignes:
                boites.append({**bb(b), "lignes": lignes})
        out.append({"page": n, "largeur": round(page.width, 2), "boites": boites, "cercles": [bb(c) for c in cercles_de(page)]})
    with open(sortie, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
