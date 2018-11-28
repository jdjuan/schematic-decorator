"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ast_utils_1 = require("./ast-utils");
const change_1 = require("./change");
const ts = require("typescript");
exports.defaultCustomNgxPath = '/src/app/custom/ngx-custom.module.ts';
/**
 * Adds modules to the NgModule decorator of the ngx-df-custom.module
 * @param modules - an array of modules names to be added, e.g ['DfCardModule', 'DfTableModule']
 * @param [addToImports=true] -  whether or not to add the modules to imports
 * @param [addToExports=true] - whether or not to add the modules to exports
 * @param [filePath] - path of the ngx-df-custom.module file in the project, from root
 * @returns
 */
function addModulesToNgxDfCustom(modules, addToImports = true, addToExports = true, ngxCustomPath = exports.defaultCustomNgxPath) {
    return addModulesToModule(modules, '@devfactory/ngx-df', addToImports, addToExports, ngxCustomPath);
}
exports.addModulesToNgxDfCustom = addModulesToNgxDfCustom;
function addModulesToModule(modules, importFrom, addToImports, addToExports, sourceModulePath) {
    return (tree) => {
        const path = sourceModulePath;
        const pathText = tree.read(path).toString('utf-8');
        const pathSource = ts.createSourceFile(path, pathText, ts.ScriptTarget.Latest, true);
        const changeRecorder = tree.beginUpdate(path);
        // Add each df module in the `imports` and `exports` of the NgModule decorator
        const changes = modules.reduce((_changes, module) => {
            const params = [pathSource, path, module, importFrom];
            const imports = addToImports ? ast_utils_1.addImportToModule.apply(null, params) : [];
            if (addToImports) {
                // If it was added to `imports`, then we no longer need to import the module
                // at the header, so we set the import path as undefined
                params[3] = undefined;
            }
            const exports = addToExports ? ast_utils_1.addExportToModule.apply(null, params) : [];
            return [
                ..._changes,
                ...imports,
                ...exports
            ];
        }, []);
        // Execute all the changes
        for (const change of changes) {
            if (change instanceof change_1.InsertChange) {
                changeRecorder.insertLeft(change.pos, change.toAdd);
            }
        }
        tree.commitUpdate(changeRecorder);
        return tree;
    };
}
exports.addModulesToModule = addModulesToModule;
