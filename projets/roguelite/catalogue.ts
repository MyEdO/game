// Le catalogue du roguelite : la vue lisible de ce que le jeu offre (`src/jeu/valeurs.ts`), écrite dans `CATALOGUE.md`.
// Usage : npx tsx projets/roguelite/catalogue.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ARMES_DE_LA_FORGE, CHAMBRE_DU_RELAIS, COMPETENCES_UTILES, DESTINATIONS, GROUPES_SANS_COMPETENCE, ARMURES_DE_LA_FORGE, PRIX_DU_SOIN_PAR_BLESSURE, PROFILS, REMEDES_DE_L_HOSPICE, ROLES,
  prixDUneChambre,
  SORTS_DES_VOIES, SORTS_MINEURS, TALENTS_HORS_DU_COMBAT, PRIERE_DE_SOIN,
} from './src/jeu';
import { articleDuCatalogue, nomDeCarriereDuLivre, nomDeCompetence, nomDeCreature, nomDeGroupe, nomDeSort, nomDeTalent } from './src/noyau';

export const CHEMIN_DU_CATALOGUE = fileURLToPath(new URL('./CATALOGUE.md', import.meta.url));

const nomme = (nom: string, id: string): string => `${nom} (${id})`;
const objet = (id: string): string => nomme(articleDuCatalogue(id).label, id);
const sort = (id: string): string => nomme(nomDeSort(id), id);
const competence = (cle: string): string => { const [id, spec] = cle.split(':'); return nomme(nomDeCompetence(spec ? { id, spec } : { id }), cle); };
const talent = (ref: { id: string; spec?: string }): string => nomme(nomDeTalent(ref), ref.spec ? `${ref.id}:${ref.spec}` : ref.id);
const creatures = (ids: readonly string[]): string => ids.map((id) => nomme(nomDeCreature(id), id)).join(' + ');
const arcane = (spec: string): boolean => PROFILS.some((p) => p.voie?.talent === 'magie-des-arcanes' && p.voie.spec === spec);
const tableau = (entete: readonly string[], lignes: readonly (readonly string[])[]): string =>
  [`| ${entete.join(' | ')} |`, `|${entete.map(() => '---').join('|')}|`, ...lignes.map((l) => `| ${l.join(' | ')} |`)].join('\n');

/** Le contenu de `CATALOGUE.md`, produit des tables de `valeurs.ts`. */
export function catalogue(): string {
  const carrieres = tableau(['Carrière', 'Relais', 'Niveau', 'Rôle', 'Identité', 'Dotation d’adaptation', 'Désignations', 'Voie'], PROFILS.map((p) => [
    nomme(nomDeCarriereDuLivre(p.id), p.id), String(p.relais), String(p.niveau), ROLES[p.role].nom, talent(p.identite.talent),
    (p.dotation ?? []).map(objet).join(', '),
    (p.identite.designations ?? []).map((d) => `niv. ${d.niveau} : ${competence(`${d.id}:${d.spec}`)}`).join(', '),
    p.voie ? p.voie.nom : p.dieux ? `Invocation, dieu tiré : ${p.dieux.join(', ')}` : '',
  ]));
  const voies = tableau(['Voie', 'Sorts, par niveau de carrière'], Object.entries(SORTS_DES_VOIES).map(([spec, paliers]) => [talent({ id: arcane(spec) ? 'magie-des-arcanes' : 'invocation', spec }),
    Object.entries(paliers).map(([niveau, ids]) => `niv. ${niveau} : ${ids.map(sort).join(', ')}`).join(' ; ')]));
  const forge = tableau(['Groupe', 'Armes'], Object.entries(ARMES_DE_LA_FORGE).map(([g, ids]) =>
    [`${nomme(nomDeGroupe(g), g)}${GROUPES_SANS_COMPETENCE.has(g as keyof typeof ARMES_DE_LA_FORGE) ? ', sans Compétence' : ''}`, ids.map(objet).join(', ')]));
  const destinations = tableau(['Destination', 'Palier', 'Salles', 'Meutes', 'Élites', 'Maître'], DESTINATIONS.map((d) => [
    nomme(d.nom, d.id), String(d.palier), String(d.salles), d.meutes.map(creatures).join(' ; '), d.elites.map(creatures).join(' ; '), creatures(d.boss),
  ]));
  return [
    '# Catalogue du roguelite',
    '',
    '> GÉNÉRÉ par `npx tsx projets/roguelite/catalogue.ts` depuis `projets/roguelite/src/jeu/valeurs.ts` : ne pas éditer à la main.',
    '',
    '## Carrières', '', carrieres, '',
    '## Voies et sorts', '', voies, '',
    `Sorts mineurs d’un lanceur de Collège : ${SORTS_MINEURS.map(sort).join(', ')}. Prière entre deux salles : ${sort(PRIERE_DE_SOIN)}.`, '',
    '## Compétences utiles', '', [...COMPETENCES_UTILES].map(competence).join(', '), '',
    '## Talents de carrière écartés de la salle d’armes', '', [...TALENTS_HORS_DU_COMBAT].map((id) => talent({ id })).join(', '), '',
    '## Forge', '', forge, '', `Armures : ${ARMURES_DE_LA_FORGE.map(objet).join(', ')}.`, '',
    '## Auberge relais', '', tableau(['Palier', 'Chambre', 'Prix de la semaine'], CHAMBRE_DU_RELAIS.map((q, i) => [String(i), q, `${prixDUneChambre(q)} CO`])), '',
    '## Hospice', '', tableau(['Palier', 'Soin par Blessure rendue'], PRIX_DU_SOIN_PAR_BLESSURE.flatMap((p, i) => (p == null ? [] : [[String(i), `${p} CO`]]))), '', REMEDES_DE_L_HOSPICE.map(objet).join(', '), '',
    '## Destinations et adversaires', '', destinations, '',
  ].join('\n');
}

if (import.meta.main) writeFileSync(CHEMIN_DU_CATALOGUE, catalogue());
