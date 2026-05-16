import * as vscode from "vscode";

export async function writeUtf8File(uri: vscode.Uri, text: string): Promise<void> {
  const data = new TextEncoder().encode(text);
  await vscode.workspace.fs.writeFile(uri, data);
}
