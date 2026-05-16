import * as vscode from "vscode";
import * as path from "node:path";
import { findSolutionFiles } from "../workspace";
import { runDotnetWithOutput } from "../dotnetCli";

type TemplateChoice = {
  label: string;
  description: string;
  template: string;
  extraArgs: string[];
};

const templates: TemplateChoice[] = [
  { label: "classlib", description: "Biblioteca de clases", template: "classlib", extraArgs: [] },
  { label: "console", description: "Aplicación de consola", template: "console", extraArgs: [] },
  { label: "web", description: "ASP.NET Core vacío", template: "web", extraArgs: [] },
  { label: "webapi", description: "ASP.NET Core Web API", template: "webapi", extraArgs: [] },
  { label: "blazor", description: "Blazor Web App", template: "blazor", extraArgs: [] },
  { label: "maui", description: ".NET MAUI App", template: "maui", extraArgs: [] },
  {
    label: "Personalizado…",
    description: "Nombre corto de plantilla (dotnet new list)",
    template: "__custom__",
    extraArgs: [],
  },
];

export function registerNewProjectInSolution(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand("dotnetConv.newProjectInSolution", async () => {
    try {
      const slns = await findSolutionFiles();
      if (!slns.length) {
        vscode.window.showErrorMessage("No encontré ningún .sln en el workspace.");
        return;
      }

      const slnPick =
        slns.length === 1
          ? { uri: slns[0] }
          : await vscode.window.showQuickPick(
              slns.map((s) => ({
                label: vscode.workspace.asRelativePath(s),
                uri: s,
              })),
              { title: "Solución", placeHolder: "Elige el .sln" },
            );
      if (!slnPick) {
        return;
      }

      const slnPath = slnPick.uri.fsPath;
      const slnDir = path.dirname(slnPath);

      const tpl = await vscode.window.showQuickPick(templates, {
        title: "Plantilla dotnet new",
        placeHolder: "Elige tipo de proyecto",
      });
      if (!tpl) {
        return;
      }

      let templateId = tpl.template;
      let extra = [...tpl.extraArgs];
      if (templateId === "__custom__") {
        const custom = await vscode.window.showInputBox({
          title: "Plantilla",
          prompt: "Nombre corto (ej: razorclasslib, worker, xunit)",
          validateInput: (v) => (v.trim() ? undefined : "Requerido"),
        });
        if (!custom?.trim()) {
          return;
        }
        templateId = custom.trim();
      }

      const name = await vscode.window.showInputBox({
        title: "Nombre del proyecto",
        prompt: "Se usará con dotnet new -n",
        validateInput: (v) => {
          const t = v.trim();
          if (!t) {
            return "Requerido";
          }
          if (!/^[\w.-]+$/u.test(t)) {
            return "Usa letras, números, guion, punto o guion bajo.";
          }
          return undefined;
        },
      });
      if (!name) {
        return;
      }

      const subfolder = await vscode.window.showInputBox({
        title: "Subcarpeta (opcional)",
        prompt: "Ruta relativa al directorio del .sln, por ejemplo: src o apps/web",
        value: "",
      });
      if (subfolder === undefined) {
        return;
      }

      const outDir = path.join(slnDir, subfolder.trim(), name.trim());
      const outDirNorm = path.normalize(outDir);

      const args = ["new", templateId, "-n", name.trim(), "-o", outDirNorm, ...extra];
      await runDotnetWithOutput(args, slnDir, "dotnet new");

      const guessedCsproj = path.join(outDirNorm, `${name.trim()}.csproj`);
      const csprojUri = vscode.Uri.file(guessedCsproj);
      try {
        await vscode.workspace.fs.stat(csprojUri);
      } catch {
        const pattern = new vscode.RelativePattern(vscode.Uri.file(outDirNorm), "*.csproj");
        const found = await vscode.workspace.findFiles(pattern, null, 5);
        if (!found.length) {
          vscode.window.showWarningMessage(
            "dotnet new terminó, pero no encontré el .csproj esperado. Agrega el proyecto a la solución manualmente si hace falta.",
          );
          return;
        }
        await runDotnetWithOutput(["sln", slnPath, "add", found[0].fsPath], undefined, "dotnet sln add");
        return;
      }

      await runDotnetWithOutput(["sln", slnPath, "add", guessedCsproj], undefined, "dotnet sln add");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      vscode.window.showErrorMessage(msg);
    }
  });
  context.subscriptions.push(disposable);
}
