import { couleursHistoriques } from '../../data';
import { auChemin, estObjet } from '../../lib/objet.mjs';
import { CHEMINS_DES_COMBATTANTS } from '../combattantsDeLEtat.generated';

/** Empreintes dérivées à ad649c27f et à la livraison de #3916 et #3917. */
const TRANSITION_DES_FORMATS = {
  save: { avant: 'a903b626aab8d8eb', apres: 'e5b0e479130fc5d7' },
  roster: { avant: '5207758a6bf0bfd7', apres: 'e459f742094ad0cc' },
  exportHeros: { avant: 'cd40631dc865d107', apres: '1d8c8c61ae823704' },
} as const;

/** #4674 */
const TRANSITION_DES_COULEURS_DES_YEUX = {
  save: { avant: '6567d83e466bf816', apres: 'efb77d9c287718df' },
  roster: { avant: TRANSITION_DES_FORMATS.roster.apres, apres: '974d8daa87ece06f' },
  exportHeros: { avant: TRANSITION_DES_FORMATS.exportHeros.apres, apres: '372cd4f616141f86' },
} as const;

export function formatDeLaCouleurUnique(document: keyof typeof TRANSITION_DES_COULEURS_DES_YEUX, formatCourant: string): string {
  const { avant, apres } = TRANSITION_DES_COULEURS_DES_YEUX[document];
  return formatCourant === apres ? avant : formatCourant;
}

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

function envelopperLaCouleurDesYeux(valeur: unknown): void {
  if (estObjet(valeur) && estObjet(valeur.eyes)) valeur.eyes = [valeur.eyes];
}

function migrerLeCombattantAvantLesReferences(valeur: unknown): void {
  if (!estObjet(valeur)) return;
  const colonneAttestee = valeur.kind === 'ennemi' || valeur.kind === 'pnj';
  const apparence = valeur.appearanceOverride;
  const espece = colonneAttestee && estObjet(apparence) ? apparence.species ?? valeur.species : valeur.species;
  migrerLesCouleurs(valeur.details, espece, colonneAttestee);
  envelopperLaCouleurDesYeux(valeur.details);
}

function migrerAuChemin(valeur: unknown, chemin: readonly string[], migrer: (combattant: unknown) => void): void {
  const index = chemin.indexOf('[]');
  if (index < 0) {
    migrer(auChemin(valeur, chemin));
    return;
  }
  const collection = auChemin(valeur, chemin.slice(0, index));
  const suite = chemin.slice(index + 1);
  if (Array.isArray(collection)) for (const entree of collection) migrerAuChemin(entree, suite, migrer);
}

/** Met en forme les combattants du document JSON lu, selon les chemins dérivés de l'état. */
export function migrerLaSaveAvantLesReferences(data: unknown): void {
  for (const chemin of CHEMINS_DES_COMBATTANTS) migrerAuChemin(data, chemin, migrerLeCombattantAvantLesReferences);
}

export function migrerLaSaveAvantLesDeuxCouleurs(data: unknown): void {
  for (const chemin of CHEMINS_DES_COMBATTANTS) {
    migrerAuChemin(data, chemin, (combattant) => envelopperLaCouleurDesYeux(auChemin(combattant, ['details'])));
  }
}

function migrerLOptionDeTalent(option: unknown): unknown {
  if (!estObjet(option)) return option;
  if (typeof option.random === 'number') return { pick: option.random, table: { id: 'talents-aleatoires' } };
  return Array.isArray(option.of) ? { ...option, of: option.of.map(migrerLOptionDeTalent) } : option;
}

/** Met en forme le héros et son brouillon dans une entrée JSON issue du roster ou de l'export. */
export function migrerLEntreeAvantLesReferences(entree: unknown): void {
  if (!estObjet(entree)) return;
  migrerLeCombattantAvantLesReferences(entree.hero);
  const draft = entree.draft;
  if (!estObjet(draft)) return;
  migrerLesCouleurs(draft, draft.speciesId, false);
  envelopperLaCouleurDesYeux(draft);
  if (estObjet(draft.speciesTalentChoices)) {
    for (const [adresse, option] of Object.entries(draft.speciesTalentChoices)) {
      draft.speciesTalentChoices[adresse] = migrerLOptionDeTalent(option);
    }
  }
}

export function migrerLEntreeAvantLesDeuxCouleurs(entree: unknown): void {
  envelopperLaCouleurDesYeux(auChemin(entree, ['hero', 'details']));
  envelopperLaCouleurDesYeux(auChemin(entree, ['draft']));
}
