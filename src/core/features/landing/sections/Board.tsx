import { copy } from '../copy'
import { BoardArt } from '../drawings/BoardArt'
import { Section } from '../parts/Section'

export function Board() {
  return (
    <Section id="board" copy={copy.board} icons={['duplicate', 'shield', 'statuses']} copySide="left">
      <BoardArt />
    </Section>
  )
}
