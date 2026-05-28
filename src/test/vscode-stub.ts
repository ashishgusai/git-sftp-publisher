// Minimal stub of the 'vscode' module so plain Node mocha tests can import source files
// that have `import * as vscode from 'vscode'` at the top. This stub only needs to satisfy
// module-load-time references; tests that hit interactive UI must live in @vscode/test-electron.

const noop = (): undefined => undefined;
const asyncNoop = async (): Promise<undefined> => undefined;

const channel = {
    appendLine: noop,
    append: noop,
    clear: noop,
    show: noop,
    hide: noop,
    dispose: noop,
    replace: noop,
    name: 'stub'
};

const stub = {
    window: {
        createOutputChannel: () => channel,
        showQuickPick: asyncNoop,
        showWarningMessage: asyncNoop,
        showErrorMessage: asyncNoop,
        showInformationMessage: asyncNoop,
        showWorkspaceFolderPick: asyncNoop,
        activeTextEditor: undefined,
        withProgress: async (
            _opts: unknown,
            run: (p: unknown, t: unknown) => Promise<unknown>
        ) => run({ report: noop }, { isCancellationRequested: false })
    },
    workspace: {
        workspaceFolders: undefined,
        getWorkspaceFolder: () => undefined,
        getConfiguration: () => ({ get: <T>(_k: string, def: T) => def }),
        openTextDocument: asyncNoop
    },
    extensions: {
        getExtension: () => undefined
    },
    commands: {
        registerCommand: () => ({ dispose: noop }),
        executeCommand: asyncNoop
    },
    ProgressLocation: { Notification: 15, SourceControl: 1, Window: 10 }
};

export = stub;
