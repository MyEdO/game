import { idDe, type Id, type PorteeLocale, type TypeEntite } from './schemas/grammaire/ref';

/** Portée qu'aucun objet n'ouvre (`ouvrirPortees`) : sa feuille admet un id absent du registre sans le juger. */
const IDS_DE_FIXTURE = { collection: 'ids', catalogue: 'ids de fixture' } as const satisfies PorteeLocale;

/** L'id `id` de `type`, de sa `sousListe` s'il en nomme une, tel que la donnée PARSÉE le porte (`Id<type, sousListe>`),
 *  pour une FIXTURE : frappé par la porte zod (`idDe`), feuille à portée hors de tout ouvreur — un id de fixture absent
 *  du registre y est admis, un id présent y reste jugé. */
export const idDeFixture = <T extends TypeEntite, S extends string | undefined = undefined>(type: T, id: string, sousListe?: S): Id<T, S> =>
  idDe(type, sousListe, { portee: IDS_DE_FIXTURE }).parse(id);
