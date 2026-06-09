import * as vscode from "vscode";
import * as path from "node:path";
import { findNearestCsproj, inferNamespace, resolveTargetDirectory } from "../workspace";
import { writeUtf8File } from "../fsUtil";

type ArtifactKind = "class" | "interface" | "razorComponent" | "razorPage";

function toPascalFileBase(raw: string): string {
  const trimmed = raw.trim().replace(/\.(cs|razor)$/i, "");
  const safe = trimmed.replace(/[^a-zA-Z0-9_]/g, "");
  if (!safe) {
    throw new Error(vscode.l10n.t("Invalid name."));
  }
  return safe.charAt(0).toUpperCase() + safe.slice(1);
}

function buildContent(kind: ArtifactKind, ns: string, name: string, pageRoute?: string): string {
  switch (kind) {
    case "class":
      return `namespace ${ns}\n{\n\tpublic sealed class ${name}\n\t{\n\t\n\t}\n}\n`;
    case "interface":
      return `namespace ${ns}\n{\n\tpublic interface ${name}\n\t{\n\t\n\t}\n}\n`;
    case "razorComponent":
      return `@namespace ${ns}\n\n<h3>${name}</h3>\n\n@code {\n}\n`;
    case "razorPage": {
      const route = pageRoute?.trim() || `/${name.toLowerCase()}`;
      const pageLine = route.startsWith("/") ? `@page "${route}"` : `@page "/${route}"`;
      return `@namespace ${ns}\n${pageLine}\n\n<h3>${name}</h3>\n\n@code {\n}\n`;
    }
  }
}

function extensionFor(kind: ArtifactKind): string {
  return kind === "razorComponent" || kind === "razorPage" ? ".razor" : ".cs";
}

async function promptName(kind: ArtifactKind): Promise<string | undefined> {
  const placeHolder =
    kind === "interface"
      ? vscode.l10n.t("IMyService or MyService")
      : kind === "razorPage"
        ? vscode.l10n.t("Component name (optional route in the next step)")
        : vscode.l10n.t("Name (without extension)");
  return vscode.window.showInputBox({
    title:
      kind === "class"
        ? vscode.l10n.t("New C# class")
        : kind === "interface"
          ? vscode.l10n.t("New C# interface")
          : kind === "razorComponent"
            ? vscode.l10n.t("New Razor component")
            : vscode.l10n.t("New Razor page"),
    prompt: placeHolder,
    validateInput: (v) => {
      const t = v.trim();
      if (!t) {
        return vscode.l10n.t("Enter a name.");
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) {
        return vscode.l10n.t(
          "Use a typical C# identifier: a letter or underscore, then letters, digits, or underscores.",
        );
      }
      return undefined;
    },
  });
}

async function promptRoute(defaultRoute: string): Promise<string | undefined> {
  return vscode.window.showInputBox({
    title: vscode.l10n.t("@page route"),
    prompt: vscode.l10n.t("Example: /customers or customers"),
    value: defaultRoute,
  });
}

export function registerArtifactCommands(context: vscode.ExtensionContext): void {
  const register = (kind: ArtifactKind, command: string) => {
    const disposable = vscode.commands.registerCommand(
      command,
      async (resource?: vscode.Uri) => {
        try {
          const nameInput = await promptName(kind);
          if (!nameInput) {
            return;
          }
          const baseName = toPascalFileBase(nameInput);
          const ext = extensionFor(kind);
          const fileName = `${baseName}${ext}`;

          let pageRoute: string | undefined;
          if (kind === "razorPage") {
            const r = await promptRoute(`/${baseName.toLowerCase()}`);
            if (r === undefined) {
              return;
            }
            pageRoute = r;
          }

          const targetDir = await resolveTargetDirectory(resource);
          const csproj = await findNearestCsproj(targetDir.fsPath);
          if (!csproj) {
            vscode.window.showErrorMessage(
              vscode.l10n.t(
                "Could not find a nearby .csproj. Place the file under the project tree or open a project file.",
              ),
            );
            return;
          }

          const ns = await inferNamespace(csproj.fsPath, targetDir.fsPath);
          const filePath = path.join(targetDir.fsPath, fileName);
          const uri = vscode.Uri.file(filePath);

          try {
            await vscode.workspace.fs.stat(uri);
            vscode.window.showErrorMessage(vscode.l10n.t("Already exists: {0}", fileName));
            return;
          } catch {
            // ok
          }

          const content = buildContent(kind, ns, baseName, pageRoute);
          await writeUtf8File(uri, content);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: false });
          vscode.window.setStatusBarMessage(vscode.l10n.t(".NET Convenience: created {0}", fileName), 4000);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          vscode.window.showErrorMessage(msg);
        }
      },
    );
    context.subscriptions.push(disposable);
  };

  register("class", "dotnetConv.addClass");
  register("interface", "dotnetConv.addInterface");
  register("razorComponent", "dotnetConv.addRazorComponent");
  register("razorPage", "dotnetConv.addRazorPage");
}
