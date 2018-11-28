import { Tree } from '@angular-devkit/schematics';
import * as ts from 'typescript';
import { AppConfig } from '../utils/config';
export declare function findBootstrapModuleCall(host: Tree, mainPath: string): ts.CallExpression | null;
export declare function findBootstrapModulePath(host: Tree, mainPath: string): string;
export declare function getAppModulePath(host: Tree, app: AppConfig): import("@angular-devkit/core/src/virtual-fs/path").Path;
//# sourceMappingURL=ng-ast-utils.d.ts.map