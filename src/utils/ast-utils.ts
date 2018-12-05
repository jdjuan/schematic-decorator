import * as ts from 'typescript';
import {
  Change,
  InsertChange,
  NoopChange,
  ReplaceChange
  } from './change';
import { insertImport } from './route-utils';
import { normalize } from '@angular-devkit/core';
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/**
 * Find all nodes from the AST in the subtree of node of SyntaxKind kind.
 * @param node
 * @param kind
 * @param max The maximum number of items to return.
 * @return all nodes of kind, or [] if none is found
 */
export function findNodes(node: ts.Node, kind: ts.SyntaxKind, max = Infinity): ts.Node[] {
  if (!node || max == 0) {
    return [];
  }

  const arr: ts.Node[] = [];
  if (node.kind === kind) {
    arr.push(node);
    max--;
  }
  if (max > 0) {
    for (const child of node.getChildren()) {
      findNodes(child, kind, max).forEach((node) => {
        if (max > 0) {
          arr.push(node);
        }
        max--;
      });

      if (max <= 0) {
        break;
      }
    }
  }

  return arr;
}

/**
 * Get all the nodes from a source.
 * @param sourceFile The source file object.
 * @returns {Observable<ts.Node>} An observable of all the nodes in the source.
 */
export function getSourceNodes(sourceFile: ts.SourceFile): ts.Node[] {
  const nodes: ts.Node[] = [sourceFile];
  const result = [];

  while (nodes.length > 0) {
    const node = nodes.shift();

    if (node) {
      result.push(node);
      if (node.getChildCount(sourceFile) >= 0) {
        nodes.unshift(...node.getChildren());
      }
    }
  }
  return result;
}

export function findNode(
  node: ts.Node,
  kind: ts.SyntaxKind,
  text: string,
): ts.Node | null {
  if (node.kind === kind && node.getText() === text) {
    // throw new Error(node.getText());
    return node;
  }

  let foundNode: ts.Node | null = null;
  ts.forEachChild(node, (childNode) => {
    foundNode = foundNode || findNode(childNode, kind, text);
  });

  return foundNode;
}

/**
 * Helper for sorting nodes.
 * @return function to sort nodes in increasing order of position in sourceFile
 */
function nodesByPosition(first: ts.Node, second: ts.Node): number {
  return first.pos - second.pos;
}

/**
 * Insert `toInsert` after the last occurence of `ts.SyntaxKind[nodes[i].kind]`
 * or after the last of occurence of `syntaxKind` if the last occurence is a sub child
 * of ts.SyntaxKind[nodes[i].kind] and save the changes in file.
 *
 * @param nodes insert after the last occurence of nodes
 * @param toInsert string to insert
 * @param file file to insert changes into
 * @param fallbackPos position to insert if toInsert happens to be the first occurence
 * @param syntaxKind the ts.SyntaxKind of the subchildren to insert after
 * @return Change instance
 * @throw Error if toInsert is first occurence but fall back is not set
 */
export function insertAfterLastOccurrence(
  nodes: ts.Node[],
  toInsert: string,
  file: string,
  fallbackPos: number,
  syntaxKind?: ts.SyntaxKind,
): Change {
  let lastItem = nodes.sort(nodesByPosition).pop();
  if (!lastItem) {
    throw new Error();
  }
  if (syntaxKind) {
    lastItem = findNodes(lastItem, syntaxKind)
      .sort(nodesByPosition)
      .pop();
  }
  if (!lastItem && fallbackPos == undefined) {
    throw new Error(
      `tried to insert ${toInsert} as first occurence with no fallback position`,
    );
  }
  const lastItemPosition: number = lastItem ? lastItem.end : fallbackPos;

  return new InsertChange(file, lastItemPosition, toInsert);
}

export function getContentOfKeyLiteral(
  _source: ts.SourceFile,
  node: ts.Node,
): string | null {
  if (node.kind == ts.SyntaxKind.Identifier) {
    return (node as ts.Identifier).text;
  } else if (node.kind == ts.SyntaxKind.StringLiteral) {
    return (node as ts.StringLiteral).text;
  } else {
    return null;
  }
}

function _angularImportsFromNode(
  node: ts.ImportDeclaration,
  _sourceFile: ts.SourceFile,
): { [name: string]: string } {
  const ms = node.moduleSpecifier;
  let modulePath: string;
  switch (ms.kind) {
    case ts.SyntaxKind.StringLiteral:
      modulePath = (ms as ts.StringLiteral).text;
      break;
    default:
      return {};
  }

  if (!modulePath.startsWith('@angular/')) {
    return {};
  }

  if (node.importClause) {
    if (node.importClause.name) {
      // This is of the form `import Name from 'path'`. Ignore.
      return {};
    } else if (node.importClause.namedBindings) {
      const nb = node.importClause.namedBindings;
      if (nb.kind == ts.SyntaxKind.NamespaceImport) {
        // This is of the form `import * as name from 'path'`. Return `name.`.
        return {
          [(nb as ts.NamespaceImport).name.text + '.']: modulePath,
        };
      } else {
        // This is of the form `import {a,b,c} from 'path'`
        const namedImports = nb as ts.NamedImports;

        return namedImports.elements
          .map((is: ts.ImportSpecifier) =>
            is.propertyName ? is.propertyName.text : is.name.text,
          )
          .reduce((acc: { [name: string]: string }, curr: string) => {
            acc[curr] = modulePath;

            return acc;
          }, {});
      }
    }

    return {};
  } else {
    // This is of the form `import 'path';`. Nothing to do.
    return {};
  }
}

export function getDecoratorMetadata(
  source: ts.SourceFile,
  identifier: string,
  module: string,
): ts.Node[] {
  const angularImports: { [name: string]: string } = findNodes(
    source,
    ts.SyntaxKind.ImportDeclaration,
  )
    .map((node: ts.ImportDeclaration) => _angularImportsFromNode(node, source))
    .reduce((acc: { [name: string]: string }, current: { [name: string]: string }) => {
      for (const key of Object.keys(current)) {
        acc[key] = current[key];
      }

      return acc;
    }, {});
  return getSourceNodes(source)
    .filter((node) => {
      return (
        node.kind == ts.SyntaxKind.Decorator &&
        (node as ts.Decorator).expression.kind == ts.SyntaxKind.CallExpression
      );
    })
    .map((node) => (node as ts.Decorator).expression as ts.CallExpression)
    .filter((expr) => {
      if (expr.expression.kind == ts.SyntaxKind.Identifier) {
        const id = expr.expression as ts.Identifier;

        return (
          id.getFullText(source) == identifier &&
          angularImports[id.getFullText(source)] === module
        );
      } else if (expr.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
        // This covers foo.NgModule when importing * as foo.
        const paExpr = expr.expression as ts.PropertyAccessExpression;
        // If the left expression is not an identifier, just give up at that point.
        if (paExpr.expression.kind !== ts.SyntaxKind.Identifier) {
          return false;
        }

        const id = paExpr.name.text;
        const moduleId = (paExpr.expression as ts.Identifier).getText(source);

        return id === identifier && angularImports[moduleId + '.'] === module;
      }

      return false;
    })
    .filter(
      (expr) =>
        expr.arguments[0] &&
        expr.arguments[0].kind == ts.SyntaxKind.ObjectLiteralExpression,
    )
    .map((expr) => expr.arguments[0] as ts.ObjectLiteralExpression);
}

export function addSymbolToNgModuleMetadata(
  source: ts.SourceFile,
  ngModulePath: string,
  metadataField: string,
  symbolName: string,
  importPath: string | null = null,
): Change[] {
  const nodes = getDecoratorMetadata(source, 'NgModule', '@angular/core');
  let node: any = nodes[0]; // tslint:disable-line:no-any
  // Find the decorator declaration.
  if (!node) {
    return [];
  }

  // Get all the children property assignment of object literals.
  const matchingProperties: ts.ObjectLiteralElement[] = (node as ts.ObjectLiteralExpression).properties
    .filter((prop) => prop.kind == ts.SyntaxKind.PropertyAssignment)
    // Filter out every fields that's not "metadataField". Also handles string literals
    // (but not expressions).
    .filter((prop: ts.PropertyAssignment) => {
      const name = prop.name;
      switch (name.kind) {
        case ts.SyntaxKind.Identifier:
          return (name as ts.Identifier).getText(source) == metadataField;
        case ts.SyntaxKind.StringLiteral:
          return (name as ts.StringLiteral).text == metadataField;
      }

      return false;
    });
  // Get the last node of the array literal.
  if (!matchingProperties) {
    return [];
  }
  if (matchingProperties.length == 0) {
    // We haven't found the field in the metadata declaration. Insert a new field.
    const expr = node as ts.ObjectLiteralExpression;
    let position: number;
    let toInsert: string;
    if (expr.properties.length == 0) {
      position = expr.getEnd() - 1;
      toInsert = `  ${metadataField}: [${symbolName}]\n`;
    } else {
      node = expr.properties[expr.properties.length - 1];
      position = node.getEnd();
      // Get the indentation of the last element, if any.
      const text = node.getFullText(source);
      const matches = text.match(/^\r?\n\s*/);
      if (matches.length > 0) {
        toInsert = `,${matches[0]}${metadataField}: [${symbolName}]`;
      } else {
        toInsert = `, ${metadataField}: [${symbolName}]`;
      }
    }
    if (importPath !== null) {
      return [
        new InsertChange(ngModulePath, position, toInsert),
        insertImport(source, ngModulePath, symbolName.replace(/\..*$/, ''), importPath),
      ];
    } else {
      return [new InsertChange(ngModulePath, position, toInsert)];
    }
  }
  const assignment = matchingProperties[0] as ts.PropertyAssignment;

  // If it's not an array, nothing we can do really.
  if (assignment.initializer.kind !== ts.SyntaxKind.ArrayLiteralExpression) {
    return [];
  }

  const arrLiteral = assignment.initializer as ts.ArrayLiteralExpression;
  if (arrLiteral.elements.length == 0) {
    // Forward the property.
    node = arrLiteral;
  } else {
    node = arrLiteral.elements;
  }

  if (!node) {
    console.log('No app module found. Please add your new class to your component.');

    return [];
  }

  if (Array.isArray(node)) {
    const nodeArray = (node as {}) as Array<ts.Node>;
    const symbolsArray = nodeArray.map((node) => node.getText());
    if (symbolsArray.includes(symbolName)) {
      return [];
    }
    node = node[node.length - 1];
  }

  let toInsert: string;
  let position = node.getEnd();
  if (node.kind == ts.SyntaxKind.ObjectLiteralExpression) {
    // We haven't found the field in the metadata declaration. Insert a new
    // field.
    const expr = node as ts.ObjectLiteralExpression;
    if (expr.properties.length == 0) {
      position = expr.getEnd() - 1;
      toInsert = `  ${metadataField}: [${symbolName}]\n`;
    } else {
      node = expr.properties[expr.properties.length - 1];
      position = node.getEnd();
      // Get the indentation of the last element, if any.
      const text = node.getFullText(source);
      if (text.match('^\r?\r?\n')) {
        toInsert = `,${text.match(/^\r?\n\s+/)[0]}${metadataField}: [${symbolName}]`;
      } else {
        toInsert = `, ${metadataField}: [${symbolName}]`;
      }
    }
  } else if (node.kind == ts.SyntaxKind.ArrayLiteralExpression) {
    // We found the field but it's empty. Insert it just before the `]`.
    position--;
    toInsert = `${symbolName}`;
  } else {
    // Get the indentation of the last element, if any.
    const text = node.getFullText(source);
    if (text.match(/^\r?\n/)) {
      toInsert = `,${text.match(/^\r?\n(\r?)\s+/)[0]}${symbolName}`;
    } else {
      toInsert = `, ${symbolName}`;
    }
  }
  if (importPath !== null) {
    return [
      new InsertChange(ngModulePath, position, toInsert),
      insertImport(source, ngModulePath, symbolName.replace(/\..*$/, ''), importPath),
    ];
  }

  return [new InsertChange(ngModulePath, position, toInsert)];
}

/**
 * Custom function to insert a declaration (component, pipe, directive)
 * into NgModule declarations. It also imports the component.
 */
export function addDeclarationToModule(
  source: ts.SourceFile,
  modulePath: string,
  classifiedName: string,
  importPath: string,
): Change[] {
  return addSymbolToNgModuleMetadata(
    source,
    modulePath,
    'declarations',
    classifiedName,
    importPath,
  );
}

/**
 * Custom function to insert an NgModule into NgModule imports. It also imports the module.
 */
export function addImportToModule(
  source: ts.SourceFile,
  modulePath: string,
  classifiedName: string,
  importPath: string,
): Change[] {
  return addSymbolToNgModuleMetadata(
    source,
    modulePath,
    'imports',
    classifiedName,
    importPath,
  );
}

/**
 * Custom function to insert a provider into NgModule. It also imports it.
 */
export function addProviderToModule(
  source: ts.SourceFile,
  modulePath: string,
  classifiedName: string,
  importPath: string,
): Change[] {
  return addSymbolToNgModuleMetadata(
    source,
    modulePath,
    'providers',
    classifiedName,
    importPath,
  );
}

/**
 * Custom function to insert an export into NgModule. It also imports it.
 */
export function addExportToModule(
  source: ts.SourceFile,
  modulePath: string,
  classifiedName: string,
  importPath: string,
): Change[] {
  return addSymbolToNgModuleMetadata(
    source,
    modulePath,
    'exports',
    classifiedName,
    importPath,
  );
}

/**
 * Custom function to insert an export into NgModule. It also imports it.
 */
export function addBootstrapToModule(
  source: ts.SourceFile,
  modulePath: string,
  classifiedName: string,
  importPath: string,
): Change[] {
  return addSymbolToNgModuleMetadata(
    source,
    modulePath,
    'bootstrap',
    classifiedName,
    importPath,
  );
}

/**
 * Determine if an import already exists.
 */
export function isImported(
  source: ts.SourceFile,
  classifiedName: string,
  importPath: string,
): boolean {
  const allNodes = getSourceNodes(source);
  const matchingNodes = allNodes
    .filter((node) => node.kind === ts.SyntaxKind.ImportDeclaration)
    .filter(
      (imp: ts.ImportDeclaration) =>
        imp.moduleSpecifier.kind === ts.SyntaxKind.StringLiteral,
    )
    .filter((imp: ts.ImportDeclaration) => {
      return (<ts.StringLiteral>imp.moduleSpecifier).text === importPath;
    })
    .filter((imp: ts.ImportDeclaration) => {
      if (!imp.importClause) {
        return false;
      }
      const nodes = findNodes(imp.importClause, ts.SyntaxKind.ImportSpecifier).filter(
        (n) => n.getText() === classifiedName,
      );

      return nodes.length > 0;
    });

  return matchingNodes.length > 0;
}

/**
 * Adds a member class to the component
 * @param source
 * @param componentPath
 * @param symbol
 * @param type
 * @param isPrivate
 */
export function addPropertyToComponent(
  source: ts.SourceFile,
  componentPath: string,
  symbol: string,
  type: string,
  value: string = undefined,
  isPrivate: boolean = false,
): Change {
  const constructor = findNodes(source, ts.SyntaxKind.ConstructorKeyword);
  let declaration = `\n\n ${isPrivate ? 'private' : ''} ${symbol}: ${type}`;
  declaration += `${value ? ' = ' + value : ''};`;
  return new InsertChange(componentPath, constructor[0].pos, declaration);
}

export function addFunctionToClass(
  source: ts.SourceFile,
  filePath: string,
  fnBody: string,
): Change {
  const classDeclaration = findNodes(source, ts.SyntaxKind.ClassDeclaration);
  return new InsertChange(filePath, classDeclaration[0].end - 1, fnBody);
}

// Juan, this is our custom setDecorator function
// we need to find the exact position where the Decorator lives. we do that by
// analyzing the AST of the typescript file using,  this tool is helpgul:
// https://ast.carlosroso.com/ (shameless self promotion)
export function setDecorator(
  source: ts.SourceFile,
  filePath: string,
  decorator: string,
): Change {
  const classDeclaration = findNodes(source, ts.SyntaxKind.ClassDeclaration);
  const _decorator: ts.Decorator = (classDeclaration[0] as ts.ClassDeclaration)
    .decorators[0];
  const argument = (_decorator.expression as ts.CallExpression).arguments;
  const { pos, end } = argument;
  return new ReplaceChange(
    filePath,
    pos,
    source.getFullText().substring(pos, end),
    decorator,
  );
}

export function getDecoratorObject(source: ts.SourceFile): string {
  const expressionDeclaration = findNodes(source, ts.SyntaxKind.VariableDeclarationList);
  const expression = (expressionDeclaration[0] as ts.VariableDeclarationList)
    .declarations[0].initializer;
  return expression.getText();
}

export function getDecoratorName(source: ts.SourceFile): string {
  const classDeclaration = findNodes(source, ts.SyntaxKind.ClassDeclaration);
  const decorator: ts.Decorator = (classDeclaration[0] as ts.ClassDeclaration)
    .decorators[0];
  const argument = (decorator.expression as ts.CallExpression).arguments[0].getText();
  return argument;
}

export function getDecoratorFileName(
  source: ts.SourceFile,
  path: string,
  decorator: string,
): string {
  const importDeclarations = findNodes(source, ts.SyntaxKind.ImportDeclaration);
  const importDeclaration = importDeclarations.find((importDeclaration) => {
    const importSections = (importDeclaration as ts.ImportDeclaration).importClause
      .namedBindings;
    const importText = (importSections as ts.NamedImports).elements[0].getText();
    return importText === decorator;
  });
  if (importDeclaration) {
    const importPath = (importDeclaration as ts.ImportDeclaration).moduleSpecifier.getText();
    return importPath.replace(/'/g, '').replace('./', '');
  } else {
    return null;
  }
}

export function addDependencyToClass(
  source: ts.SourceFile,
  filePath: string,
  symbol: string,
  symbolType: string,
) {
  const constructor = findNodes(source, ts.SyntaxKind.Constructor);
  let children = constructor[0].getChildren();

  const depBody = `private ${symbol}: ${symbolType}`;
  let numParams = 0;
  for (let i = 0; i < children.length; i++) {
    // assume the constructor SyntaxList comes before the close parentoken in the list
    if (children[i].kind === ts.SyntaxKind.SyntaxList) {
      numParams = _getNumDependencies(children[i]);
    }
    if (children[i].kind === ts.SyntaxKind.CloseParenToken) {
      let body = depBody;
      if (numParams > 0) {
        body = `, ${body}`;
      }
      return new InsertChange(filePath, children[i].pos, body);
    }
  }
  return new NoopChange();
}

export function addContentToMethod(
  source: ts.SourceFile,
  filePath: string,
  methodName: string,
  content: string,
) {
  const classDeclaration = findNodes(source, ts.SyntaxKind.ClassDeclaration);
  const method: ts.Node[] = (classDeclaration[0] as ts.ClassDeclaration).members
    .filter((node: ts.Node) => node.kind === ts.SyntaxKind.MethodDeclaration)
    .filter((method: ts.MethodDeclaration) => method.name.getText() === methodName);
  return new InsertChange(filePath, method[0].getEnd() - 1, `  ${content}\n  `);
}

/**
 * Returns the number of dependencies injected in a class
 * @param list - the SyntaxList node of the Constructor symbol
 */
function _getNumDependencies(list: ts.Node) {
  let num = 0;
  const children = list.getChildren();
  for (let i = 0; i < children.length; i++) {
    if (children[i].kind === ts.SyntaxKind.Parameter) {
      num++;
    }
  }
  return num;
}

export function addPathsToRoutingModule(
  source: ts.SourceFile,
  filePath: string,
  paths: string[],
) {
  // Find the first variable that has the :Routes type. We'll assume that such
  // variable is the array of routes.
  const varStatements = findNodes(source, ts.SyntaxKind.VariableStatement);
  const routesArray = varStatements.find((node: ts.VariableStatement) => {
    const nodeType = node.declarationList.declarations[0].type.getText();
    return nodeType === 'Routes';
  }) as ts.VariableStatement;

  // Check if there's already a path defined as "path: '**'"
  // If it does, then don't add the new route
  const _paths = routesArray.declarationList.declarations[0]
    .initializer as ts.ArrayLiteralExpression;
  let pathExists = false;
  for (let i = 0; i < _paths.elements.length && !pathExists; i++) {
    const path = _paths.elements[i] as ts.ObjectLiteralExpression;
    for (let j = 0; j < path.properties.length; j++) {
      const prop = path.properties[j] as ts.PropertyAssignment;
      if (
        prop.name.getText() === 'path' &&
        (prop.initializer.getText() === "'**'" || prop.initializer.getText() === "'404'")
      ) {
        pathExists = true;
      }
    }
  }
  const lastPath = _paths.elements[_paths.elements.length - 1];

  const text = lastPath.getFullText(source);

  const content = `${paths.join(',\n  ')}`;
  let toInsert;
  // match indentantion if any
  if (text.match(/^\r?\n/)) {
    toInsert = `,${text.match(/^\r?\n(\r?)\s+/)[0]}${content}`;
  } else {
    toInsert = `, ${content}`;
  }

  if (pathExists) {
    throw new Error(`Error updating paths. Path '**' or '404' already exist.`);
  }
  return new InsertChange(filePath, lastPath.getEnd(), toInsert);
}

// https://dsherret.github.io/ts-ast-viewer/
