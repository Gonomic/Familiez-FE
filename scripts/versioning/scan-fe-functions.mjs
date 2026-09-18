import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parse } from 'espree';

const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'coverage']);

function collectJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) return [];
      return collectJavaScriptFiles(path.join(directory, entry.name));
    }
    return entry.isFile() && entry.name.endsWith('.js')
      ? [path.join(directory, entry.name)]
      : [];
  }).sort();
}

function sourceText(source, node) {
  return source.slice(node.range[0], node.range[1]);
}

function parameterText(source, parameter) {
  return sourceText(source, parameter).replace(/\s+/g, ' ').trim();
}

function functionParameters(source, node) {
  return [
    ...node.params.map((parameter) => parameterText(source, parameter)),
  ];
}

function functionType(node) {
  if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
    return node.async ? 'async-function' : 'function';
  }
  return node.async ? 'async-arrow' : 'arrow';
}

function signatureHash(signature) {
  const canonical = JSON.stringify(signature, Object.keys(signature).sort());
  return `sha256:${crypto.createHash('sha256').update(canonical).digest('hex')}`;
}

function functionRecord(source, file, exportName, node, declaration) {
  const signature = {
    name: exportName,
    parameters: functionParameters(source, node),
    type: functionType(node),
  };
  return {
    layer: 'FE',
    name: exportName,
    file,
    line: declaration.loc.start.line,
    type: signature.type,
    parameters: signature.parameters,
    signatureHash: signatureHash(signature),
  };
}

function exportedFunctions(source, ast, file) {
  const localFunctions = new Map();
  const exported = [];

  for (const statement of ast.body) {
    const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
      localFunctions.set(declaration.id.name, { node: declaration, declaration });
    }
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier' && declarator.init
          && ['ArrowFunctionExpression', 'FunctionExpression'].includes(declarator.init.type)) {
          localFunctions.set(declarator.id.name, { node: declarator.init, declaration: declarator });
        }
      }
    }
  }

  for (const statement of ast.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue;
    if (statement.declaration?.type === 'FunctionDeclaration' && statement.declaration.id) {
      exported.push(functionRecord(source, file, statement.declaration.id.name, statement.declaration, statement.declaration));
    }
    if (statement.declaration?.type === 'VariableDeclaration') {
      for (const declarator of statement.declaration.declarations) {
        if (declarator.id.type === 'Identifier' && localFunctions.has(declarator.id.name)) {
          const local = localFunctions.get(declarator.id.name);
          exported.push(functionRecord(source, file, declarator.id.name, local.node, declarator));
        }
      }
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type !== 'ExportSpecifier') continue;
      const local = localFunctions.get(specifier.local.name);
      if (local) exported.push(functionRecord(source, file, specifier.exported.name, local.node, specifier));
    }
  }
  return exported;
}

export function scanServices(servicesDirectory) {
  const functions = [];
  const diagnostics = [];
  const root = path.resolve(servicesDirectory);
  for (const filePath of collectJavaScriptFiles(root)) {
    const relativeFile = path.relative(root, filePath).split(path.sep).join('/');
    const source = fs.readFileSync(filePath, 'utf8');
    let ast;
    try {
      ast = parse(source, {
        ecmaVersion: 'latest',
        loc: true,
        range: true,
        sourceType: 'module',
      });
    } catch (error) {
      diagnostics.push({
        file: relativeFile,
        line: error.lineNumber ?? null,
        column: error.column ?? null,
        error: error.name,
        message: error.message,
      });
      continue;
    }
    functions.push(...exportedFunctions(source, ast, relativeFile));
  }
  functions.sort((left, right) => left.file.localeCompare(right.file)
    || left.line - right.line || left.name.localeCompare(right.name));
  diagnostics.sort((left, right) => left.file.localeCompare(right.file));
  return { component: 'FE', functions, diagnostics };
}

export function main(argv = process.argv.slice(2)) {
  const servicesDirectory = argv[0] ?? path.resolve('src/services');
  const result = scanServices(servicesDirectory);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.diagnostics.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}