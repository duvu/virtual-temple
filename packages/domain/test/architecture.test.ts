import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const sourceRoots = [
  resolve(testDirectory, '../src'),
  resolve(testDirectory, '../../application/src'),
];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && sourceExtensions.has(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

function moduleSpecifiers(source: ts.SourceFile): string[] {
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      specifiers.push(node.argument.literal.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteral(argument)) specifiers.push(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

function isEngineSdkImport(specifier: string): boolean {
  const normalized = specifier.replaceAll('\\', '/');
  return normalized === 'three' || normalized.startsWith('three/')
    || normalized.startsWith('@react-three/')
    || /^(?:@unity(?:\/|$)|unity(?:engine|editor|sdk)(?:\/|$)|com\.unity\.)/i.test(normalized)
    || /^(?:@unreal(?:\/|$)|unreal(?:engine|sdk)?(?:\/|$)|ue5?(?:\/|$)|@epicgames\/)/i.test(normalized);
}

describe('architecture boundaries', () => {
  it('keeps domain and application source independent from engine SDK imports', async () => {
    const files = (await Promise.all(sourceRoots.map(sourceFiles))).flat().sort();
    const violations: string[] = [];

    for (const file of files) {
      const text = await readFile(file, 'utf8');
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      for (const specifier of moduleSpecifiers(source)) {
        if (isEngineSdkImport(specifier)) violations.push(`${file}: ${specifier}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
