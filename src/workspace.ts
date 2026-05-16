import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { Dirent } from "node:fs";

export async function resolveTargetDirectory(resource?: vscode.Uri): Promise<vscode.Uri> {
  if (resource) {
    const stat = await vscode.workspace.fs.stat(resource);
    if (stat.type === vscode.FileType.Directory) {
      return resource;
    }
    return vscode.Uri.file(path.dirname(resource.fsPath));
  }

  const editor = vscode.window.activeTextEditor;
  if (editor?.document.uri.scheme === "file") {
    return vscode.Uri.file(path.dirname(editor.document.uri.fsPath));
  }

  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    throw new Error(vscode.l10n.t("Open a folder in VS Code."));
  }
  if (folders.length === 1) {
    return folders[0].uri;
  }

  const picked = await vscode.window.showWorkspaceFolderPick({
    placeHolder: vscode.l10n.t("Choose the workspace folder where the file will be created"),
  });
  if (!picked) {
    throw new Error(vscode.l10n.t("Operation cancelled."));
  }
  return picked.uri;
}

export async function findNearestCsproj(fromDirFsPath: string): Promise<vscode.Uri | undefined> {
  let dir = fromDirFsPath;
  const roots = new Set(
    (vscode.workspace.workspaceFolders ?? []).map((f: vscode.WorkspaceFolder) => path.resolve(f.uri.fsPath)),
  );

  for (let hops = 0; hops < 64; hops++) {
    const entries: Dirent[] = await fs.readdir(dir, { withFileTypes: true }).catch(() => [] as Dirent[]);
    const csproj = entries.find((e: Dirent) => e.isFile() && e.name.endsWith(".csproj"));
    if (csproj) {
      return vscode.Uri.file(path.join(dir, csproj.name));
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }

    if (roots.size > 0) {
      const stillInside = [...roots].some((r) => {
        const rel = path.relative(r, dir);
        return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
      });
      if (!stillInside) {
        return undefined;
      }
    }

    dir = parent;
  }

  return undefined;
}

export async function findSolutionFiles(): Promise<vscode.Uri[]> {
  const files = await vscode.workspace.findFiles("**/*.sln", "**/{node_modules,.git,bin,obj}/**", 200);
  return files.sort((a: vscode.Uri, b: vscode.Uri) => a.fsPath.localeCompare(b.fsPath));
}

async function readUtf8(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return buf.toString("utf8");
}

export async function readRootNamespace(csprojPath: string): Promise<string> {
  const xml = await readUtf8(csprojPath);
  const m = xml.match(/<RootNamespace>([^<]+)<\/RootNamespace>/);
  if (m?.[1]) {
    return m[1].trim();
  }
  const base = path.basename(csprojPath, ".csproj");
  return base;
}

export async function inferNamespace(csprojPath: string, targetDirFsPath: string): Promise<string> {
  const projectDir = path.dirname(csprojPath);
  const rootNs = await readRootNamespace(csprojPath);
  const rel = path.relative(projectDir, targetDirFsPath);
  if (!rel || rel === ".") {
    return rootNs;
  }
  const segments = rel
    .split(path.sep)
    .filter((s: string) => s && s !== "." && s !== "..")
    .map((s: string) => s.replace(/[^a-zA-Z0-9_]/g, "_"));
  if (!segments.length) {
    return rootNs;
  }
  return `${rootNs}.${segments.join(".")}`;
}

export async function findAllCsproj(): Promise<vscode.Uri[]> {
  const files = await vscode.workspace.findFiles("**/*.csproj", "**/{node_modules,.git,bin,obj}/**", 500);
  return files.sort((a: vscode.Uri, b: vscode.Uri) => a.fsPath.localeCompare(b.fsPath));
}
