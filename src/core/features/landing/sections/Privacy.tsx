import { copy } from '../copy'
import { PrivacyArt } from '../drawings/PrivacyArt'
import { Section } from '../parts/Section'

export function Privacy() {
  return (
    <Section id="private" copy={copy.privacy} icons={['approve', 'lock', 'eyeOff']} copySide="right">
      <PrivacyArt />
    </Section>
  )
}
