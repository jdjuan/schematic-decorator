"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const change_1 = require("../utils/change");
const route_utils_1 = require("../utils/route-utils");
const ast_utils_1 = require("../utils/ast-utils");
function default_1() {
    return (_tree, _context) => {
        const allComponents = _recurse(_tree.getDir('src/app'), 
        // _tree.getDir('app/base/movements/movements-module/components/movements'),
        '.component.ts');
        const changes = [];
        allComponents.forEach((component) => {
            const exportRecorder = _tree.beginUpdate(component.fullPath);
            changes.push(...replaceDecoratorWithObject(component, _tree));
            for (const change of changes) {
                if (change instanceof change_1.InsertChange) {
                    exportRecorder.insertLeft(change.pos, change.toAdd);
                }
                if (change instanceof change_1.ReplaceChange) {
                    exportRecorder.remove(change.pos, change.oldText.length);
                    exportRecorder.insertLeft(change.pos, change.newText);
                }
            }
            _tree.commitUpdate(exportRecorder);
        });
        return _tree;
    };
}
exports.default = default_1;
function replaceDecoratorWithObject(component, _tree) {
    const sourceText = _tree.read(component.fullPath).toString('utf-8');
    const source = ts.createSourceFile(component.fullPath, sourceText, ts.ScriptTarget.Latest, true);
    const decoratorName = ast_utils_1.getDecoratorName(source);
    // console.log('decoratorName');
    // console.log(decoratorName);
    const decoratorFileName = ast_utils_1.getDecoratorFileName(source, component.fullPath, decoratorName);
    // console.log('decoratorFileName');
    // console.log(decoratorFileName);
    // If it is an imported decorator
    if (decoratorFileName) {
        // console.log('component.path');
        // console.log(component.path);
        // console.log('decoratorFileName');
        // console.log(decoratorFileName);
        const decoratorFilePath = `${component.path}/${decoratorFileName}.ts`;
        // console.log('decoratorFilePath');
        // console.log(decoratorFilePath);
        const decoratorFile = readDecoratorFile(_tree, decoratorFilePath);
        const decoratorObject = ast_utils_1.getDecoratorObject(decoratorFile, decoratorName);
        // console.log('decoratorObject');
        // console.log(decoratorObject);
        const formattedDecorator = ast_utils_1.removeBasePathFromDecorator(decoratorObject);
        // console.log('formattedDecorator');
        // console.log(formattedDecorator);
        const changes = [];
        changes.push(ast_utils_1.setDecorator(source, component.fullPath, formattedDecorator));
        if (!ast_utils_1.isImported(source, 'ChangeDetectionStrategy', '@angular/core')) {
            const importChangeDetection = route_utils_1.insertImport(source, component.fullPath, 'ChangeDetectionStrategy', '@angular/core');
            changes.push(importChangeDetection);
        }
        return changes;
    }
    return [];
}
function _recurse(dir, endsWith) {
    return [
        ...dir.subfiles
            .filter((fileName) => fileName.endsWith(endsWith))
            .map((fileName) => ({
            path: dir.path,
            file: fileName,
            fullPath: `${dir.path}/${fileName}`,
        })),
        ...[].concat(...dir.subdirs.map((x) => _recurse(dir.dir(x), endsWith))),
    ];
}
function readDecoratorFile(_tree, decoratorPath) {
    const metaDecoratorSourceText = _tree.read(decoratorPath).toString('utf-8');
    const metaDecoratorSource = ts.createSourceFile(decoratorPath, metaDecoratorSourceText, ts.ScriptTarget.Latest, true);
    return metaDecoratorSource;
}
