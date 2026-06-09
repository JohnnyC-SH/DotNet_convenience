import * as vscode from "vscode";
import * as path from "node:path";
import { findNearestCsproj, inferNamespace, resolveTargetDirectory } from "../workspace";
import { writeUtf8File } from "../fsUtil";

type ControllerStyle = "api" | "mvc";

function toPascalBase(raw: string): string {
  const trimmed = raw.trim().replace(/\.cs$/i, "").replace(/Controller$/i, "");
  const safe = trimmed.replace(/[^a-zA-Z0-9_]/g, "");
  if (!safe) {
    throw new Error(vscode.l10n.t("Invalid name."));
  }
  return safe.charAt(0).toUpperCase() + safe.slice(1);
}

function buildController(ns: string, className: string, style: ControllerStyle): string {
  if (style === "api") {
    return `using Microsoft.AspNetCore.Mvc;

namespace ${ns}
{\t
\t[ApiController]
\t[Route("api/[controller]")]
\tpublic sealed class ${className} : ControllerBase
\t{
\t}
}
`;
  }
  return `using Microsoft.AspNetCore.Mvc;

namespace ${ns}
{\t
\tpublic sealed class ${className} : Controller
\t{
\t\tpublic IActionResult Index() => View();
\t}
}
`;
}

export function registerAddController(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    "dotnetConv.addController",
    async (resource?: vscode.Uri) => {
      try {
        const stylePick = await vscode.window.showQuickPick<{
          label: string;
          description: string;
          style: ControllerStyle;
        }>(
          [
            {
              label: vscode.l10n.t("Web API"),
              description: vscode.l10n.t(
                "ControllerBase · [ApiController] · route template api/[controller]",
              ),
              style: "api",
            },
            {
              label: vscode.l10n.t("MVC"),
              description: vscode.l10n.t("Controller · sample Index action"),
              style: "mvc",
            },
          ],
          {
            title: vscode.l10n.t("Controller kind"),
            placeHolder: vscode.l10n.t("Choose a style"),
          },
        );
        if (!stylePick) {
          return;
        }

        const nameInput = await vscode.window.showInputBox({
          title: vscode.l10n.t("New controller"),
          prompt: vscode.l10n.t(
            "Base name without the Controller suffix (e.g. Products creates ProductsController.cs). If you type ProductsController, it will be normalized.",
          ),
          validateInput: (v) => {
            const t = v.trim().replace(/Controller$/i, "");
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
        if (!nameInput) {
          return;
        }

        const base = toPascalBase(nameInput);
        const className = `${base}Controller`;
        const fileName = `${className}.cs`;

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

        const content = buildController(ns, className, stylePick.style);
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
}
