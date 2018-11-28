import { InsertChange, Change, ReplaceChange } from '../utils/change';
import {
  Rule,
  Tree,
  SchematicContext,
} from '@angular-devkit/schematics';

import { addFunctionToClass, addDependencyToClass, setDecorator } from '../utils/ast-utils';
import * as ts from 'typescript';
import { BASIC_DATA_FETCHING, NEW_DECORATOR } from './fn-body';
import { insertImport } from '../utils/route-utils';


export default function (options: any): Rule { 
  return (_tree: Tree, _context: SchematicContext) => {
    // Juan, I had built this example to get the path from '--service /my/service/path'. 
    // that's why it gets it from .service, but you can change this as you want
    // you can even read all the paths with a '.component' string in the name or something
    let path = options.service;
    const sourceText = _tree.read(path)!.toString('utf-8');
    const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true);

    const exportRecorder = _tree.beginUpdate(path);
    const changes: Change[] = [];

    let addFunctionChange = addFunctionToClass(source, path, BASIC_DATA_FETCHING);
    changes.push(addFunctionChange);

    // Juan, this is where we change the decorator
    let setDectoratorChange = setDecorator(source, path, NEW_DECORATOR);
    // we push this 'change' to the queue of changes that will be executed later on
    changes.push(setDectoratorChange);

    let importChange = [
      insertImport(source, path, 'Observable', 'rxjs/Observable'),
      insertImport(source, path, 'HttpClient', '@angular/common/http'),
      insertImport(source, path, 'MOCK_DATA', './data.mock'),
      insertImport(source, path, undefined as any, 'rxjs/add/operator/map', false, true)
    ];
    changes.push(...importChange);

    let dependencyChange = addDependencyToClass(source, path, 'http', 'HttpClient');
    changes.push(dependencyChange);

    for (const change of changes) {
      if (change instanceof InsertChange) {
        exportRecorder.insertLeft(change.pos, change.toAdd);
      }
      if (change instanceof ReplaceChange) {
        // Juan, this is where we replace the content in 2 steps (remove old content, insert new content)
        exportRecorder.remove(change.pos, change.oldText.length);
        exportRecorder.insertLeft(change.pos, change.newText);
      }
    }
    _tree.commitUpdate(exportRecorder);

    return _tree;
  }
}
