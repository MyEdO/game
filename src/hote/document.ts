/** Le rédacteur du document remis (`documentEnVue`) : le titre et le texte qu'un hôte affiche (#4574). */
import { t } from '../i18n';
import { swimTestLabel, type DocumentDeNaufrage, type DocumentEnVue } from '../noyau/index';

/** Le titre et le texte Markdown du document `doc` : celui d'un auteur tel quel, celui d'un naufrage rédigé d'une
 *  ligne par fait. */
export function redigerLeDocument(doc: DocumentEnVue): { titre: string; texte: string } {
  if (doc.genre === 'auteur') return { titre: doc.titre, texte: doc.texte };
  return { titre: t('wreck.title'), texte: lignesDuNaufrage(doc).join('\n\n') };
}

function lignesDuNaufrage(doc: DocumentDeNaufrage): string[] {
  const rescapes = doc.heros.filter((h) => h.issue === 'nage').map((h) => h.nom);
  return [
    t('wreck.sinks', { ship: doc.navire.nom }),
    ...(doc.cargaison ? [t('wreck.cargoSinks', { label: doc.cargaison.nom })] : []),
    ...doc.heros.map((h) => (h.issue === 'inconscient'
      ? t('wreck.unconscious', { name: h.nom })
      : t('wreck.applierLine', { name: h.nom, test: swimTestLabel(h.test.difficulty), issue: t(h.issue === 'nage' ? 'wreck.issueSwims' : 'wreck.issueDrowns') }))),
    ...(doc.rivage ? [rescapes.length ? t('wreck.survivors', { names: rescapes.join(', '), place: doc.rivage.nom }) : t('wreck.noSurvivor')] : []),
  ];
}
