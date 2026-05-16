import * as vscode from "vscode";
import * as path from "node:path";
import { findNearestCsproj, inferNamespace, resolveTargetDirectory } from "../workspace";
import { writeUtf8File } from "../fsUtil";

type ControllerStyle = "api" | "mvc";

function toPascalBase(raw: string): string {
  const trimmed = raw.trim().replace(/\.cs$/i, "").replace(/Controller$/i, "");
  const safe = trimmed.replace(/[^a-zA-Z0-9_]/g, "");
  if (!safe) {
    throw new Error("Nombre inválido.");
  }
  return safe.charAt(0).toUpperCase() + safe.slice(1);
}

function buildController(ns: string, className: string, style: ControllerStyle): string {
  if (style === "api") {
    return `namespace ${ns};

using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public sealed class ${className} : ControllerBase
{
}
`;
  }
  return `namespace ${ns};

using Microsoft.AspNetCore.Mvc;

public sealed class ${className} : Controller
{
    public IActionResult Index() => View();
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
              label: "Web API",
              description: "ControllerBase · [ApiController] · api/[controller]",
              style: "api",
            },
            {
              label: "MVC",
              description: "Controller · acción Index de ejemplo",
              style: "mvc",
            },
          ],
          { title: "Tipo de controller", placeHolder: "Elige estilo" },
        );
        if (!stylePick) {
          return;
        }

        const nameInput = await vscode.window.showInputBox({
          title: "Nuevo controller",
          prompt:
            "Nombre base sin sufijo Controller (ej: Productos crea ProductosController.cs). Si escribes ProductosController, se normaliza.",
          validateInput: (v) => {
            const t = v.trim().replace(/Controller$/i, "");
            if (!t) {
              return "Escribe un nombre.";
            }
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) {
              return "Identificador C# típico: letra o _, luego letras, números o _.";
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
            "No encontré un .csproj cercano. Coloca el archivo dentro del árbol del proyecto o abre un archivo del proyecto.",
          );
          return;
        }

        const ns = await inferNamespace(csproj.fsPath, targetDir.fsPath);
        const filePath = path.join(targetDir.fsPath, fileName);
        const uri = vscode.Uri.file(filePath);

        try {
          await vscode.workspace.fs.stat(uri);
          vscode.window.showErrorMessage(`Ya existe: ${fileName}`);
          return;
        } catch {
          // ok
        }

        const content = buildController(ns, className, stylePick.style);
        await writeUtf8File(uri, content);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });
        vscode.window.setStatusBarMessage(`.NET Convenience: creado ${fileName}`, 4000);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(msg);
      }
    },
  );
  context.subscriptions.push(disposable);
}
