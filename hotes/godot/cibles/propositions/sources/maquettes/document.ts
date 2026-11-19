/**
 * Le document (#4411) : l'avis placardé à La Diligence, remis à Mira et lu en carton au-dessus du bandeau ; consigné au
 * carnet, il s'y relit, et « Replier » ramène d'où l'on vient (`../../exploration-et-recit.md`, sections `document`,
 * `document-relu`).
 */
import { combattants } from './compagnie.ts';
import { LA_DILIGENCE, MIRA_MENE } from './exploration.ts';
import type { DocumentRemis, Ecran, Exploration } from './maquette.ts';

const AVIS: DocumentRemis = {
  provenance: 'Avis placardé à La Diligence', titre: 'On recherche !', sous: 'Aventuriers courageux !',
  paragraphes: [
    'Son Excellence le Prince Héritier Hergard von Tasseninck de la Grande Principauté d’Ostland, fait savoir par la présente qu’il réside actuellement à Altdorf et souhaite s’attacher les services d’un groupe d’aventuriers chevronnés. L’engagement prendra effet dès que possible, pour une période indéterminée.',
    'Que les postulants soient avisés qu’il leur sera demandé d’entreprendre une mission des plus périlleuses dans les régions inexplorées des Montagnes Grises. L’objet de la mission est très délicat et la plus haute discrétion est impérative en ce qui concerne sa nature précise.',
    'La rémunération est négociable et dépendra de l’expérience des candidats, mais un minimum de 8 Couronnes par personne et par jour est assuré. De plus, une prime généreuse sera accordée une fois la mission accomplie. Couards, traînards et nains s’abstenir.',
  ],
  signature: ['Signé', 'Scribe personnel du Prince Héritier Hergard'], sceau: 'bouclier', heros: 'mira',
};

/** L'avis lu devant le panneau, ou `relu` depuis le carnet. */
const lu = (nom: string, relu: boolean): Exploration => ({
  nom, gabarit: 'lieu-et-voyage', decor: 'salle', titre: LA_DILIGENCE, groupeEn: 'avis',
  document: { ...AVIS, ...(relu ? { relu: true } : {}) }, combattants: combattants(), groupe: MIRA_MENE,
});

export default { etats: [lu('document', false), lu('document-relu', true)] } satisfies Ecran;
