import { copy } from '../copy'
import { EvidenceArt } from '../drawings/EvidenceArt'
import { Section } from '../parts/Section'

export function Evidence() {
  return (
    <Section id="evidence" copy={copy.evidence} icons={['quote', 'columns', 'flag']} copySide="right">
      <EvidenceArt />
    </Section>
  )
}
