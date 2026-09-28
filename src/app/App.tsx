import { BrowserRouter, Route, Routes } from 'react-router'
import { TodayScreen } from '../screens/TodayScreen'
import { SystemCheckScreen } from '../screens/SystemCheckScreen'
import { TabBar } from '../ui/TabBar'
import { UpdateBanner } from './UpdateBanner'

export function App() {
  return (
    <BrowserRouter>
      <div className="flex h-full flex-col">
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Routes>
            <Route path="/" element={<TodayScreen />} />
            <Route path="/system" element={<SystemCheckScreen />} />
            <Route path="*" element={<TodayScreen />} />
          </Routes>
        </main>
        <TabBar />
      </div>
      <UpdateBanner />
    </BrowserRouter>
  )
}
