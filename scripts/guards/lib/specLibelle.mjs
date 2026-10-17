/**
 * SPÉCIALISATION écrite en LIBELLÉ : un littéral objet qui désigne une Compétence ou un Talent par son
 * id (`id`, `talentId`, `skill`, `skillId`) et porte une `spec` égale au LIBELLÉ d'une spécialisation de
 * son catalogue au lieu de son id (`{ id: 'metier', spec: 'Cartographe' }` pour `cartographe`). Toute
 * logique est keyée par id stable : une telle fixture ne désigne pas la spécialisation qu'elle nomme, et
 * un test qui la lit passe par accident (#1595, JS §3).
 *
 * Catalogue : `Map<id, { id, label }[]>` INJECTÉ par l'appelant depuis la donnée (`skills.json`,
 * `talents.json`) — la garde ne redéclare aucun vocabulaire.
 *
 * ANGLE MORT : une `spec` ou un id CALCULÉS (variable, appel) ne sont pas lus ; une spécialisation hors
 * catalogue (texte libre toléré) n'est pas de cette classe.
 */
import { analyserCorpus, typescript } from './dialecte.mjs';

const CLES_ID = new Set(['id', 'talentId', 'skill', 'skillId']);

/** Valeur littérale (chaîne) d'une propriété `nom` d'un littéral objet, sinon `undefined`. */
function litteral(objet, cles, sf) {
  const ts = typescript();
  for (const p of objet.properties) {
    if (!ts.isPropertyAssignment(p) || !cles.has(p.name.getText(sf))) continue;
    const v = p.initializer;
    if (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) return v.text;
  }
  return undefined;
}

/**
 * Sites `{ rel, ligne, id, spec, specId }` des fichiers `{ rel, text }` dont un littéral objet porte une
 * spécialisation en LIBELLÉ.
 * @param {{ rel: string, text: string }[]} fichiers
 * @param {Map<string, { id: string, label: string }[]>} catalogue
 */
export function sitesSpecLibelle(fichiers, catalogue) {
  const ts = typescript();
  const sites = [];
  for (const { fichier, sourceFile: sf } of analyserCorpus(fichiers)) {
    if (!sf) continue;
    const visite = (n) => {
      if (ts.isObjectLiteralExpression(n)) {
        const spec = litteral(n, new Set(['spec']), sf);
        const id = spec === undefined ? undefined : litteral(n, CLES_ID, sf);
        const specs = id === undefined ? undefined : catalogue.get(id);
        if (specs && !specs.some((s) => s.id === spec)) {
          const lu = specs.find((s) => s.label === spec);
          if (lu) sites.push({ rel: fichier.rel, ligne: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, id, spec, specId: lu.id });
        }
      }
      n.forEachChild(visite);
    };
    visite(sf);
  }
  return sites;
}
