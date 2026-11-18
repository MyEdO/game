/**
 * Les options (#4411) : le panneau des réglages tel que le noyau le sert sans partie ouverte (`zonesDesReglages`), aux
 * préférences et aux règles maison par défaut (`../../accueil-et-systeme.md`, section `options`).
 */
import { zonesDesReglages } from '../../../../../../src/hote/reglages';
import type { Ecran } from './maquette';

export default {
  etats: [{
    nom: 'options',
    titre: 'options, sans partie',
    gabarits: ['gestion'],
    decor: null,
    reponses: { reglages: { ok: true, zones: zonesDesReglages(null, null) } },
  }],
} satisfies Ecran;
