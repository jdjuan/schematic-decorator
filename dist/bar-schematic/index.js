"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const change_1 = require("../utils/change");
const ast_utils_1 = require("../utils/ast-utils");
const route_utils_1 = require("../utils/route-utils");
function default_1() {
    return (_tree, _context) => {
        const route = 'app/base';
        const allComponents = _recurse(_tree.getDir(route), '.component.ts');
        const replaceComponentDecorator = (component) => replaceDecorator(component, _tree);
        allComponents.forEach(replaceComponentDecorator);
        return _tree;
    };
}
exports.default = default_1;
function replaceDecorator(component, _tree) {
    const exportRecorder = _tree.beginUpdate(component.fullPath);
    let changes = replaceDecoratorWithObject(component, _tree);
    if (changes) {
        for (const change of changes) {
            if (change instanceof change_1.InsertChange) {
                exportRecorder.insertLeft(change.pos, change.toAdd);
            }
            if (change instanceof change_1.ReplaceChange) {
                exportRecorder.remove(change.pos, change.oldText.length);
                exportRecorder.insertLeft(change.pos, change.newText);
            }
        }
    }
    _tree.commitUpdate(exportRecorder);
}
function replaceDecoratorWithObject(component, _tree) {
    const sourceText = _tree.read(component.fullPath).toString('utf-8');
    const source = ts.createSourceFile(component.fullPath, sourceText, ts.ScriptTarget.Latest, true);
    const decoratorName = ast_utils_1.getDecoratorName(source);
    // if the component actually has a decorator
    if (decoratorName) {
        const decoratorPath = ast_utils_1.getDecoratorImportPath(source, decoratorName);
        // If it is an imported decorator
        if (decoratorPath) {
            const formattedDecoratorPath = formatAbsolutePath(decoratorPath, component);
            const decoratorFile = readDecoratorFile(_tree, formattedDecoratorPath);
            const decoratorObject = ast_utils_1.getDecoratorObject(decoratorFile, decoratorName);
            const decorator = ast_utils_1.removeBasePathFromDecorator(decoratorObject);
            const changes = [];
            changes.push(ast_utils_1.setDecorator(source, component.fullPath, decorator));
            changes.push(addChangeDetectionImport(source, component));
            return changes;
        }
        return [];
    }
}
function formatAbsolutePath(decoratorImportPath, component) {
    let decoratorFilePath = '';
    if (decoratorImportPath.startsWith('~')) {
        const absolutePath = decoratorImportPath.substring(1, decoratorImportPath.length);
        decoratorFilePath = `app/${absolutePath}.ts`;
    }
    else {
        decoratorFilePath = `${component.path}/${decoratorImportPath}.ts`;
    }
    return decoratorFilePath;
}
function addChangeDetectionImport(source, component) {
    if (!ast_utils_1.isImported(source, 'ChangeDetectionStrategy', '@angular/core')) {
        return route_utils_1.insertImport(source, component.fullPath, 'ChangeDetectionStrategy', '@angular/core');
    }
    return null;
}
function _recurse(dir, endsWith) {
    return [
        ...dir.subfiles
            .filter((fileName) => fileName.endsWith(endsWith))
            .map((fileName) => ({
            path: dir.path,
            file: fileName,
            fullPath: `${dir.path}/${fileName}`
        })),
        ...[].concat(...dir.subdirs.map((x) => _recurse(dir.dir(x), endsWith)))
    ];
}
function readDecoratorFile(_tree, decoratorPath) {
    const metaDecoratorSourceText = _tree.read(decoratorPath).toString('utf-8');
    const metaDecoratorSource = ts.createSourceFile(decoratorPath, metaDecoratorSourceText, ts.ScriptTarget.Latest, true);
    return metaDecoratorSource;
}
