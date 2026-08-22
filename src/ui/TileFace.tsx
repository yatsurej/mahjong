import { glyphOf, nameOf, toneOf, type TileId } from '../engine/tiles'

type Size = 'xs' | 'sm' | 'lg'

interface Props {
  id: TileId
  size?: Size
  onClick?: () => void
  disabled?: boolean
  /** Just drawn or just discarded — ringed in gold. */
  fresh?: boolean
  selected?: boolean
  dim?: boolean
  label?: string
}

export function TileFace({ id, size, onClick, disabled, fresh, selected, dim, label }: Props) {
  const cls = [
    'tile',
    size ?? '',
    `tone-${toneOf(id)}`,
    fresh ? 'fresh' : '',
    selected ? 'selected' : '',
    dim ? 'dim' : '',
  ].filter(Boolean).join(' ')

  const glyph = <span className="glyph" aria-hidden="true">{glyphOf(id)}</span>

  if (!onClick) {
    return <span className={cls} role="img" aria-label={label ?? nameOf(id)} title={nameOf(id)}>{glyph}</span>
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}
            aria-label={label ?? nameOf(id)} title={nameOf(id)}>
      {glyph}
    </button>
  )
}

/** A face-down tile. Purely decorative — it never announces itself. */
export function TileBack({ size }: { size?: Size }) {
  return <span className={['tile', 'back', size ?? ''].filter(Boolean).join(' ')} aria-hidden="true" />
}

export function TileRow({ ids, size }: { ids: TileId[]; size?: Size }) {
  return (
    <div className="tiles tight">
      {ids.map((id, i) => <TileFace key={`${id}-${i}`} id={id} size={size} />)}
    </div>
  )
}
