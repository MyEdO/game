import { couleursHistoriques } from '../../data';
import { auChemin, estObjet } from '../../lib/objet.mjs';
import { CHEMINS_DES_COMBATTANTS } from '../combattantsDeLEtat.generated';

/** Empreintes dérivées à ad649c27f et à la livraison de #3916 et #3917. */
const TRANSITION_DES_FORMATS = {
  save: { avant: 'a903b626aab8d8eb', apres: 'e5b0e479130fc5d7' },
  roster: { avant: '5207758a6bf0bfd7', apres: 'e459f742094ad0cc' },
  exportHeros: { avant: 'cd40631dc865d107', apres: '1d8c8c61ae823704' },
} as const;

export function formatAvantLesReferences(
  document: keyof typeof TRANSITION_DES_FORMATS,
  formatLu: string | undefined,
  formatCourant: string,
): boolean {
  const { avant, apres } = TRANSITION_DES_FORMATS[document];
  return formatLu === avant && formatCourant === apres;
}

function migrerLesCouleurs(valeur: unknown, espece: unknown, colonneAttestee: boolean): void {
  if (!estObjet(valeur)) return;
  const eyes = typeof valeur.eyes === 'string' ? valeur.eyes : undefined;
  const hair = typeof valeur.hair === 'string' ? valeur.hair : undefined;
  if (eyes === undefined && hair === undefined) return;
  const couleurs = couleursHistoriques({ eyes, hair }, espece, colonneAttestee);
  if (couleurs.eyes !== undefined) valeur.eyes = couleurs.eyes;
  if (couleurs.hair !== undefined) valeur.hair = couleurs.hair;
}

function migrerLeCombattant(valeur: unknown): void {
  if (!estObjet(valeur)) return;
  const colonneAttestee = valeur.kind === 'ennemi' || valeur.kind === 'pnj';
  const apparence = valeur.appearanceOverride;
  const espece = colonneAttestee && estObjet(apparence) ? apparence.species ?? valeur.species : valeur.species;
  migrerLesCouleurs(valeur.details, espece, colonneAttestee);
}

function migrerAuChemin(valeur: unknown, chemin: readonly string[]): void {
  const index = chemin.indexOf('[]');
  if (index < 0) {
    migrerLeCombattant(auChemin(valeur, chemin));
    return;
  }
  const collection = auChemin(valeur, chemin.slice(0, index));
  const suite = chemin.slice(index + 1);
  if (Array.isArray(collection)) for (const entree of collection) migrerAuChemin(entree, suite);
}

/** Met en forme les combattants du document JSON lu, selon les chemins dérivés de l'état. */
export function migrerLaSaveAvantLesReferences(data: unknown): void {
  for (const chemin of CHEMINS_DES_COMBATTANTS) migrerAuChemin(data, chemin);
}

function migrerLOptionDeTalent(option: unknown): unknown {
  if (!estObjet(option)) return option;
  if (typeof option.random === 'number') return { pick: option.random, table: { id: 'talents-aleatoires' } };
  return Array.isArray(option.of) ? { ...option, of: option.of.map(migrerLOptionDeTalent) } : option;
}

/** Met en forme le héros et son brouillon dans une entrée JSON issue du roster ou de l'export. */
export function migrerLEntreeAvantLesReferences(entree: unknown): void {
  if (!estObjet(entree)) return;
  migrerLeCombattant(entree.hero);
  const draft = entree.draft;
  if (!estObjet(draft)) return;
  migrerLesCouleurs(draft, draft.speciesId, false);
  if (estObjet(draft.speciesTalentChoices)) {
    for (const [adresse, option] of Object.entries(draft.speciesTalentChoices)) {
      draft.speciesTalentChoices[adresse] = migrerLOptionDeTalent(option);
    }
  }
}
