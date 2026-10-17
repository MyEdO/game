// Préchargé (`node --import`) par tout processus que `lancerDetache` détache (#2603) : le détaché tourne
// en priorité BelowNormal (`PRIORITY_BELOW_NORMAL`, os.setPriority), sous les gestes au premier plan.
import { constants, setPriority } from 'node:os'

setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL)
