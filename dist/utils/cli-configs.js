"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Returns the default style extension configured in the
 * .angular-cli.json file of a given project
 * @param host - the host tree
 * @returns - '.scss' or '.css' depending on the angular config file
 */
function getDefaultStyleExt(host) {
    const filePath = '/.angular-cli.json';
    const content = host.read(filePath) || new Buffer("");
    const config = JSON.parse(content.toString());
    return config.defaults.styleExt || 'css';
}
exports.getDefaultStyleExt = getDefaultStyleExt;
