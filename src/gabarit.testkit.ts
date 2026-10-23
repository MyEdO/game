/** Gabarit d'un message du catalogue FR en RegExp ancrée : chaque `{param}` devient `.*`. Lit une ligne
 *  de journal par sa clé, jamais par son texte recopié. */
import { fr } from './i18n/messages/fr';
import type { MsgKey } from './i18n/index';
import { echapperRegex } from './lib/regex';

export const gabarit = (cle: MsgKey): RegExp => new RegExp(`^${fr[cle].split(/\{[a-zA-Z]+\}/).map(echapperRegex).join('.*')}$`);
