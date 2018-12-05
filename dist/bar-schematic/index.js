"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const change_1 = require("../utils/change");
const ast_utils_1 = require("../utils/ast-utils");
function default_1() {
    return (_tree, _context) => {
        const allComponents = _recurse(_tree.getDir('src/app'), '.component.ts');
        const changes = [];
        allComponents.forEach((component) => {
            const exportRecorder = _tree.beginUpdate(component.fullPath);
            changes.push(replaceDecoratorWithObject(component, _tree));
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
    const decoratorFileName = ast_utils_1.getDecoratorFileName(source, component.fullPath, decoratorName);
    // If it is an imported decorator
    if (decoratorFileName) {
        const decoratorFilePath = `${component.path}/${decoratorFileName}.ts`;
        const decoratorFile = readDecoratorFile(_tree, decoratorFilePath);
        const decoratorObject = ast_utils_1.getDecoratorObject(decoratorFile);
        console.log(decoratorObject);
        return ast_utils_1.setDecorator(source, component.fullPath, decoratorObject);
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
