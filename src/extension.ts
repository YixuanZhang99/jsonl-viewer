import * as vscode from 'vscode';
import { JsonlPreviewProvider, PREVIEW_SCHEME, toPreviewUri } from './previewProvider';
import { MarkdownFieldProvider, PREVIEW_MD_SCHEME } from './markdownFieldProvider';
import { extractStringValueAt, looksLikeMarkdown } from './markdownField';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new JsonlPreviewProvider();
  const mdProvider = new MarkdownFieldProvider();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, provider),
    vscode.workspace.registerTextDocumentContentProvider(PREVIEW_MD_SCHEME, mdProvider),
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
      await vscode.languages.setTextDocumentLanguage(doc, 'jsonl-pretty');
      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false,
        preserveFocus: false,
      });
    })
  );

  async function runFoldInPreview(fold: boolean): Promise<void> {
    const previewEditor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.scheme === PREVIEW_SCHEME
    );
    if (!previewEditor) {
      vscode.window.showWarningMessage('请先打开 JSONL 美化预览');
      return;
    }
    await vscode.window.showTextDocument(previewEditor.document, {
      viewColumn: previewEditor.viewColumn,
      preserveFocus: false,
    });
    await vscode.commands.executeCommand(fold ? 'editor.foldAll' : 'editor.unfoldAll');
    await vscode.commands.executeCommand('setContext', 'jsonl.previewCollapsed', fold);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('jsonl.collapseAllInPreview', () => runFoldInPreview(true)),
    vscode.commands.registerCommand('jsonl.expandAllInPreview', () => runFoldInPreview(false))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jsonl.openFieldAsMarkdown', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.uri.scheme !== PREVIEW_SCHEME) {
        vscode.window.showWarningMessage('请把光标放在 JSONL 预览中的某个字段值上');
        return;
      }
      const pos = editor.selection.active;
      const value = extractStringValueAt(editor.document.lineAt(pos.line).text, pos.character);
      if (value === undefined) {
        vscode.window.showWarningMessage('当前位置没有可解析的字符串字段值');
        return;
      }
      if (!looksLikeMarkdown(value)) {
        vscode.window.showInformationMessage('当前字段值看起来不是 Markdown,仍按 Markdown 渲染。');
      }
      const uri = mdProvider.register(value);
      await vscode.commands.executeCommand('markdown.showPreviewToSide', uri);
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
