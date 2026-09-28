import { Link } from 'react-router'
import { Screen } from '../ui/Screen'
import { Section } from '../ui/List'

function greeting(hour: number): string {
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function TodayScreen() {
  const now = new Date()
  const date = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Screen title={greeting(now.getHours())} subtitle={date}>
      <Section
        title="Getting started"
        footer="Tasks, habits, notes and the rest of Today arrive in Phase 1."
      >
        <div className="px-4 py-3.5">
          <p className="text-[15px] leading-snug">
            Personal OS is in Phase 0. This version checks that your iPhone can install the app,
            run it offline and keep its data between launches.
          </p>
          <Link
            to="/system"
            className="mt-3 inline-block rounded-full bg-accent px-4 py-2 text-[15px] font-semibold text-white active:opacity-80"
          >
            Open System check
          </Link>
        </div>
      </Section>
    </Screen>
  )
}
