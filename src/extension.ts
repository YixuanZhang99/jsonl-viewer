import * as vscode from 'vscode';
import { JsonlPreviewProvider, PREVIEW_SCHEME, toPreviewUri } from './previewProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new JsonlPreviewProvider();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, provider),
    provider
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jsonl.openPreview', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('请先打开一个 JSONL 文件');
        return;
      }
      const previewUri = toPreviewUri(editor.document.uri);
      const doc = await vscode.workspace.openTextDocument(previewUri);
      await vscode.languages.setTextDocumentLanguage(doc, 'jsonc');
      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false,
        preserveFocus: false,
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jsonl.collapseAllInPreview', async () => {
      await vscode.commands.executeCommand('editor.foldAll');
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.scheme === PREVIEW_SCHEME) {
        return;
      }
      provider.refresh(e.document.uri);
    })
  );
}

export function deactivate(): void {}
