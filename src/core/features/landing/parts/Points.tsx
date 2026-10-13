import { Icon, type IconName } from '../icons/Icon'

/** Three short points, each with its line icon in a sand circle. */
export function Points({ items }: { items: readonly (readonly [IconName, string])[] }) {
  return (
    <ul className="pl-points">
      {items.map(([icon, text]) => (
        <li key={text}>
          <span className="pl-point-icon"><Icon name={icon} /></span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}
