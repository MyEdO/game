# Atlas RAW — cœur 5e

Le cœur de règles **WFRP 5e** de l'Atlas : les fiches de ce cœur vivent dans ce dossier, consolidées
depuis le livre de base qui le déclare (table à jour dans [`sources.md`](../sources.md)), à **usage
d'agent**. La **synthèse** d'une fiche est en français ; les **citations, termes et abréviations de
jeu** restent verbatim dans la langue du livre. Le routeur des cœurs est à
[`../00-index.md`](../00-index.md).

## Domaines

**1 domaine = 1 fiche `<clé>.md`** — la clé est l'id STABLE (c'est elle que nomme un lot du workflow
d'extraction), le titre est de l'affichage. Le [rapport des domaines](../atlas.generated.md#domaines-5e) est **GÉNÉRÉ** depuis
`scripts/raw/domaines.json` par `node scripts/raw/build-atlas-index.mjs` : un domaine de plus est une
entrée de ce registre, jamais une ligne écrite ici. Une aire **cadrée dont la fiche reste à extraire**
s'y rend sans lien, avec le ticket qui doit son extraction — garde
`scripts/raw/domaines.test.mjs`.

[Domaines de ce cœur](../atlas.generated.md#domaines-5e)
