/** LE CONTENU DU JEU DE RÔLE (#4936) : ses campagnes, ses scénarios de test et ses fiches de dossier de chapitre
 *  (`ContenuDUnJeu`, `src/hote/contenu.ts`), que remettent son entrée du pont (`godot.ts`) et l'hôte texte de
 *  `.mcp.json` (`scripts/hote-texte.mjs --contenu`). */
import type { ContenuDUnJeu } from '../../src/hote/contenu';
import { lireLesFiches } from '../../src/data/schemas/dossiers';
import { campagnes } from './campagnes';
import { scenario as arene } from './scenarios/arene';
import { scenario as presetsEdo } from './scenarios/96-presets-edo';
import { scenario as documentsEdo } from './scenarios/documents-edo';
import { scenario as ecuriesClayonnage } from './scenarios/ecuries-clayonnage';
import { scenario as diligence } from './scenarios/diligence';
import { scenario as diligenceSallePleine } from './scenarios/diligence-salle-pleine';
import edo01 from './dossiers/EDO/01.json';
import edo02 from './dossiers/EDO/02.json';

export const contenu: ContenuDUnJeu = {
  campagnes,
  scenarios: [arene, presetsEdo, documentsEdo, ecuriesClayonnage, diligence, diligenceSallePleine],
  dossiers: lireLesFiches('projets/jeu-de-role/dossiers', { 'EDO/01.json': edo01, 'EDO/02.json': edo02 }),
};
