import { Link } from 'react-router'
import { useDbQuery } from '../app/data'
import { Grid, SearchIcon, Shield, Trash } from '../ui/Icons'
import { Row, Section } from '../ui/List'
import { Screen } from '../ui/Screen'

function Item({ to, icon, label, value }: { to: string; icon: React.ReactNode; label: string; value?: React.ReactNode }) {
  return (
    <Link to={to} className="block">
      <Row
        label={
          <span className="flex items-center gap-3">
            <span className="text-accent">{icon}</span>
            {label}
          </span>
        }
        value={value}
      />
    </Link>
  )
}

export function MoreScreen() {
  const collections = useDbQuery('listCollections').data
  const trash = useDbQuery('listTrash').data

  return (
    <Screen title="More">
      <Section>
        <Item to="/collections" icon={<Grid size={20} />} label="Collections" value={collections?.length || ''} />
        <Item to="/search" icon={<SearchIcon size={20} />} label="Search" />
      </Section>
      {collections && collections.length > 0 && (
        <Section title="Your collections">
          {collections.map((c) => (
            <Link key={c.id} to={`/collections/${c.id}`} className="block">
              <Row
                label={
                  <span className="flex items-center gap-3">
                    <span className="text-[20px] leading-none">{c.icon}</span>
                    {c.name}
                  </span>
                }
                value={c.recordCount}
              />
            </Link>
          ))}
        </Section>
      )}
      <Section>
        <Item to="/trash" icon={<Trash size={20} />} label="Trash" value={trash?.length || ''} />
        <Item to="/system" icon={<Shield size={20} />} label="System check" />
      </Section>
      <p className="px-8 text-center text-[13px] text-label-3">
        Personal OS {__APP_VERSION__} · {__APP_COMMIT__}
      </p>
    </Screen>
  )
}
