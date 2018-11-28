"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const change_1 = require("../utils/change");
const ast_utils_1 = require("../utils/ast-utils");
const ts = require("typescript");
const fn_body_1 = require("./fn-body");
const route_utils_1 = require("../utils/route-utils");
function default_1(options) {
    return (_tree, _context) => {
        // Juan, I had built this example to get the path from '--service /my/service/path'. 
        // that's why it gets it from .service, but you can change this as you want
        // you can even read all the paths with a '.component' string in the name or something
        let path = options.service;
        const sourceText = _tree.read(path).toString('utf-8');
        const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true);
        const exportRecorder = _tree.beginUpdate(path);
        const changes = [];
        let addFunctionChange = ast_utils_1.addFunctionToClass(source, path, fn_body_1.BASIC_DATA_FETCHING);
        changes.push(addFunctionChange);
        // Juan, this is where we change the decorator
        let setDectoratorChange = ast_utils_1.setDecorator(source, path, fn_body_1.NEW_DECORATOR);
        // we push this 'change' to the queue of changes that will be executed later on
        changes.push(setDectoratorChange);
        let importChange = [
            route_utils_1.insertImport(source, path, 'Observable', 'rxjs/Observable'),
            route_utils_1.insertImport(source, path, 'HttpClient', '@angular/common/http'),
            route_utils_1.insertImport(source, path, 'MOCK_DATA', './data.mock'),
            route_utils_1.insertImport(source, path, undefined, 'rxjs/add/operator/map', false, true)
        ];
        changes.push(...importChange);
        let dependencyChange = ast_utils_1.addDependencyToClass(source, path, 'http', 'HttpClient');
        changes.push(dependencyChange);
        for (const change of changes) {
            if (change instanceof change_1.InsertChange) {
                exportRecorder.insertLeft(change.pos, change.toAdd);
            }
            if (change instanceof change_1.ReplaceChange) {
                // Juan, this is where we replace the content in 2 steps (remove old content, insert new content)
                exportRecorder.remove(change.pos, change.oldText.length);
                exportRecorder.insertLeft(change.pos, change.newText);
            }
        }
        _tree.commitUpdate(exportRecorder);
        return _tree;
    };
}
exports.default = default_1;
