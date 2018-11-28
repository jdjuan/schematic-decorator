import {
  Tree
} from '@angular-devkit/schematics';

/**
 * Returns the default style extension configured in the
 * .angular-cli.json file of a given project
 * @param host - the host tree
 * @returns - '.scss' or '.css' depending on the angular config file
 */
export function getDefaultStyleExt(host: Tree): string {
  const filePath = '/.angular-cli.json';
  const content = host.read(filePath) || new Buffer("");
  const config = JSON.parse(content.toString());
  return config.defaults.styleExt || 'css';
}