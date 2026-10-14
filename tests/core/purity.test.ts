import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

function listTs(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return listTs(p)
    return p.endsWith('.ts') ? [p] : []
  })
}

it('src/core não importa phaser', () => {
  const coreFiles = listTs(join(__dirname, '../../src/core'))
  expect(coreFiles.length).toBeGreaterThan(0)
  for (const file of coreFiles) expect(readFileSync(file, 'utf8')).not.toMatch(/from\s+['"]phaser/)
})
