/**
 * Database calls that change data. After one of these succeeds, every screen showing
 * data refreshes (see src/app/data.ts). Keep in sync with src/engine/api.ts.
 */
import type { ApiName } from '../engine/api'

export const MUTATIONS: ReadonlySet<string> = new Set<ApiName>([
  'createCollection',
  'updateCollection',
  'deleteCollection',
  'addField',
  'updateField',
  'moveField',
  'removeField',
  'createRecord',
  'updateRecord',
  'trashRecord',
  'restoreRecord',
  'purgeRecord',
  'emptyTrash',
  'createTask',
  'quickAddTask',
  'updateTask',
  'setTaskDone',
  'createHabit',
  'updateHabit',
  'logHabit',
  'tapHabit',
])
