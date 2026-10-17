import { describe, expect, it } from 'vitest';
import { mesurerProseInline } from '../../scripts/guards/lib/proseInline.mjs';
import { PROSE_INLINE_TOLEREE } from './schemas/grammaire/prose-inline';

/**
 * EN-TÊTE STRUCTURÉ de la garde (#1475).
 */
const GARDE = {
  question:
    'A — quels documents portent encore, en `desc`, de la prose recopiée d’un livre EXTRAIT, et combien de nœuds ? ' +
    'B — le stock NOMINATIF de ces types, ligne par ligne, avec son compte d’occurrences ' +
    '(`PROSE_INLINE_TOLEREE`, `src/data/schemas/grammaire/prose-inline.ts`). ' +
    'C — chaque ligne part avec le commit qui MIGRE sa famille vers l’adresse (`descRef`), campagne #1390 ; ' +
    'stock vide ⇒ le fichier disparaît et le verrou V3 de `grammaire/prose.ts` devient inconditionnel.',
  primitive:
    '`mesurerProseInline` (`scripts/guards/lib/proseInline.mjs`), la MÊME mesure que le CLI ' +
    '`node scripts/source/mesurer-prose-inline.mjs` avec lequel le stock se peuple : une seule sonde, ' +
    'jamais un chiffre recopié.',
  perimetre:
    'Les documents authorés des deux racines (les `.json` de `src/data`, les `-projet.json` de `src/scenes`), ' +
    'à TOUTE PROFONDEUR. MASQUE : « nœud portant un `desc` chaîne non vide dont la source EFFECTIVE — son ' +
    '`source.book` propre, sinon le `source.book` de l’ancêtre le plus proche qui en porte un — désigne un ' +
    'livre à `dir` dans `books.json`, `maison` ou pas » ; un nœud qui porte `adapteDe` coupe l’héritage. ' +
    'La CLÉ est le `type` du document racine, celle que ' +
    'le verrou V3 consulte.',
  angleMort: [
    'Le verrou V3 (`grammaire/prose.ts`) ne mord AU PARSE qu’aux sites qui composent la forme de prose — au Lot A, l’ENVELOPPE seule — et sur le seul `source.book` PROPRE du nœud. TOUT nœud AUTRE que l’entrée d’enveloppe est COMPTÉ ici sans être refusable, et ne le deviendra qu’avec le schéma qui composera `proseAdressable` (Lot C) : RANGÉES (`[].entries[]`, `phenomena[]`, `boardEvents[]`…), VARIANTES à source PROPRE (`[].variants[]`, 30 nœuds : spells 18, talents 12), source HÉRITÉE (43). Répartition mesurée le 2026-09-05 : 2 161 nœuds d’enveloppe-racine / 464 profonds. Ce contrat est la garantie, le refine est la commodité.',
    'La mesure ne juge PAS le texte : elle ne vérifie pas qu’un `desc` est bien un verbatim du livre qu’il cite. Un `desc` reformulé compte comme un verbatim (c’est la règle stricte 5 qui l’interdit, pas cette garde).',
    'Un livre sans `dir` dans `books.json` sort du périmètre : sa prose n’est pas adressable, donc pas migrable — une extraction ajoutée FAIT ENTRER ses entrées au stock, et c’est bien une dérive à traiter.',
    'LOT, DATE et MOTIF d’une ligne sont du PILOTAGE : la sonde ne les mesure pas, seul le COMPTE est confronté.',
  ],
  baseline: {
    fichier: 'src/data/schemas/grammaire/prose-inline.ts',
    decroissant: true,
    raison:
      'Le stock EST le dénominateur de la campagne d’adressage #1390 : chaque ligne se solde par la migration de ' +
      'sa famille, dans le MÊME commit. Une ligne neuve est une dérive (prose recopiée d’un livre extrait), jamais ' +
      'une exception à inscrire.',
  },
  ticket: '#1389 / #1390',
} as const;

const mesure = mesurerProseInline();
const observes = Object.keys(mesure).sort();
const declares = Object.keys(PROSE_INLINE_TOLEREE).sort();
const totalObserve = Object.values(mesure).reduce((n, v) => n + v.entrees, 0);
const totalDeclare = Object.values(PROSE_INLINE_TOLEREE).reduce((n, l) => n + l.entrees, 0);

describe(`prose inline recopiée d’un livre extrait — stock à cible ZÉRO (${GARDE.ticket})`, () => {
  it('imprime le TOTAL mesuré du jour — le dénominateur de la campagne', () => {
    console.log(
      `[prose-inline] ${totalObserve} nœuds sur ${observes.length} types — stock : ${totalDeclare} sur ${declares.length}.\n` +
        `[prose-inline] angles morts : ${GARDE.angleMort.length} · baseline ${GARDE.baseline.fichier} (décroissante).`,
    );
    expect(GARDE.baseline.decroissant).toBe(true);
  });

  it('(a) tout type OBSERVÉ a sa ligne au stock — une dérive neuve est nommée', () => {
    const neufs = observes
      .filter((t) => !(t in PROSE_INLINE_TOLEREE))
      .map((t) => `dérive neuve : ${t} ${mesure[t].entrees} — ex. ${mesure[t].noeuds[0]}`);
    expect(
      neufs,
      `Prose recopiée d’un livre EXTRAIT sur un type HORS stock — l’entrée doit l’ADRESSER (\`descRef\`), ` +
        `jamais s’inscrire ici :\n${neufs.join('\n')}`,
    ).toEqual([]);
  });

  it('(b) chaque ligne du stock porte EXACTEMENT son compte — hausse comme baisse', () => {
    const ecarts = declares
      .filter((t) => (mesure[t]?.entrees ?? 0) !== PROSE_INLINE_TOLEREE[t].entrees)
      .map((t) => `${t} : stock ${PROSE_INLINE_TOLEREE[t].entrees}, observé ${mesure[t]?.entrees ?? 0}`);
    expect(
      ecarts,
      `Compte de stock périmé — une prose inline AJOUTÉE se retire, une prose MIGRÉE recale sa ligne dans le ` +
        `commit qui la migre :\n${ecarts.join('\n')}`,
    ).toEqual([]);
  });

  it('(c) aucune ligne à 0 — une famille migrée perd sa ligne, elle ne la garde pas vide', () => {
    const vides = declares.filter((t) => PROSE_INLINE_TOLEREE[t].entrees <= 0).map((t) => `${t} : ${PROSE_INLINE_TOLEREE[t].entrees}`);
    expect(vides, `Ligne(s) à zéro — à RETIRER (le stock ne fait que décroître) :\n${vides.join('\n')}`).toEqual([]);
  });

  it('chaque ligne porte son PILOTAGE : lot, date, motif', () => {
    const nues = declares
      .filter((t) => {
        const l = PROSE_INLINE_TOLEREE[t];
        return !l.lot.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(l.date) || l.motif.trim().length < 10;
      })
      .map((t) => `${t} : lot « ${PROSE_INLINE_TOLEREE[t].lot} », date « ${PROSE_INLINE_TOLEREE[t].date} », motif « ${PROSE_INLINE_TOLEREE[t].motif} »`);
    expect(nues, `Ligne(s) sans pilotage lisible :\n${nues.join('\n')}`).toEqual([]);
  });
});
