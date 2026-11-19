/**
 * Le carnet d'enquête (#4411) : posé sur la salle de La Diligence, les affaires et leurs indices visibles, les documents
 * remis qui s'y relisent, l'indice nouveau et ses lectures, la dernière en tête (EDO 02, Documents 3 et 4)
 * (`../../exploration-et-recit.md`, section `carnet`).
 */
import type { Ecran } from './maquette.ts';

export default {
  etats: [{
    nom: 'carnet', gabarit: 'gestion', decor: 'salle',
    titre: { nom: 'Carnet d’enquête', sous: 'Affaires et indices' },
    epingles: 1,
    affaires: [{ id: 'heritage', nom: 'Un héritage à Bögenhafen', indices: 1 }],
    ouverte: 'heritage',
    documents: ['On recherche !', 'L’héritage', 'L’affidavit'],
    indices: [{
      nom: 'L’héritage', nouveau: true,
      lectures: [
        { titre: 'L’affidavit', lignes: ['Nous, soussignés, jurons solennellement que le porteur de ce document se nomme Kastor Aloysius Lieberung.', 'Ingrid Zicherman, prêtresse', 'Temple de Sigmar, Nuln', 'Oskar Helmut, maître de guilde', 'Guilde des marchands, Nuln', 'Sous le regard de', 'Julius Schwungrad, Honorable Société des Avocats, Nuln'] },
        { titre: 'L’héritage', manuscrite: true, lignes: ['Messires Lock, Stock & Barl', 'Notaires, Commissaires aux serments, etc.', 'Garten Weg', 'Bögenhafen', 'Cher Herr Lieberung,',
          'Après de longues recherches, nous sommes portés à croire que vous êtes le dernier parent vivant de feu le baronet Lieberung, d’Ubersreik. Si cela s’avère exact, et si aucun autre élément inconnu de nous à ce jour ne venait à se présenter, je suis chargé de vous informer que vous êtes l’unique bénéficiaire des dernières volontés et du testament de feu le Baronet (ci-après dénommé la première partie), ainsi que du titre et de toutes les terres et propriétés s’y rattachant.',
          'Je, soussigné, agissant en ma qualité d’exécuteur légal du document de la première partie mentionné ci-dessus, vous prie de vous rendre avec toute la célérité voulue à mes bureaux situés à l’adresse indiquée dans la présente lettre. Dès lors, et sous réserve que vous puissiez produire une déclaration sous serment signée et attestée par deux témoins confirmant votre identité de Kastor Aloysius Lieberung, nous aurons le plaisir de vous remettre le titre de propriété du manoir de Lieberung et de toutes les terres et propriétés s’y rattachant, ainsi que la somme de vingt mille couronnes d’or impériales.',
          'Votre humble et dévoué serviteur,', 'Dietrich Barl. K.C., LL.B. (Alt)', 'Signé en ce dixième jour de Nachhexen, dans la deux mille cinq cent douzième année de l’Empire.'] },
      ],
    }],
  }],
} satisfies Ecran;
