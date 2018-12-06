import * as ts from 'typescript';
import { Change, InsertChange, ReplaceChange } from '../utils/change';
import { DirEntry, Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import {
  getDecoratorImportPath,
  getDecoratorName,
  getDecoratorObject,
  isImported,
  removeBasePathFromDecorator,
  setDecorator
  } from '../utils/ast-utils';
import { insertImport } from '../utils/route-utils';
import { NEW_DECORATOR } from './fn-body';

export default function(): Rule {
  return (_tree: Tree, _context: SchematicContext) => {
    const route = 'app/base';
    const allComponents = _recurse(_tree.getDir(route), '.component.ts');
    const replaceComponentDecorator = (component) => replaceDecorator(component, _tree);
    allComponents.forEach(replaceComponentDecorator);
    return _tree;
  };
}

function replaceDecorator(component, _tree) {
  const exportRecorder = _tree.beginUpdate(component.fullPath);
  let changes: Change[] = replaceDecoratorWithObject(component, _tree);
  if (changes) {
    for (const change of changes) {
      if (change instanceof InsertChange) {
        exportRecorder.insertLeft(change.pos, change.toAdd);
      }
      if (change instanceof ReplaceChange) {
        exportRecorder.remove(change.pos, change.oldText.length);
        exportRecorder.insertLeft(change.pos, change.newText);
      }
    }
  }
  _tree.commitUpdate(exportRecorder);
}

function replaceDecoratorWithObject(component: componentPath, _tree: Tree): Change[] {
  const sourceText = _tree.read(component.fullPath)!.toString('utf-8');
  const source = ts.createSourceFile(
    component.fullPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );
  const decoratorName = getDecoratorName(source);
  // if the component actually has a decorator
  if (decoratorName) {
    const decoratorPath = getDecoratorImportPath(source, decoratorName);
    // If it is an imported decorator
    if (decoratorPath) {
      const formattedDecoratorPath = formatAbsolutePath(decoratorPath, component);
      const decoratorFile = readDecoratorFile(_tree, formattedDecoratorPath);
      const decoratorObject = getDecoratorObject(decoratorFile, decoratorName);
      const decorator = removeBasePathFromDecorator(decoratorObject);
      const changes: Change[] = [];
      changes.push(setDecorator(source, component.fullPath, decorator));
      changes.push(addChangeDetectionImport(source, component));
      return changes;
    }
    return [];
  }
}

function formatAbsolutePath(
  decoratorImportPath: string,
  component: componentPath
): string {
  let decoratorFilePath = '';
  if (decoratorImportPath.startsWith('~')) {
    const absolutePath = decoratorImportPath.substring(1, decoratorImportPath.length);
    decoratorFilePath = `app/${absolutePath}.ts`;
  } else {
    decoratorFilePath = `${component.path}/${decoratorImportPath}.ts`;
  }
  return decoratorFilePath;
}

function addChangeDetectionImport(
  source: ts.SourceFile,
  component: componentPath
): Change {
  if (!isImported(source, 'ChangeDetectionStrategy', '@angular/core')) {
    return insertImport(
      source,
      component.fullPath,
      'ChangeDetectionStrategy',
      '@angular/core'
    );
  }
  return null;
}

function _recurse(dir: DirEntry, endsWith: string): componentPath[] {
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

function readDecoratorFile(_tree: Tree, decoratorPath: string) {
  const metaDecoratorSourceText = _tree.read(decoratorPath)!.toString('utf-8');
  const metaDecoratorSource = ts.createSourceFile(
    decoratorPath,
    metaDecoratorSourceText,
    ts.ScriptTarget.Latest,
    true
  );
  return metaDecoratorSource;
}

interface componentPath {
  path: string;
  file: string;
  fullPath: string;
}
