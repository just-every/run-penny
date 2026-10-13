import { copy } from '../copy'
import { LoopArt } from '../drawings/LoopArt'
import { Section } from '../parts/Section'

export function Loop() {
  return (
    <Section id="close-the-loop" copy={copy.loop} icons={['megaphone', 'note', 'mail']} copySide="left">
      <LoopArt />
    </Section>
  )
}
