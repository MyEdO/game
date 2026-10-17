#!/bin/sh
# SONDE (dépôt JETABLE, lecture seule sur l'arbre) — les mesures d'HISTOIRE de `test:hooks`
# survivent-elles au clone SUPERFICIEL que produit `actions/checkout` sans `fetch-depth` ?
# Deux d'entre elles lisent l'histoire : le cas fondateur « corrigé par 4d6e1ff78 » du solde #584
# (scripts/git-hooks/porte-du-commit.test.mjs) et le cliquet des fermetures sans solde
# (scripts/hooks/fermetures-sans-solde.test.mjs). On reproduit ce que le runner obtient.
# Un test ne clone pas : cette vérification vit ici, la CI porte `fetch-depth: 0` et les deux tests
# refusent NOMMÉMENT un dépôt superficiel.
# Usage : sh scripts/ops/sondes/audit-2026-09-01/sonde-clone-superficiel.sh [chemin-du-depot]
set -e
SRC=${1:-$(git rev-parse --show-toplevel)}
BASE=$(mktemp -d); C="$BASE/superficiel"
git clone --depth 1 --quiet "file://$SRC/.git" "$C" 2>/dev/null
cd "$C"
echo "commits présents dans le clone depth-1 : $(git rev-list --count HEAD)"
echo "rev-parse --is-shallow-repository       : $(git rev-parse --is-shallow-repository)"
echo ""
echo "--- le commit fondateur 4d6e1ff78 (solde #584) existe-t-il ?"
if git cat-file -e 4d6e1ff78^{commit} 2>/dev/null; then echo "  OBJET PRÉSENT"; else echo "  OBJET ABSENT du clone"; fi
printf '  merge-base --is-ancestor 4d6e1ff78 HEAD : '
if git merge-base --is-ancestor 4d6e1ff78 HEAD 2>/dev/null; then echo "true"; else echo "faux/erreur"; fi
echo ""
echo "--- mesure de fermetures-sans-solde.test.mjs"
echo "  soldes SUIVIS (git ls-files) : $(git ls-files .claude/soldes | wc -l)  (l'index survit au clone superficiel)"
FERM=$(git log --since=2026-08-01 --pretty=format:%B | grep -Eio '(fixes|closes|corrige|ferme)[[:space:]]+#[0-9]+' | grep -Eo '[0-9]+' | sort -un | wc -l)
echo "  tickets fermés VUS par git log --since=2026-08-01 : $FERM"
echo ""
echo "=> sur un tel clone, les deux tests s'ARRÊTENT en nommant \`fetch-depth: 0\` (jamais un vert muet)."
cd /; rm -rf "$BASE"
