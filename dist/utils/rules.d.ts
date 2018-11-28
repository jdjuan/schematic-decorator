import { Rule } from '@angular-devkit/schematics';
export declare const defaultCustomNgxPath = "/src/app/custom/ngx-custom.module.ts";
/**
 * Adds modules to the NgModule decorator of the ngx-df-custom.module
 * @param modules - an array of modules names to be added, e.g ['DfCardModule', 'DfTableModule']
 * @param [addToImports=true] -  whether or not to add the modules to imports
 * @param [addToExports=true] - whether or not to add the modules to exports
 * @param [filePath] - path of the ngx-df-custom.module file in the project, from root
 * @returns
 */
export declare function addModulesToNgxDfCustom(modules: string[], addToImports?: boolean, addToExports?: boolean, ngxCustomPath?: string): Rule;
export declare function addModulesToModule(modules: string[], importFrom: string, addToImports: boolean, addToExports: boolean, sourceModulePath: string): Rule;
//# sourceMappingURL=rules.d.ts.map