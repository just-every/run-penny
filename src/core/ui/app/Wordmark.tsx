import { CoinMark } from '@/core/ui/brand/CoinMark'

/** The coin and the name in the landing's light wordmark (450, tight): 30px with a 36px coin slot, or 26px with a 32px one (the coin in each is the slot narrowed to the coin, see coin.css). The name stays on one line and ends in an ellipsis when the room is short; the padding keeps the clip clear of descenders. */
export function Wordmark({ name, small = false }: { readonly name: string; readonly small?: boolean }) {
  return <span className={`inline-flex max-w-full min-w-0 items-center gap-2.5 leading-none font-[450] tracking-[-0.035em] text-penny-ink ${small ? 'text-[26px]' : 'text-[30px]'}`}><CoinMark className={`shrink-0 ${small ? '[--coin-slot:2rem]' : '[--coin-slot:2.25rem]'}`} /><span data-rer-name className="min-w-0 truncate py-[0.15em] -my-[0.15em]">{name}</span></span>
}
