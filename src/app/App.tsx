import { useEffect, useRef } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router'
import { CollectionScreen } from '../screens/collections/CollectionScreen'
import { CollectionsScreen } from '../screens/collections/CollectionsScreen'
import { FieldsScreen } from '../screens/collections/FieldsScreen'
import { RecordScreen } from '../screens/collections/RecordScreen'
import { HabitDetailScreen } from '../screens/habits/HabitDetailScreen'
import { HabitEditScreen } from '../screens/habits/HabitEditScreen'
import { HabitsScreen } from '../screens/habits/HabitsScreen'
import { MoreScreen } from '../screens/MoreScreen'
import { SearchScreen } from '../screens/SearchScreen'
import { SystemCheckScreen } from '../screens/SystemCheckScreen'
import { TaskDetailScreen } from '../screens/tasks/TaskDetailScreen'
import { TaskListScreen } from '../screens/tasks/TaskListScreen'
import { TasksHome } from '../screens/tasks/TasksHome'
import { TodayScreen } from '../screens/TodayScreen'
import { TrashScreen } from '../screens/TrashScreen'
import { TabBar } from '../ui/TabBar'
import { Toaster } from '../ui/Toast'
import { UpdateBanner } from './UpdateBanner'

/** Scrolls back to the top when moving to a different screen. */
function ScrollToTop({ target }: { target: React.RefObject<HTMLElement | null> }) {
  const { pathname } = useLocation()
  useEffect(() => {
    target.current?.scrollTo(0, 0)
  }, [pathname, target])
  return null
}

export function App() {
  const main = useRef<HTMLElement>(null)
  return (
    <BrowserRouter>
      <ScrollToTop target={main} />
      <div className="flex h-full flex-col">
        <main ref={main} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Routes>
            <Route path="/" element={<TodayScreen />} />
            <Route path="/tasks" element={<TasksHome />} />
            <Route path="/tasks/list/:list" element={<TaskListScreen kind="list" />} />
            <Route path="/tasks/project/:name" element={<TaskListScreen kind="project" />} />
            <Route path="/tasks/tag/:tag" element={<TaskListScreen kind="tag" />} />
            <Route path="/tasks/:id" element={<TaskDetailScreen />} />
            <Route path="/habits" element={<HabitsScreen />} />
            <Route path="/habits/new" element={<HabitEditScreen />} />
            <Route path="/habits/:id" element={<HabitDetailScreen />} />
            <Route path="/habits/:id/edit" element={<HabitEditScreen />} />
            <Route path="/more" element={<MoreScreen />} />
            <Route path="/collections" element={<CollectionsScreen />} />
            <Route path="/collections/:id" element={<CollectionScreen />} />
            <Route path="/collections/:id/fields" element={<FieldsScreen />} />
            <Route path="/records/:id" element={<RecordScreen />} />
            <Route path="/search" element={<SearchScreen />} />
            <Route path="/trash" element={<TrashScreen />} />
            <Route path="/system" element={<SystemCheckScreen />} />
            <Route path="*" element={<TodayScreen />} />
          </Routes>
        </main>
        <TabBar />
      </div>
      <Toaster />
      <UpdateBanner />
    </BrowserRouter>
  )
}
