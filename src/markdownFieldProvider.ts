import * as vscode from 'vscode';

export const PREVIEW_MD_SCHEME = 'jsonl-md';

/**
 * 把抽取出的字段值作为只读虚拟 Markdown 文档提供,供 VSCode 自带的
 * `markdown.showPreviewToSide` 渲染。URI 以 `.md` 结尾 → 自动识别为 markdown 语言。
 */
export class MarkdownFieldProvider implements vscode.TextDocumentContentProvider {
  private readonly contents = new Map<string, string>();
  private seq = 0;

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? '';
  }

  /** 登记一段 markdown,返回其虚拟文档 URI(每次唯一,确保预览刷新)。 */
  register(markdown: string): vscode.Uri {
    this.seq++;
    const uri = vscode.Uri.parse(`${PREVIEW_MD_SCHEME}:字段预览-${this.seq}.md`);
    this.contents.set(uri.toString(), markdown);
    return uri;
  }
}
