/** L'engagement d'un brouillon joué sur un jeu, pour les tests : `engagerLeHeros` (`roster.ts`), puis son intention
 *  jouée par le verbe du jeu, comme un hôte l'envoie à sa partie. */
import type { JeuDuNoyau } from '../noyau/index';
import { engagerLeHeros } from './roster';

type Engagement = Parameters<typeof engagerLeHeros>;

/** Le brouillon engagé au roster et au groupe de `jeu` : `null`, ou le refus de l'engagement, rien n'étant joué. */
export function engagerSurLeJeu(stockage: Engagement[0], jeu: Engagement[1] & Pick<JeuDuNoyau, 'recruterLeHeros' | 'remplacerLeHeros'>, ...reste: [Engagement[2], Engagement[3], Engagement[4]?]): string | null {
  const engage = engagerLeHeros(stockage, jeu, ...reste);
  if ('refus' in engage) return engage.refus;
  if (engage.intention.type === 'recruterLeHeros') jeu.recruterLeHeros(...engage.intention.args);
  else jeu.remplacerLeHeros(...engage.intention.args);
  return null;
}
