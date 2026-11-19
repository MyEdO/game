import { nommerChamps } from './meta';
/**
 * SPÉCIAL d'un jeu de taverne (`tavernGames.json › specials[]`, `defs/tavernGames.ts`) : le nœud que le concept
 * du lexique des structures porte (`interne/poses.ts`, #3012). NADJ 16 l.82.
 */
import { z } from 'zod';
import { enumNomme, sourceRefSchema } from './valeurs';
import { facilitationSchema, jetSchema } from './mecanique';

/** Le paramètre que chaque effet de Spécial exige — et lui seul. */
const PARAMETRE_DE_L_EFFET = { cran: 'steps', difficulte: 'difficulty' } as const;

/** Les effets d'un Spécial, et leurs libellés. */
const EFFETS_DE_SPECIAL = { cran: 'Décalage de Difficulté (crans)', difficulte: 'Difficulté imposée' } as const;

/** Les libellés des champs d'un Spécial — ceux de l'éditeur ET des refus du schéma. */
const META_DE_SPECIAL = {
  effet: { label: 'Effet' },
  hasTalent: { label: 'Talent' },
  steps: { label: 'Crans (plus facile si positif)' },
  difficulty: { label: 'Difficulté imposée' },
  source: { label: 'Source' },
} as const;

const specialAPlat = z.strictObject({
  effet: enumNomme(EFFETS_DE_SPECIAL),
  ...facilitationSchema.pick({ hasTalent: true, steps: true }).shape,
  ...jetSchema.pick({ difficulty: true }).shape,
  source: sourceRefSchema,
});
type SpecialAPlat = z.output<typeof specialAPlat>;

/** Le Spécial tel que le parse le rend : le Talent posé, et le seul paramètre de son effet (`PARAMETRE_DE_L_EFFET`). */
type FormeDeSpecial = SpecialAPlat & { hasTalent: NonNullable<SpecialAPlat['hasTalent']> } & (
  | { effet: 'cran'; steps: NonNullable<SpecialAPlat['steps']>; difficulty?: undefined }
  | { effet: 'difficulte'; difficulty: NonNullable<SpecialAPlat['difficulty']>; steps?: undefined }
);

/** Le prédicat qui resserre la sortie du Spécial à sa forme (`FormeDeSpecial`), joué sur un Spécial sans faute, dont le
 *  `superRefine` a vérifié la forme. */
function estUneFormeDeSpecial(v: SpecialAPlat): v is FormeDeSpecial {
  return v.hasTalent !== undefined && v[PARAMETRE_DE_L_EFFET[v.effet]] !== undefined;
}

/** NADJ 16 l.82 ; le Talent et les crans sont ceux de la facilitation d'un jet (`facilitationSchema`),
 *  la Difficulté posée celle du jet (`jetSchema`). */
export const specialSchema = nommerChamps(specialAPlat.superRefine((v, ctx) => {
  const champ = (cle: keyof typeof META_DE_SPECIAL) => META_DE_SPECIAL[cle].label;
  const effet = (e: keyof typeof EFFETS_DE_SPECIAL) => EFFETS_DE_SPECIAL[e];
  if (v.hasTalent === undefined) ctx.addIssue({ code: 'custom', path: ['hasTalent'], message: `Spécial : « ${champ('hasTalent')} » est requis.` });
  if (v.effet === 'cran' && v.steps === 0) ctx.addIssue({ code: 'custom', path: ['steps'], message: `Spécial « ${effet('cran')} » : « ${champ('steps')} » à 0 ne décale rien.` });
  for (const [e, cle] of Object.entries(PARAMETRE_DE_L_EFFET) as [keyof typeof EFFETS_DE_SPECIAL, keyof typeof META_DE_SPECIAL][]) {
    const pose = v[cle] !== undefined;
    if (e === v.effet && !pose) {
      ctx.addIssue({ code: 'custom', path: [cle], message: `Spécial « ${effet(v.effet)} » : « ${champ(cle)} » est requis.` });
    }
    if (e !== v.effet && pose) {
      ctx.addIssue({ code: 'custom', path: [cle], message: `Spécial « ${effet(v.effet)} » : « ${champ(cle)} » appartient à l’effet « ${effet(e)} ».` });
    }
  }
}).refine(estUneFormeDeSpecial, { when: (p) => p.issues.length === 0 }), META_DE_SPECIAL);
