/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

function collectSourceFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'demo') continue
      results.push(...collectSourceFiles(fullPath))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      results.push(fullPath)
    }
  }
  return results
}

describe('ESM relative module specifiers (node16 / nodenext compatibility)', () => {
  const packagesRoot = path.resolve(import.meta.dirname, '../../..')
  const packageNames = fs
    .readdirSync(packagesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  it('uses explicit .js file extensions on all relative imports and re-exports across published packages', () => {
    const violations: string[] = []

    for (const pkg of packageNames) {
      const srcDir = path.join(packagesRoot, pkg, 'src')
      if (!fs.existsSync(srcDir)) continue

      for (const file of collectSourceFiles(srcDir)) {
        const text = fs.readFileSync(file, 'utf8')
        const sf = ts.createSourceFile(
          file,
          text,
          ts.ScriptTarget.Latest,
          true,
          file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        )

        const checkNode = (specNode: ts.Expression | ts.LiteralTypeNode['literal'] | undefined) => {
          if (!specNode || !ts.isStringLiteral(specNode)) return
          const spec = specNode.text
          if (!spec.startsWith('./') && !spec.startsWith('../')) return

          const relFile = path.relative(packagesRoot, file)
          if (!/\.(js|mjs|cjs|json)$/.test(spec)) {
            violations.push(`${relFile}: missing explicit file extension on "${spec}"`)
            return
          }

          if (spec.endsWith('.js')) {
            const base = path.resolve(path.dirname(file), spec.slice(0, -3))
            if (!fs.existsSync(`${base}.ts`) && !fs.existsSync(`${base}.tsx`)) {
              violations.push(`${relFile}: "${spec}" does not match an existing .ts/.tsx file`)
            }
          }
        }

        const visit = (node: ts.Node) => {
          if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
            checkNode(node.moduleSpecifier)
          } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
            checkNode(node.argument.literal)
          } else if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments.length === 1
          ) {
            checkNode(node.arguments[0])
          }
          ts.forEachChild(node, visit)
        }

        visit(sf)
      }
    }

    expect(violations).toEqual([])
  })
})
