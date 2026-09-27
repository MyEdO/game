// Ancre de page folioée et ancre de page VIDE : la page qu'elle ouvre n'a aucun texte au `.md`
// (planche, intercalaire, page dont le texte est ailleurs). SOURCE UNIQUE du motif `data-folio`, du
// prédicat `ancreVide` et du folio ROULANT par ligne (`foliosRoulants`). Lecteurs : la découpe
// (`decoupe.ts`, motif, prédicat et folio roulant), la sonde des titres (`scripts/raw/sonde-titres.mjs`, motif et
// folio roulant) et les ancres de `scripts/guards/lib/folioLineAlign.mjs` (motif).
//
// Module FEUILLE (zéro import), PUR, chargé tel quel par Node nu et par vitest.

const ATTR = 'data-folio="(-?\\d+)"';

/** Attribut de folio `data-folio="N"` (N signé : `-1` existe) : `m[1]` = le folio. */
export const FOLIO_ATTR = new RegExp(ATTR, 'g');

/** Ancre de page folioée `<span … data-folio="N" …></span>` : `m[1]` = le folio. */
export const ANCRE_FOLIO = new RegExp(`<span[^>]*${ATTR}[^>]*>\\s*</span>`, 'g');

const ANCRE_SUIVANTE = new RegExp(`<span[^>]*${ATTR}`, 'g');
const SPAN_VIDE = /<span[^>]*>\s*<\/span>/g;
// `\s` couvre insécables et BOM en JS ; la largeur nulle U+200B, non.
const BLANC = String.raw`[\s\u200B]`;
const BLANCS = new RegExp(`${BLANC}+`, 'g');
/** Tête d'une ligne SANS texte : blancs et `<span>` vides. */
const TETE_SANS_TEXTE = new RegExp(String.raw`^(?:${BLANC}|<span[^>]*>\s*<\/span>)*`);

const sansTexte = (entre: string): boolean => entre.replace(SPAN_VIDE, '').replace(BLANCS, '') === '';

/** Début de l'ancre folioée suivante à partir de `fin`, ou la fin du texte. */
function suivante(texte: string, fin: number): number {
  const re = new RegExp(ANCRE_SUIVANTE.source, 'g');
  re.lastIndex = fin;
  return re.exec(texte)?.index ?? texte.length;
}

/**
 * L'ancre qui finit à l'index `fin` de `texte` est-elle VIDE ? Rien d'autre que des blancs et des
 * `<span>` vides entre elle et l'ancre folioée suivante, ou la FIN du texte. PURE.
 */
export function ancreVide(texte: string, fin: number): boolean {
  return sansTexte(texte.slice(fin, suivante(texte, fin)));
}

/**
 * Folio ROULANT de chaque ligne, en une passe : la dernière ancre NON vide (`ancreVide`) qui précède
 * le TEXTE de la ligne. RÈGLE : une ancre vaut pour la ligne dont seuls des blancs et des `<span>`
 * vides la précèdent (en tête, ou ligne sans texte) ; posée APRÈS du texte — le `#` d'un titre et la
 * puce d'une liste en sont —, elle vaut à partir de la ligne suivante. `null` avant la première ancre
 * non vide. PURE.
 */
export function foliosRoulants(lignes: string[]): (number | null)[] {
  const texte = lignes.join('\n');
  const debuts = [...texte.matchAll(ANCRE_SUIVANTE)].map((m) => m.index);
  const pleines: { fin: number; folio: number }[] = [];
  let k = 0;
  for (const m of texte.matchAll(ANCRE_FOLIO)) {
    const fin = m.index + m[0].length;
    while (k < debuts.length && debuts[k] < fin) k++;
    if (!sansTexte(texte.slice(fin, debuts[k] ?? texte.length))) pleines.push({ fin, folio: Number(m[1]) });
  }
  const out: (number | null)[] = [];
  let debutLigne = 0;
  let a = 0;
  let folio: number | null = null;
  for (const ligne of lignes) {
    const texteA = debutLigne + TETE_SANS_TEXTE.exec(ligne)![0].length;
    while (a < pleines.length && pleines[a].fin <= texteA) folio = pleines[a++].folio;
    out.push(folio);
    debutLigne += ligne.length + 1;
  }
  return out;
}
