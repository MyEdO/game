/**
 * Les projets de campagne livrés (`listerProjetsLivres`), chacun apparié à SA campagne du registre par
 * l'`id` du document : `[chemin relatif, campagne, texte du disque]`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { campagnes } from '../campagnes';
import { type BuiltinCampaign } from '../../../src/noyau/index';
import { dossierDesProjetsLivres, listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';

export const campagnesLivrees: ReadonlyArray<readonly [string, BuiltinCampaign, string]> = listerProjetsLivres().map((rel) => {
  const texte = readFileSync(join(dossierDesProjetsLivres(), rel), 'utf8');
  const id = (JSON.parse(texte) as { id: string }).id;
  const campagne = campagnes.find((c) => c.id === id);
  if (!campagne) throw new Error(`${rel} : aucune campagne du jeu d’id « ${id} »`);
  return [rel, campagne, texte] as const;
});
