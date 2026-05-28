// Module require hook that aliases 'vscode' to a local stub.
// Loaded by mocha via --require so it runs before any test spec imports source files.

/* eslint-disable @typescript-eslint/no-var-requires */
import * as path from 'path';

const Module: any = require('module');
const stubPath = path.join(__dirname, 'vscode-stub.js');
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function (request: string, ...rest: unknown[]): string {
    if (request === 'vscode') {
        return stubPath;
    }
    return originalResolve.call(this, request, ...rest);
};
