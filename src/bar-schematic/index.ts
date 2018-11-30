import * as ts from 'typescript';
import { Change, InsertChange, ReplaceChange } from '../utils/change';
import {
  DirEntry,
  Rule,
  SchematicContext,
  Tree
  } from '@angular-devkit/schematics';
import { fileBuffer } from '@angular-devkit/core/src/virtual-fs/host';
import { path } from '@angular-devkit/core';
import {
  getDecoratorFileName,
  getDecoratorName,
  getDecoratorObject,
  setDecorator,
} from '../utils/ast-utils';

export default function(): Rule {
  return (_tree: Tree, _context: SchematicContext) => {
    const allComponents = _recurse(_tree.getDir('src/app'));
    const changes: Change[] = [];
    allComponents.forEach((component) => {
      const exportRecorder = _tree.beginUpdate(component.fullPath);
      changes.push(replaceDecoratorWithObject(component, _tree));
      for (const change of changes) {
        if (change instanceof InsertChange) {
          exportRecorder.insertLeft(change.pos, change.toAdd);
        }
        if (change instanceof ReplaceChange) {
          exportRecorder.remove(change.pos, change.oldText.length);
          exportRecorder.insertLeft(change.pos, change.newText);
        }
      }
      _tree.commitUpdate(exportRecorder);
    });

    return _tree;
  };
}

function replaceDecoratorWithObject(component: componentPath, _tree: Tree): Change {
  const sourceText = _tree.read(component.fullPath)!.toString('utf-8');
  const source = ts.createSourceFile(
    component.fullPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );

  const decoratorName = getDecoratorName(source);
  const decoratorFileName = getDecoratorFileName(
    source,
    component.fullPath,
    decoratorName,
  );
  // If not already an object
  if (decoratorFileName) {
    const decoratorFilePath = `${component.path}/${decoratorFileName}.ts`;
    console.log(decoratorFilePath);

    const decoratorFile = readDecoratorFile(_tree, decoratorFilePath);
    const decoratorObject = getDecoratorObject(decoratorFile);
    return setDecorator(source, component.fullPath, decoratorObject);
  }
  return null;
}

function _recurse(dir: DirEntry): componentPath[] {
  return [
    ...dir.subfiles
      .filter((fileName) => fileName.endsWith('.component.ts'))
      .map((fileName) => ({
        path: dir.path,
        file: fileName,
        fullPath: `${dir.path}/${fileName}`,
      })),
    ...[].concat(...dir.subdirs.map((x) => _recurse(dir.dir(x)))),
  ];
}

function readDecoratorFile(_tree: Tree, decoratorPath: string) {
  const metaDecoratorSourceText = _tree.read(decoratorPath)!.toString('utf-8');
  const metaDecoratorSource = ts.createSourceFile(
    decoratorPath,
    metaDecoratorSourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  return metaDecoratorSource;
}

interface componentPath {
  path: string;
  file: string;
  fullPath: string;
}
