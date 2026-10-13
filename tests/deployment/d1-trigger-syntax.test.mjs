import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { sqlTokens } from '../../base/modules/deploy-kit/sql-tokens.mjs'

const directory = new URL('../../migrations/core/', import.meta.url)

// Production D1 ends a trigger at the first END; it finds, so an inner CASE ... END; left a
// trigger incomplete ("incomplete input") when 0013 was first deployed. Count each occurrence.
function caseInsideTrigger(sql) {
  const tokens = sqlTokens(sql), word = (token, value) => token?.kind === 'word' && token.value.toUpperCase() === value
  let state = 'outside', found = 0
  tokens.forEach((token, index) => {
    if (state === 'outside' && word(token, 'CREATE') && word(tokens[index + 1], 'TRIGGER')) state = 'header'
    else if (state === 'header' && word(token, 'BEGIN')) state = 'body'
    else if (state === 'body' && word(token, 'CASE')) found++
    else if (state === 'body' && word(token, 'END')) state = 'outside'
  })
  return found
}

test('[BASE-OPS-002] no migration trigger body contains a CASE expression', async () => {
  for (const name of (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()) {
    assert.equal(caseInsideTrigger(await readFile(new URL(name, directory), 'utf8')), 0, `${name} has a CASE expression inside a trigger body`)
  }
})

test('[BASE-OPS-002] the guard flags a CASE inside a trigger and ignores one outside', () => {
  assert.equal(caseInsideTrigger("CREATE TRIGGER t BEFORE INSERT ON x BEGIN SELECT CASE WHEN 1 THEN RAISE(ABORT,'m') END; END;"), 1)
  assert.equal(caseInsideTrigger("CREATE TRIGGER t BEFORE INSERT ON x BEGIN SELECT RAISE(ABORT,'m') WHERE 1; END; UPDATE y SET z = CASE WHEN 1 THEN 2 END;"), 0)
})
