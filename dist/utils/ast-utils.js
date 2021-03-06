"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const change_1 = require("./change");
const route_utils_1 = require("./route-utils");
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
function findNodes(node, kind, max = Infinity) {
    if (!node || max == 0) {
        return [];
    }
    const arr = [];
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
exports.findNodes = findNodes;
/**
 * Get all the nodes from a source.
 * @param sourceFile The source file object.
 * @returns {Observable<ts.Node>} An observable of all the nodes in the source.
 */
function getSourceNodes(sourceFile) {
    const nodes = [sourceFile];
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
exports.getSourceNodes = getSourceNodes;
function findNode(node, kind, text) {
    if (node.kind === kind && node.getText() === text) {
        // throw new Error(node.getText());
        return node;
    }
    let foundNode = null;
    ts.forEachChild(node, (childNode) => {
        foundNode = foundNode || findNode(childNode, kind, text);
    });
    return foundNode;
}
exports.findNode = findNode;
/**
 * Helper for sorting nodes.
 * @return function to sort nodes in increasing order of position in sourceFile
 */
function nodesByPosition(first, second) {
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
function insertAfterLastOccurrence(nodes, toInsert, file, fallbackPos, syntaxKind) {
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
        throw new Error(`tried to insert ${toInsert} as first occurence with no fallback position`);
    }
    const lastItemPosition = lastItem ? lastItem.end : fallbackPos;
    return new change_1.InsertChange(file, lastItemPosition, toInsert);
}
exports.insertAfterLastOccurrence = insertAfterLastOccurrence;
function getContentOfKeyLiteral(_source, node) {
    if (node.kind == ts.SyntaxKind.Identifier) {
        return node.text;
    }
    else if (node.kind == ts.SyntaxKind.StringLiteral) {
        return node.text;
    }
    else {
        return null;
    }
}
exports.getContentOfKeyLiteral = getContentOfKeyLiteral;
function _angularImportsFromNode(node, _sourceFile) {
    const ms = node.moduleSpecifier;
    let modulePath;
    switch (ms.kind) {
        case ts.SyntaxKind.StringLiteral:
            modulePath = ms.text;
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
        }
        else if (node.importClause.namedBindings) {
            const nb = node.importClause.namedBindings;
            if (nb.kind == ts.SyntaxKind.NamespaceImport) {
                // This is of the form `import * as name from 'path'`. Return `name.`.
                return {
                    [nb.name.text + '.']: modulePath
                };
            }
            else {
                // This is of the form `import {a,b,c} from 'path'`
                const namedImports = nb;
                return namedImports.elements
                    .map((is) => is.propertyName ? is.propertyName.text : is.name.text)
                    .reduce((acc, curr) => {
                    acc[curr] = modulePath;
                    return acc;
                }, {});
            }
        }
        return {};
    }
    else {
        // This is of the form `import 'path';`. Nothing to do.
        return {};
    }
}
function getDecoratorMetadata(source, identifier, module) {
    const angularImports = findNodes(source, ts.SyntaxKind.ImportDeclaration)
        .map((node) => _angularImportsFromNode(node, source))
        .reduce((acc, current) => {
        for (const key of Object.keys(current)) {
            acc[key] = current[key];
        }
        return acc;
    }, {});
    return getSourceNodes(source)
        .filter((node) => {
        return (node.kind == ts.SyntaxKind.Decorator &&
            node.expression.kind == ts.SyntaxKind.CallExpression);
    })
        .map((node) => node.expression)
        .filter((expr) => {
        if (expr.expression.kind == ts.SyntaxKind.Identifier) {
            const id = expr.expression;
            return (id.getFullText(source) == identifier &&
                angularImports[id.getFullText(source)] === module);
        }
        else if (expr.expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
            // This covers foo.NgModule when importing * as foo.
            const paExpr = expr.expression;
            // If the left expression is not an identifier, just give up at that point.
            if (paExpr.expression.kind !== ts.SyntaxKind.Identifier) {
                return false;
            }
            const id = paExpr.name.text;
            const moduleId = paExpr.expression.getText(source);
            return id === identifier && angularImports[moduleId + '.'] === module;
        }
        return false;
    })
        .filter((expr) => expr.arguments[0] &&
        expr.arguments[0].kind == ts.SyntaxKind.ObjectLiteralExpression)
        .map((expr) => expr.arguments[0]);
}
exports.getDecoratorMetadata = getDecoratorMetadata;
function addSymbolToNgModuleMetadata(source, ngModulePath, metadataField, symbolName, importPath = null) {
    const nodes = getDecoratorMetadata(source, 'NgModule', '@angular/core');
    let node = nodes[0]; // tslint:disable-line:no-any
    // Find the decorator declaration.
    if (!node) {
        return [];
    }
    // Get all the children property assignment of object literals.
    const matchingProperties = node.properties
        .filter((prop) => prop.kind == ts.SyntaxKind.PropertyAssignment)
        // Filter out every fields that's not "metadataField". Also handles string literals
        // (but not expressions).
        .filter((prop) => {
        const name = prop.name;
        switch (name.kind) {
            case ts.SyntaxKind.Identifier:
                return name.getText(source) == metadataField;
            case ts.SyntaxKind.StringLiteral:
                return name.text == metadataField;
        }
        return false;
    });
    // Get the last node of the array literal.
    if (!matchingProperties) {
        return [];
    }
    if (matchingProperties.length == 0) {
        // We haven't found the field in the metadata declaration. Insert a new field.
        const expr = node;
        let position;
        let toInsert;
        if (expr.properties.length == 0) {
            position = expr.getEnd() - 1;
            toInsert = `  ${metadataField}: [${symbolName}]\n`;
        }
        else {
            node = expr.properties[expr.properties.length - 1];
            position = node.getEnd();
            // Get the indentation of the last element, if any.
            const text = node.getFullText(source);
            const matches = text.match(/^\r?\n\s*/);
            if (matches.length > 0) {
                toInsert = `,${matches[0]}${metadataField}: [${symbolName}]`;
            }
            else {
                toInsert = `, ${metadataField}: [${symbolName}]`;
            }
        }
        if (importPath !== null) {
            return [
                new change_1.InsertChange(ngModulePath, position, toInsert),
                route_utils_1.insertImport(source, ngModulePath, symbolName.replace(/\..*$/, ''), importPath)
            ];
        }
        else {
            return [new change_1.InsertChange(ngModulePath, position, toInsert)];
        }
    }
    const assignment = matchingProperties[0];
    // If it's not an array, nothing we can do really.
    if (assignment.initializer.kind !== ts.SyntaxKind.ArrayLiteralExpression) {
        return [];
    }
    const arrLiteral = assignment.initializer;
    if (arrLiteral.elements.length == 0) {
        // Forward the property.
        node = arrLiteral;
    }
    else {
        node = arrLiteral.elements;
    }
    if (!node) {
        console.log('No app module found. Please add your new class to your component.');
        return [];
    }
    if (Array.isArray(node)) {
        const nodeArray = node;
        const symbolsArray = nodeArray.map((node) => node.getText());
        if (symbolsArray.includes(symbolName)) {
            return [];
        }
        node = node[node.length - 1];
    }
    let toInsert;
    let position = node.getEnd();
    if (node.kind == ts.SyntaxKind.ObjectLiteralExpression) {
        // We haven't found the field in the metadata declaration. Insert a new
        // field.
        const expr = node;
        if (expr.properties.length == 0) {
            position = expr.getEnd() - 1;
            toInsert = `  ${metadataField}: [${symbolName}]\n`;
        }
        else {
            node = expr.properties[expr.properties.length - 1];
            position = node.getEnd();
            // Get the indentation of the last element, if any.
            const text = node.getFullText(source);
            if (text.match('^\r?\r?\n')) {
                toInsert = `,${text.match(/^\r?\n\s+/)[0]}${metadataField}: [${symbolName}]`;
            }
            else {
                toInsert = `, ${metadataField}: [${symbolName}]`;
            }
        }
    }
    else if (node.kind == ts.SyntaxKind.ArrayLiteralExpression) {
        // We found the field but it's empty. Insert it just before the `]`.
        position--;
        toInsert = `${symbolName}`;
    }
    else {
        // Get the indentation of the last element, if any.
        const text = node.getFullText(source);
        if (text.match(/^\r?\n/)) {
            toInsert = `,${text.match(/^\r?\n(\r?)\s+/)[0]}${symbolName}`;
        }
        else {
            toInsert = `, ${symbolName}`;
        }
    }
    if (importPath !== null) {
        return [
            new change_1.InsertChange(ngModulePath, position, toInsert),
            route_utils_1.insertImport(source, ngModulePath, symbolName.replace(/\..*$/, ''), importPath)
        ];
    }
    return [new change_1.InsertChange(ngModulePath, position, toInsert)];
}
exports.addSymbolToNgModuleMetadata = addSymbolToNgModuleMetadata;
/**
 * Custom function to insert a declaration (component, pipe, directive)
 * into NgModule declarations. It also imports the component.
 */
function addDeclarationToModule(source, modulePath, classifiedName, importPath) {
    return addSymbolToNgModuleMetadata(source, modulePath, 'declarations', classifiedName, importPath);
}
exports.addDeclarationToModule = addDeclarationToModule;
/**
 * Custom function to insert an NgModule into NgModule imports. It also imports the module.
 */
function addImportToModule(source, modulePath, classifiedName, importPath) {
    return addSymbolToNgModuleMetadata(source, modulePath, 'imports', classifiedName, importPath);
}
exports.addImportToModule = addImportToModule;
/**
 * Custom function to insert a provider into NgModule. It also imports it.
 */
function addProviderToModule(source, modulePath, classifiedName, importPath) {
    return addSymbolToNgModuleMetadata(source, modulePath, 'providers', classifiedName, importPath);
}
exports.addProviderToModule = addProviderToModule;
/**
 * Custom function to insert an export into NgModule. It also imports it.
 */
function addExportToModule(source, modulePath, classifiedName, importPath) {
    return addSymbolToNgModuleMetadata(source, modulePath, 'exports', classifiedName, importPath);
}
exports.addExportToModule = addExportToModule;
/**
 * Custom function to insert an export into NgModule. It also imports it.
 */
function addBootstrapToModule(source, modulePath, classifiedName, importPath) {
    return addSymbolToNgModuleMetadata(source, modulePath, 'bootstrap', classifiedName, importPath);
}
exports.addBootstrapToModule = addBootstrapToModule;
/**
 * Determine if an import already exists.
 */
function isImported(source, classifiedName, importPath) {
    const allNodes = getSourceNodes(source);
    const matchingNodes = allNodes
        .filter((node) => node.kind === ts.SyntaxKind.ImportDeclaration)
        .filter((imp) => imp.moduleSpecifier.kind === ts.SyntaxKind.StringLiteral)
        .filter((imp) => {
        return imp.moduleSpecifier.text === importPath;
    })
        .filter((imp) => {
        if (!imp.importClause) {
            return false;
        }
        const nodes = findNodes(imp.importClause, ts.SyntaxKind.ImportSpecifier).filter((n) => n.getText() === classifiedName);
        return nodes.length > 0;
    });
    return matchingNodes.length > 0;
}
exports.isImported = isImported;
/**
 * Adds a member class to the component
 * @param source
 * @param componentPath
 * @param symbol
 * @param type
 * @param isPrivate
 */
function addPropertyToComponent(source, componentPath, symbol, type, value = undefined, isPrivate = false) {
    const constructor = findNodes(source, ts.SyntaxKind.ConstructorKeyword);
    let declaration = `\n\n ${isPrivate ? 'private' : ''} ${symbol}: ${type}`;
    declaration += `${value ? ' = ' + value : ''};`;
    return new change_1.InsertChange(componentPath, constructor[0].pos, declaration);
}
exports.addPropertyToComponent = addPropertyToComponent;
function addFunctionToClass(source, filePath, fnBody) {
    const classDeclaration = findNodes(source, ts.SyntaxKind.ClassDeclaration);
    return new change_1.InsertChange(filePath, classDeclaration[0].end - 1, fnBody);
}
exports.addFunctionToClass = addFunctionToClass;
// Juan, this is our custom setDecorator function
// we need to find the exact position where the Decorator lives. we do that by
// analyzing the AST of the typescript file using,  this tool is helpgul:
// https://ast.carlosroso.com/ (shameless self promotion)
function setDecorator(source, filePath, decorator) {
    const classDeclaration = findNodes(source, ts.SyntaxKind.ClassDeclaration);
    const _decorator = classDeclaration[0]
        .decorators[0];
    const argument = _decorator.expression.arguments[0];
    const { pos, end } = argument;
    return new change_1.ReplaceChange(filePath, pos, source.getFullText().substring(pos, end), decorator);
}
exports.setDecorator = setDecorator;
function getDecoratorObject(source, decoratorName) {
    const expressionDeclaration = findNodes(source, ts.SyntaxKind.VariableDeclarationList);
    const decoratorObject = expressionDeclaration.find((node) => {
        const name = node.declarations[0].name.getText();
        return name === decoratorName;
    });
    const expression = decoratorObject.declarations[0]
        .initializer;
    return expression.getText();
}
exports.getDecoratorObject = getDecoratorObject;
function getDecoratorName(source) {
    const classDeclaration = findNodes(source, ts.SyntaxKind.ClassDeclaration)[0];
    if (classDeclaration && classDeclaration.decorators) {
        const decorator = classDeclaration
            .decorators[0];
        const argument = decorator.expression.arguments[0].getText();
        return argument;
    }
    return null;
}
exports.getDecoratorName = getDecoratorName;
function getDecoratorImportPath(source, decorator) {
    const importDeclarations = findNodes(source, ts.SyntaxKind.ImportDeclaration);
    const importDeclaration = importDeclarations.find((importDeclaration) => {
        if (importDeclaration.importClause &&
            importDeclaration.importClause.namedBindings) {
            const importSections = importDeclaration.importClause
                .namedBindings;
            if (importSections.elements) {
                return importSections.elements[0].getText() === decorator;
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }
    });
    if (importDeclaration) {
        const importPath = importDeclaration.moduleSpecifier.getText();
        return importPath.replace(/'/g, '');
    }
    else {
        return null;
    }
}
exports.getDecoratorImportPath = getDecoratorImportPath;
function removeBasePathFromDecorator(source) {
    if (source.includes('templateUrl') && source.includes('styleUrls')) {
        const parseableDecorator = makeParseable(source);
        const decorator = JSON.parse(parseableDecorator);
        decorator.templateUrl = removeBasePath(decorator.templateUrl);
        decorator.styleUrls[0] = removeBasePath(decorator.styleUrls[0]);
        decorator.styleUrls[0] = changeToScss(decorator.styleUrls[0]);
        if (decorator.animations) {
            delete decorator.animations;
        }
        const decoratorString = JSON.stringify(decorator);
        return unFormatString(decoratorString);
    }
    return source;
}
exports.removeBasePathFromDecorator = removeBasePathFromDecorator;
function changeToScss(path) {
    if (!path.includes('.scss')) {
        return path.replace('.css', '.scss');
    }
    return path;
}
function removeBasePath(path) {
    const filePathIndex = path.lastIndexOf('/');
    return '.' + path.substring(filePathIndex, path.length);
}
function makeParseable(decorator) {
    decorator = decorator.replace('selector', '"selector"');
    decorator = decorator.replace('moduleId', '"moduleId"');
    decorator = decorator.replace('module.id', '"module.id"');
    decorator = decorator.replace('changeDetection', '"changeDetection"');
    decorator = decorator.replace('ChangeDetectionStrategy.OnPush', '"ChangeDetectionStrategy.OnPush"');
    decorator = decorator.replace('templateUrl', '"templateUrl"');
    decorator = decorator.replace('styleUrls', '"styleUrls"');
    decorator = decorator.replace('providers', '"providers"');
    if (decorator.includes('providers')) {
        let [firstPart, secondPart] = decorator.split('providers');
        secondPart = secondPart.replace('[', "'[");
        secondPart = secondPart.replace(']', "]'");
        decorator = `${firstPart}providers${secondPart}`;
    }
    decorator = decorator.replace('animations', '"animations"');
    if (decorator.includes('animations')) {
        let [firstPart, secondPart] = decorator.split('animations');
        secondPart = secondPart.replace('[', "'[");
        secondPart = secondPart.replace(']', "]'");
        decorator = `${firstPart}animations${secondPart}`;
    }
    if (decorator.match(/, *((\n|\r|\t| )*)*}/g)) {
        decorator = decorator.replace(/,([^,]*)$/, '$1');
    }
    decorator = decorator.replace(/'/g, '"');
    return decorator;
}
function unFormatString(decorator) {
    decorator = decorator.replace('"selector"', 'selector');
    decorator = decorator.replace('"moduleId"', 'moduleId');
    decorator = decorator.replace('"module.id"', 'module.id');
    decorator = decorator.replace('"templateUrl"', 'templateUrl');
    decorator = decorator.replace('"styleUrls"', 'styleUrls');
    decorator = decorator.replace('"changeDetection"', 'changeDetection');
    decorator = decorator.replace('"ChangeDetectionStrategy.OnPush"', 'ChangeDetectionStrategy.OnPush');
    decorator = decorator.replace('"providers"', 'providers');
    if (decorator.includes('providers')) {
        let [firstPart, secondPart] = decorator.split('providers');
        secondPart = secondPart.replace('"[', '[');
        secondPart = secondPart.replace(']"', ']');
        decorator = `${firstPart}providers${secondPart}`;
    }
    decorator = decorator.replace('"animations"', 'animations');
    if (decorator.includes('animations')) {
        let [firstPart, secondPart] = decorator.split('animations');
        secondPart = secondPart.replace('"[', '[');
        secondPart = secondPart.replace(']"', ']');
        decorator = `${firstPart}animations${secondPart}`;
    }
    decorator = decorator.replace(/"/g, "'");
    return decorator;
}
function addDependencyToClass(source, filePath, symbol, symbolType) {
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
            return new change_1.InsertChange(filePath, children[i].pos, body);
        }
    }
    return new change_1.NoopChange();
}
exports.addDependencyToClass = addDependencyToClass;
function addContentToMethod(source, filePath, methodName, content) {
    const classDeclaration = findNodes(source, ts.SyntaxKind.ClassDeclaration);
    const method = classDeclaration[0].members
        .filter((node) => node.kind === ts.SyntaxKind.MethodDeclaration)
        .filter((method) => method.name.getText() === methodName);
    return new change_1.InsertChange(filePath, method[0].getEnd() - 1, `  ${content}\n  `);
}
exports.addContentToMethod = addContentToMethod;
/**
 * Returns the number of dependencies injected in a class
 * @param list - the SyntaxList node of the Constructor symbol
 */
function _getNumDependencies(list) {
    let num = 0;
    const children = list.getChildren();
    for (let i = 0; i < children.length; i++) {
        if (children[i].kind === ts.SyntaxKind.Parameter) {
            num++;
        }
    }
    return num;
}
function addPathsToRoutingModule(source, filePath, paths) {
    // Find the first variable that has the :Routes type. We'll assume that such
    // variable is the array of routes.
    const varStatements = findNodes(source, ts.SyntaxKind.VariableStatement);
    const routesArray = varStatements.find((node) => {
        const nodeType = node.declarationList.declarations[0].type.getText();
        return nodeType === 'Routes';
    });
    // Check if there's already a path defined as "path: '**'"
    // If it does, then don't add the new route
    const _paths = routesArray.declarationList.declarations[0]
        .initializer;
    let pathExists = false;
    for (let i = 0; i < _paths.elements.length && !pathExists; i++) {
        const path = _paths.elements[i];
        for (let j = 0; j < path.properties.length; j++) {
            const prop = path.properties[j];
            if (prop.name.getText() === 'path' &&
                (prop.initializer.getText() === "'**'" || prop.initializer.getText() === "'404'")) {
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
    }
    else {
        toInsert = `, ${content}`;
    }
    if (pathExists) {
        throw new Error(`Error updating paths. Path '**' or '404' already exist.`);
    }
    return new change_1.InsertChange(filePath, lastPath.getEnd(), toInsert);
}
exports.addPathsToRoutingModule = addPathsToRoutingModule;
// https://dsherret.github.io/ts-ast-viewer/
