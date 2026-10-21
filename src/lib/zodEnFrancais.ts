/**
 * LANGUE des refus de schéma — règle 4 (« UI en français »), #1588. La carte d'erreurs FR livrée par
 * zod (`z.locales.fr`) est posée UNE fois sur la configuration GLOBALE de la dépendance : tout refus
 * produit par un `safeParse` la traverse, quel que soit le schéma et quel que soit l'appelant (écran,
 * test, script de garde). Aucun site ne traduit, aucun message ne se réécrit.
 *
 * Le module est importé pour son EFFET par la racine de la grammaire des schémas
 * (`src/data/schemas/grammaire/ref.ts`) et par tout autre module qui bâtit un schéma (l'hôte texte) : un banc
 * tient que TOUT fichier de production de `src/**` important zod en VALEUR atteint ce module transitivement
 * (`src/data/schemas/refus-en-francais.test.ts`). Charger un schéma, c'est avoir posé sa langue.
 */
import { z } from 'zod';

z.config(z.locales.fr());
