import { act, useDbQuery } from '../app/data'
import { EmptyState } from '../ui/Controls'
import { Section } from '../ui/List'
import { BarButton, NavBar } from '../ui/NavBar'
import { Page } from '../ui/Screen'

/** Deleted items, kept for 30 days. */
export function TrashScreen() {
  const { data } = useDbQuery('listTrash')

  const emptyAll = async () => {
    if (!window.confirm('Delete everything in the trash for good?')) return
    await act('emptyTrash', {})
  }

  return (
    <Page>
      <NavBar
        back={{ to: '/more', label: 'More' }}
        title="Trash"
        right={
          data && data.length > 0 ? (
            <BarButton onClick={emptyAll}>Empty</BarButton>
          ) : undefined
        }
      />
      <div className="pt-4" />
      {data && data.length === 0 && <EmptyState title="Trash is empty">Deleted items stay here for 30 days.</EmptyState>}
      {data && data.length > 0 && (
        <Section footer="Items are deleted for good 30 days after you delete them.">
          {data.map((t) => (
            <div key={t.id} className="flex items-center gap-3 border-b-[0.5px] border-separator py-2.5 pl-4 pr-4 last:border-b-0">
              <span aria-hidden="true">{t.collectionIcon}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate">{t.title || 'Untitled'}</div>
                <div className="text-[13px] text-label-2">
                  {t.collectionName} · deleted{' '}
                  {new Date(t.deletedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <button type="button" onClick={() => void act('restoreRecord', { id: t.id })} className="text-[15px] text-accent">
                Restore
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete “${t.title || 'Untitled'}” for good?`)) void act('purgeRecord', { id: t.id })
                }}
                className="text-[15px] text-bad"
              >
                Delete
              </button>
            </div>
          ))}
        </Section>
      )}
    </Page>
  )
}
