import { metaDesChamps, nommerNoeud } from '../grammaire/meta';
/** LDB 04 l.93-101 ; NADJ 14 l.66-75 ; ADE II 02 l.112-121 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couvertureDuDeParDocument, plageSchema, raceKeySchema } from '../grammaire/valeurs';
import type { DiceSpec } from '../../../engine/dice';
import { raffinementDeCatalogue, ref, refMorte } from '../grammaire/ref';
import type { DatasetDe } from '../datasets';
import { valeurConforme, type FormeDeControle } from '../grammaire/formeDeControle';

export const file = 'especes-aleatoires.json';
export const famille = 'entite';

const plage = metaDesChamps(plageSchema, { exigees: true });

/** Une rangée du tableau : la référence de l'espèce nominale de sa race, à sa fourchette. */
export const rangee = ref('species', {
  min: nommerNoeud(z.number(), { nom: plage.min.label }),
  max: nommerNoeud(z.number(), { nom: plage.max.label }),
});

type Document = { id: string; die: DiceSpec; entries: z.output<typeof rangee>[] };

type Race = z.output<typeof raceKeySchema>;
type Especes = DatasetDe<typeof import('./species')>;
type Regles = DatasetDe<typeof import('./reglesOptionnelles')>;

const cleDuJeu = (races: Iterable<Race>): string => [...races].sort().join(', ');

function ouverturesDeLaRegle(regle: FormeDeControle): readonly boolean[] {
  switch (regle.kind) {
    case 'flag': return [false, true];
    case 'mode': return regle.options.map(Boolean);
    case 'param': return [regle.min, 0, regle.max].filter((valeur) => valeurConforme(regle, valeur)).map(Boolean);
  }
}

function jeuxDeRacesAtteignables(especes: Especes, regles: Regles, ctx: z.RefinementCtx): Iterable<string> {
  const racesSansCondition = new Set<Race>();
  const racesParRegle = new Map<string, Set<Race>>();
  for (const { refChar, gatedByRule } of especes) {
    if (gatedByRule === undefined) {
      racesSansCondition.add(refChar);
    } else {
      const races = racesParRegle.get(gatedByRule.id) ?? new Set<Race>();
      races.add(refChar);
      racesParRegle.set(gatedByRule.id, races);
    }
  }

  const reglesParId = new Map<string, FormeDeControle>(regles.map((regle) => [regle.id, regle]));
  let jeux = new Map([[cleDuJeu(racesSansCondition), racesSansCondition]]);
  for (const [id, races] of racesParRegle) {
    const regle = reglesParId.get(id);
    if (regle === undefined) {
      ctx.addIssue({ code: 'custom', message: refMorte('regleOptionnelle', id) });
      continue;
    }
    const ouvertures = ouverturesDeLaRegle(regle);
    const suivants = ouvertures.includes(false) ? new Map(jeux) : new Map<string, Set<Race>>();
    if (ouvertures.includes(true)) {
      for (const jeu of jeux.values()) {
        const union = new Set([...jeu, ...races]);
        suivants.set(cleDuJeu(union), union);
      }
    }
    jeux = suivants;
  }
  return jeux.keys();
}

const verifierLesJeuxDeRaces = raffinementDeCatalogue((lire) => {
  const { idsDeLaSousListe } = lire.catalogue('species');
  const cat = lire.catalogueLu('species', 'regleOptionnelle');
  return (v, ctx) => {
    const racesParEspece = new Map<string, Race>();
    for (const race of raceKeySchema.options)
      for (const id of idsDeLaSousListe(race)) racesParEspece.set(id, race);

    const premiers = new Map<string, string>();
    for (const [i, d] of (v as Document[]).entries()) {
      const races = new Set<Race>();
      for (const [j, { id }] of d.entries.entries()) {
        const race = racesParEspece.get(id);
        if (race === undefined) continue;
        if (races.has(race))
          ctx.addIssue({ code: 'custom', path: [i, 'entries', j, 'id'], message: `${file} › ${d.id} : plusieurs rangées pour la race « ${race} ».` });
        races.add(race);
      }
      const cle = cleDuJeu(races);
      const premier = premiers.get(cle);
      if (premier === undefined) premiers.set(cle, d.id);
      else ctx.addIssue({ code: 'custom', path: [i, 'entries'], message: `${file} › ${d.id} : le jeu de races « ${cle} » est déjà celui du document « ${premier} » : un seul document par jeu de races.` });
    }
    for (const jeu of jeuxDeRacesAtteignables(cat()['species.json'], cat()['reglesOptionnelles.json'], ctx))
      if (!premiers.has(jeu)) ctx.addIssue({ code: 'custom', message: `${file} : aucun document pour le jeu de races « ${jeu} ».` });
  };
});

const doc = document(
  'especes-aleatoires',
  famille,
  {},
  {},
  {
    codex: { keys: ['especesAleatoires'] },
    edit: { dataset: 'especesAleatoires' },
  },
  {
    rangee,
    deDeTirage: true,
    /** `tableDesRacesAleatoires` (`src/data/index.ts`) */
    affinerDataset: (dataset) =>
      couvertureDuDeParDocument<Document>(file, (r) => `la rangée ${r.min}-${r.max} (${r.id})`)(dataset).check(verifierLesJeuxDeRaces),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
