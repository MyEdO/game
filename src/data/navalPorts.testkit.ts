import { navalPorts } from './index';

/** Un port du catalogue à chantier naval spécialisé et un port sans, trouvés par le champ `chantierNavalSpecialise`,
 *  jamais nommés : la liste des ports à chantier est une donnée éditable. MDG 12 l.230 */
export const PORT_A_CHANTIER = navalPorts.find((p) => p.chantierNavalSpecialise)!.id;
export const PORT_SANS_CHANTIER = navalPorts.find((p) => !p.chantierNavalSpecialise)!.id;
