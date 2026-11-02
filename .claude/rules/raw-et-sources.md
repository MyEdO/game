---
paths:
  - "Source/**/*.md"
  - "docs/raw/**"
  - "scripts/raw/**"
  - "scripts/source/**"
  - "src/data/raw.manifest.json"
---

# RAW, Source/ et Atlas

- Quand un livre B glose une règle que le livre A définit (Trait, Talent, chute, calcul), applique la définition de A sans cérémonie et cite les deux verbatims ; une glose dont la réf ne pointe pas l'entrée de A est présumée fautive. La cérémonie reste pour une règle propre à B, une lecture ambiguë de A ou un silence du RAW. Vérifie le code avant de déclarer une dette. #700 `docs/raw/4e/combat.md:6233`
- Avant de citer une table de statbloc, vérifie qu'elle suit l'ordre de sa section (Compétences → Talents → Traits) et ne duplique pas la section voisine. Sinon, ou sur une contradiction interne, ouvre le PDF à la page (Read natif `pages`, ou `scripts/raw/lib/pdf-extract.py`) et cite PDF + ligne.
- Un artefact d'extraction (table dupliquée, fichier coupé, espace de coupure d'italique) se corrige DANS `Source/*.md` : vérifie au folio imprimé (`npm run raw:check-folio-continuity`), ré-ancre par `npm run raw:reanchor -- --apply` (jamais à la main), puis retire les contournements posés en aval (donnée, convention de réf, classement de garde), et corrige dans le même geste tout doc porteur du faux. `scripts/raw/reanchor.mjs:6-7`
- Toute lecture Markdown passe par `readText` (`scripts/raw/_lib.mjs:39`), qui normalise les fins de ligne : un parseur ancré en fin de ligne lit un fichier CRLF comme une seule section, sans erreur.
- Le doc communautaire « Fourth to Fifth Edition (rev 3) » (`https://drive.google.com/uc?export=download&id=1JG09TQJ06C7SycW5dWYFTbe66Ypfoq6Z`) est une CARTE du delta 4e→5e (#1818), jamais une source citable : re-vérifie chaque écart au `Source/` (son §11 contredit LDB 16 l.13). Il sert pour ses §19-20 (reprises d'AA et de VDM) et ses errata candidats. Ses réfs sont en pages LIVRE (folio imprimé), pas en index PDF ; il se lit par `scripts/raw/lib/pdf-extract.py` (index pypdf 0-based). Il n'a pas comparé sorts, talents, miracles ni bestiaire ligne à ligne : son silence sur ces domaines ne prouve aucune absence d'écart.
