import { CoinMark } from '@/core/ui/brand/CoinMark'

/** The coin and the name in the landing's light wordmark (450, tight): 30px with a 36px coin slot, or 26px with a 32px one (the coin in each is the slot narrowed to the coin, see coin.css). */
export function Wordmark({ name, small = false }: { readonly name: string; readonly small?: boolean }) {
  return <span className={`inline-flex items-center gap-2.5 leading-none font-[450] tracking-[-0.035em] text-penny-ink ${small ? 'text-[26px]' : 'text-[30px]'}`}><CoinMark className={`shrink-0 ${small ? '[--coin-slot:2rem]' : '[--coin-slot:2.25rem]'}`} /><span data-rer-name>{name}</span></span>
}
