# -*- coding: utf-8 -*-
"""Extraction générique de références artistiques depuis un PDF source WFRP.

Script paramétré : PDF, dossier de sortie, seuils, mots-clés (plats ou
regroupés par créature). `art-ref/` reste GITIGNORÉ (binaires + droits
Cubicle 7) — seul ce script (sous `scripts/art-ref/`, tracké) survit à un
clone.

Prérequis : Python 3 + PyMuPDF (`pip install pymupdf`, module `fitz`).

Usage
-----
    python scripts/art-ref/extract.py --pdf <chemin PDF> --out <dossier> [options]

Options :
    --pdf PATH            chemin du PDF ; celui d'un livre vient de la CLI de la couture
                          `pdfDe` : "$(node scripts/raw/pdf-de.mjs <id du livre>)"
    --out PATH            dossier de sortie (relatif à la racine du repo, ou absolu)
    --mode {all,filter}   all = toute page rendue+extraite (défaut si ni --keywords
                          ni --targets) ; filter = ne traiter que les pages qui
                          matchent --keywords/--targets (défaut sinon)
    --keywords "a,b,c"    mots-clés plats (une page qui contient AU MOINS un mot
                          matche)
    --targets-json PATH   JSON {"id-créature": ["mot1", "mot2", ...], ...} — une
                          page peut matcher plusieurs cibles
    --min-px N            ignore les images embarquées plus petites que N px sur un
                          côté (défaut 120)
    --dpi N               résolution du rendu pleine page (défaut 150)
    --prefix STR          préfixe des fichiers de sortie (défaut "page")
    --sized-names         ajoute `_{w}x{h}` au nom des images embarquées (utile
                          pour repérer visuellement les plus grandes sans ouvrir
                          le fichier)
    --big-range A-B       en plus du scan normal, liste (stdout, pas de fichier) les
                          images embarquées >= --min-px sur les pages A..B (1-based)
    --pages A-B           ne scanne et n'extrait que les pages A..B (1-based, bornes
                          incluses) ; se combine avec --mode filter (intersection)
                          et --mode all ; borne hors du PDF = erreur
    --scan-only           n'extrait rien, imprime les pages qui matchent et, si
                          --big-range est demandé, son rapport

Exemples par livre
-------------------
  Zoo Impérial (créatures ciblées, ex. bestiaire en attente) :
    python scripts/art-ref/extract.py \
      --pdf "$(node scripts/raw/pdf-de.mjs zoo-imperial)" --out art-ref/zi \
      --targets-json art-ref/zi/targets.json

  Nuits agitées & dures journées (repérage de lieux, l'Opéra) :
    python scripts/art-ref/extract.py \
      --pdf "$(node scripts/raw/pdf-de.mjs nuits-agitees-et-dures-journees)" --out art-ref/opera \
      --keywords "staatsoper,loge royale,coursive,galerie,escaliers jumeaux,une nuit à l,auditorium,vestiaires,coulisses" \
      --min-px 200 --dpi 140 --prefix opera_p --sized-names

  L'Ennemi dans l'Ombre (scan investigatif + extraction intégrale) :
    python scripts/art-ref/extract.py \
      --pdf "$(node scripts/raw/pdf-de.mjs ennemi-dans-l-ombre)" --out art-ref \
      --mode all \
      --keywords "mutant,cratinx,knud,diligence,hache,tête de chien,tete de chien,massacre,sosie,chaos,créature,creature,sang sur la route,embuscade,renvers" \
      --big-range 22-32

  L'Ennemi dans l'Ombre, chapitres 1-2 (Folio 12+ à Folio 33+ exclu) :
    python scripts/art-ref/extract.py \
      --pdf "$(node scripts/raw/pdf-de.mjs ennemi-dans-l-ombre)" --out art-ref/edo-chapitres \
      --mode all --pages 12-32 --sized-names

  Scan seul, sans extraction (repérage rapide) :
    python scripts/art-ref/extract.py \
      --pdf "$(node scripts/raw/pdf-de.mjs ennemi-dans-l-ombre)" --out art-ref \
      --keywords "mutant,cratinx,cratinks,diligence,embuscade,sang sur la route,hache,tete de chien,tête de chien" \
      --scan-only
"""
import argparse
import json
import os
import unicodedata
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[2]


def norm(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower())
        if unicodedata.category(c) != "Mn"
    )


def resolve(path_str: str) -> Path:
    p = Path(path_str)
    return p if p.is_absolute() else (ROOT / p)


def plage(s: str):
    """Plage de pages `A-B` (1-based) -> (A, B)."""
    parts = s.split("-")
    if len(parts) != 2 or not all(p.strip().isdigit() for p in parts):
        raise argparse.ArgumentTypeError(f"plage attendue sous la forme A-B, reçu {s!r}")
    return int(parts[0]), int(parts[1])


def parse_args():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--mode", choices=["all", "filter"], default=None)
    ap.add_argument("--keywords", default=None, help="mots-clés plats séparés par des virgules")
    ap.add_argument("--targets-json", default=None, help="JSON {id: [mots-clés]}")
    ap.add_argument("--min-px", type=int, default=120)
    ap.add_argument("--dpi", type=int, default=150)
    ap.add_argument("--prefix", default="page")
    ap.add_argument("--sized-names", action="store_true")
    ap.add_argument("--big-range", type=plage, default=None, help="ex. 22-32 (pages 1-based)")
    ap.add_argument("--pages", type=plage, default=None, help="ex. 12-32 (pages 1-based, incluses)")
    ap.add_argument("--scan-only", action="store_true")
    return ap, ap.parse_args()


def load_targets(args):
    """Retourne (mode_effectif, {id_cible: [mots-clés normalisés]})."""
    targets = {}
    if args.targets_json:
        raw = json.loads(resolve(args.targets_json).read_text(encoding="utf-8"))
        for cid, kws in raw.items():
            targets[cid] = [norm(k) for k in kws]
    if args.keywords:
        kws = [norm(k.strip()) for k in args.keywords.split(",") if k.strip()]
        targets["_keywords"] = kws
    return targets


def extract_page_images(doc, pidx, out_dir, prefix, min_px, sized_names):
    """Extrait les images embarquées d'une page (dédupliquées par xref, normalisées RGB).
    Retourne la liste des (nom_fichier, w, h) écrits."""
    page = doc[pidx]
    p1 = pidx + 1
    written = []
    seen_xref = set()
    k = 0
    for img in page.get_images(full=True):
        xref = img[0]
        if xref in seen_xref:
            continue
        seen_xref.add(xref)
        try:
            base = doc.extract_image(xref)
        except Exception:
            continue
        w, h = base.get("width", 0), base.get("height", 0)
        if w < min_px or h < min_px:
            continue
        try:
            pix = fitz.Pixmap(doc, xref)
            if pix.n - pix.alpha >= 4:  # CMYK -> RGB
                pix = fitz.Pixmap(fitz.csRGB, pix)
            k += 1
            suffix = f"_{w}x{h}" if sized_names else ""
            fname = f"{prefix}{p1:03d}_img{k}{suffix}.png"
            pix.save(os.path.join(out_dir, fname))
            pix = None
            written.append((fname, w, h))
        except Exception:
            continue
    return written


def main():
    ap, args = parse_args()
    pdf_path = resolve(args.pdf)
    out_dir = resolve(args.out)

    targets = load_targets(args)
    mode = args.mode or ("filter" if targets else "all")

    doc = fitz.open(str(pdf_path))
    print(f"PDF: {pdf_path}")
    print(f"pages: {doc.page_count}")

    for option, borne in (("--pages", args.pages), ("--big-range", args.big_range)):
        if borne and (borne[0] < 1 or borne[0] > borne[1] or borne[1] > doc.page_count):
            ap.error(f"{option} {borne[0]}-{borne[1]} hors de 1-{doc.page_count} ou inversée")
    if args.pages:
        a, b = args.pages
        in_range = range(a - 1, b)
        print(f"plage: pages {a}-{b}")
    else:
        in_range = range(doc.page_count)
    out_dir.mkdir(parents=True, exist_ok=True)

    # ---- scan texte : quelles pages matchent quelle(s) cible(s) --------------
    page_hits = {}  # pidx -> set(cible_id)  ("_keywords" si liste plate)
    for pidx in in_range:
        txt = norm(doc[pidx].get_text("text"))
        for cid, kws in targets.items():
            if any(kw in txt for kw in kws):
                page_hits.setdefault(pidx, set()).add(cid)

    print("--- HITS ---")
    if targets:
        for cid, kws in targets.items():
            pages = sorted(p1 + 1 for p1, cids in page_hits.items() if cid in cids)
            print(f"  {cid}: {pages if pages else 'AUCUNE PAGE'}")
    else:
        print("  (aucun --keywords/--targets-json : mode 'all', pas de filtrage)")

    # ---- rapport debug optionnel : grosses images embarquées sur une plage -----
    if args.big_range:
        a, b = args.big_range
        print(f"--- BIG EMBEDDED IMAGES (pages {a}-{b}) ---")
        for pidx in range(a - 1, b):
            for img in doc[pidx].get_images(full=True):
                xref = img[0]
                try:
                    base = doc.extract_image(xref)
                except Exception:
                    continue
                w, h = base.get("width", 0), base.get("height", 0)
                if w >= args.min_px and h >= args.min_px:
                    print(f"page {pidx + 1}: xref {xref} {w}x{h}")

    if args.scan_only:
        print("--scan-only : pas d'extraction.")
        return

    # ---- extraction -----------------------------------------------------------
    pages_to_process = (
        sorted(page_hits.keys()) if mode == "filter" else list(in_range)
    )

    n_full = n_embedded = 0
    for pidx in pages_to_process:
        p1 = pidx + 1
        imgs = extract_page_images(doc, pidx, str(out_dir), args.prefix, args.min_px, args.sized_names)
        n_embedded += len(imgs)

        pix = doc[pidx].get_pixmap(dpi=args.dpi)
        pix.save(os.path.join(str(out_dir), f"{args.prefix}{p1:03d}_full.png"))
        pix = None
        n_full += 1

        cids = sorted(page_hits.get(pidx, []))
        tag = f" [{', '.join(cids)}]" if cids else ""
        print(f"  page {p1}{tag}: {len(imgs)} img(s) + full")

    print(f"EMBEDDED: {n_embedded}")
    print(f"FULL: {n_full}")
    print(f"DONE -> {out_dir}")


if __name__ == "__main__":
    main()
