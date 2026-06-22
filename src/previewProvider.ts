import * as vscode from 'vscode';
import { formatJsonl } from './format';

export const PREVIEW_SCHEME = 'jsonl-pretty';

export function toPreviewUri(source: vscode.Uri): vscode.Uri {
  const base = source.path.split('/').pop() ?? 'document';
  return vscode.Uri.parse(
    `${PREVIEW_SCHEME}:${base}.pretty.jsonc?source=${encodeURIComponent(source.toString())}`
  );
}

export function toSourceUri(preview: vscode.Uri): vscode.Uri {
  const params = new URLSearchParams(preview.query);
  const source = params.get('source');
  if (!source) {
    throw new Error('预览 URI 缺少 source 参数');
  }
  return vscode.Uri.parse(decodeURIComponent(source));
}

export class JsonlPreviewProvider implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const sourceUri = toSourceUri(uri);
    const config = vscode.workspace.getConfiguration('jsonl.preview');
    const maxBytes = config.get<number>('maxBytes', 5_242_880);
    const maxRecords = config.get<number>('maxRecords', 50_000);

    let text: string;
    try {
      const doc = await vscode.workspace.openTextDocument(sourceUri);
      text = doc.getText();
    } catch {
      const bytes = await vscode.workspace.fs.readFile(sourceUri);
      text = Buffer.from(bytes).toString('utf8');
    }

    const result = formatJsonl(text, { maxBytes, maxRecords });
    return result.text === '' ? '// (空文件,无可显示的记录)' : result.text;
  }

  refresh(sourceUri: vscode.Uri): void {
    this._onDidChange.fire(toPreviewUri(sourceUri));
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
