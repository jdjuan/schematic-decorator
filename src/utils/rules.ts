import {
  addImportToModule,
  addExportToModule
} from './ast-utils';
import {
  InsertChange,
  Change
} from './change';
import {
  Rule,
  Tree
} from '@angular-devkit/schematics';

import * as ts from 'typescript';

export const defaultCustomNgxPath = '/src/app/custom/ngx-custom.module.ts';

/**
 * Adds modules to the NgModule decorator of the ngx-df-custom.module
 * @param modules - an array of modules names to be added, e.g ['DfCardModule', 'DfTableModule']
 * @param [addToImports=true] -  whether or not to add the modules to imports
 * @param [addToExports=true] - whether or not to add the modules to exports
 * @param [filePath] - path of the ngx-df-custom.module file in the project, from root
 * @returns 
 */
export function addModulesToNgxDfCustom(modules: string[],
                                        addToImports = true,
                                        addToExports = true,
                                        ngxCustomPath = defaultCustomNgxPath): Rule {
  return addModulesToModule(
    modules,
    '@devfactory/ngx-df',
    addToImports,
    addToExports,
    ngxCustomPath
  );
}

export function addModulesToModule (modules: string[],
                                    importFrom: string,
                                    addToImports: boolean,
                                    addToExports: boolean,
                                    sourceModulePath: string): Rule {
  return (tree: Tree) => {
    const path = sourceModulePath;
    const pathText = tree.read(path).toString('utf-8');
    const pathSource = ts.createSourceFile(
      path,
      pathText,
      ts.ScriptTarget.Latest,
      true
    );

    const changeRecorder = tree.beginUpdate(path);

    // Add each df module in the `imports` and `exports` of the NgModule decorator
    const changes: Change[] = modules.reduce((_changes: string[], module: string) => {
      const params = [pathSource, path, module, importFrom];
      const imports = addToImports ? addImportToModule.apply(null, params) : [];
      
      if (addToImports) {
        // If it was added to `imports`, then we no longer need to import the module
        // at the header, so we set the import path as undefined
        params[3] = undefined;
      }
      const exports = addToExports ? addExportToModule.apply(null, params) : [];
      return [
        ..._changes,
        ...imports,
        ...exports
      ];
    }, []);

    // Execute all the changes
    for (const change of changes) {
      if (change instanceof InsertChange) {
        changeRecorder.insertLeft(change.pos, change.toAdd);
      }
    }
    tree.commitUpdate(changeRecorder);
    return tree;
  }
}