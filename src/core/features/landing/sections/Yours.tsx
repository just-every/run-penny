import { copy } from '../copy'
import { YoursArt } from '../drawings/YoursArt'
import { Section } from '../parts/Section'

export function Yours() {
  return (
    <Section id="yours" copy={copy.yours} icons={['worker', 'export', 'noSignal']} copySide="left">
      <YoursArt />
    </Section>
  )
}
