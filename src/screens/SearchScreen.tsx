import { useState } from 'react'
import { Link } from 'react-router'
import { useDbQuery } from '../app/data'
import type { SearchHit } from '../engine/types'
import { EmptyState } from '../ui/Controls'
import { SearchIcon } from '../ui/Icons'
import { Section } from '../ui/List'
import { NavBar } from '../ui/NavBar'
import { Page } from '../ui/Screen'

export function hitLink(hit: SearchHit): string {
  if (hit.collectionKind === 'tasks') return `/tasks/${hit.id}`
  if (hit.collectionKind === 'habits') return `/habits/${hit.id}`
  return `/records/${hit.id}`
}

/** Search across everything by words or the start of words. */
export function SearchScreen() {
  const [query, setQuery] = useState('')
  const { data: hits } = useDbQuery('search', { query, limit: 60 })

  return (
    <Page>
      <NavBar back={{ to: '/', label: 'Today' }} title="Search" />
      <div className="px-4 pb-4 pt-3">
        <label className="flex items-center gap-2 rounded-[10px] bg-label-3/20 px-3 py-2">
          <SearchIcon size={18} className="text-label-2" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tasks, habits, collections"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-label-2"
            aria-label="Search"
          />
        </label>
      </div>
      {query.trim() && hits && hits.length === 0 && <EmptyState title="No results">Try fewer or different words.</EmptyState>}
      {hits && hits.length > 0 && (
        <Section>
          {hits.map((h) => (
            <Link
              key={h.id}
              to={hitLink(h)}
              className="block border-b-[0.5px] border-separator px-4 py-2.5 last:border-b-0 active:bg-card-pressed"
            >
              <div className="flex items-center gap-2">
                <span aria-hidden="true">{h.collectionIcon}</span>
                <span className="min-w-0 flex-1 truncate">{h.title || 'Untitled'}</span>
                <span className="shrink-0 text-[13px] text-label-2">{h.collectionName}</span>
              </div>
              {h.snippet && <div className="mt-0.5 line-clamp-2 text-[13px] text-label-2">{h.snippet}</div>}
            </Link>
          ))}
        </Section>
      )}
    </Page>
  )
}
