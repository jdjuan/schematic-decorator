import * as ts from 'typescript';
import { Change, InsertChange, ReplaceChange } from '../utils/change';
import {
  DirEntry,
  Rule,
  SchematicContext,
  Tree
  } from '@angular-devkit/schematics';
import { insertImport } from '../utils/route-utils';
import {
  getDecoratorFileName,
  getDecoratorName,
  getDecoratorObject,
  setDecorator,
  removeBasePathFromDecorator,
  isImported,
} from '../utils/ast-utils';

export default function(): Rule {
  return (_tree: Tree, _context: SchematicContext) => {
    const allComponents = _recurse(
      _tree.getDir('src/app'),
      // _tree.getDir('app/base/movements/movements-module/components/movements'),
      '.component.ts',
    );
    const changes: Change[] = [];
    allComponents.forEach((component) => {
      const exportRecorder = _tree.beginUpdate(component.fullPath);
      changes.push(...replaceDecoratorWithObject(component, _tree));
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

function replaceDecoratorWithObject(
  component: componentPath,
  _tree: Tree,
): Change[] {
  const sourceText = _tree.read(component.fullPath)!.toString('utf-8');
  const source = ts.createSourceFile(
    component.fullPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );

  const decoratorName = getDecoratorName(source);
  // console.log('decoratorName');
  // console.log(decoratorName);

  const decoratorFileName = getDecoratorFileName(
    source,
    component.fullPath,
    decoratorName,
  );
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
    const decoratorObject = getDecoratorObject(decoratorFile, decoratorName);
    // console.log('decoratorObject');
    // console.log(decoratorObject);
    const formattedDecorator = removeBasePathFromDecorator(decoratorObject);
    // console.log('formattedDecorator');
    // console.log(formattedDecorator);
    const changes: Change[] = [];
    changes.push(setDecorator(source, component.fullPath, formattedDecorator));
    if (!isImported(source, 'ChangeDetectionStrategy', '@angular/core')) {
      const importChangeDetection = insertImport(
        source,
        component.fullPath,
        'ChangeDetectionStrategy',
        '@angular/core',
      );
      changes.push(importChangeDetection);
    }
    return changes;
  }
  return [];
}

function _recurse(dir: DirEntry, endsWith: string): componentPath[] {
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
