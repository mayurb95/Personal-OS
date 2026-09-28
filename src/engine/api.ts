/**
 * The engine's public API: every function the UI can call through the database worker.
 * Each takes the open database and one payload object, and returns plain JSON.
 *
 * To add a call: add it here, and list it in MUTATIONS (src/db/mutations.ts) if it changes data.
 */
import type { Database } from '@sqlite.org/sqlite-wasm'
import {
  addField,
  createCollection,
  deleteCollection,
  getCollection,
  listCollections,
  moveField,
  removeField,
  updateCollection,
  updateField,
} from './collections'
import {
  createHabit,
  getHabit,
  getHabitStatus,
  habitLogs,
  listHabits,
  logHabit,
  tapHabit,
  updateHabit,
} from './habits'
import {
  createRecord,
  emptyTrash,
  getRecord,
  listRecords,
  listTrash,
  purgeRecord,
  restoreRecord,
  search,
  trashRecord,
  updateRecord,
} from './records'
import {
  createTask,
  getTask,
  listProjects,
  listTasks,
  listTaskTags,
  quickAddTask,
  setTaskDone,
  taskCounts,
  updateTask,
} from './tasks'
import { todaySummary } from './today'

export const api = {
  // Collections and fields
  listCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  addField,
  updateField,
  moveField,
  removeField,
  // Records
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  trashRecord,
  restoreRecord,
  purgeRecord,
  listTrash,
  emptyTrash,
  search,
  // Tasks
  listTasks,
  taskCounts,
  listProjects,
  listTaskTags,
  getTask,
  createTask,
  quickAddTask,
  updateTask,
  setTaskDone,
  // Habits
  listHabits,
  getHabit,
  getHabitStatus,
  habitLogs,
  createHabit,
  updateHabit,
  logHabit,
  tapHabit,
  // Today
  todaySummary,
} satisfies Record<string, (db: Database, payload: never) => unknown>

export type Api = typeof api
export type ApiName = keyof Api
