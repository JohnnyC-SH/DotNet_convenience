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

function getTemplates(): TemplateChoice[] {
  return [
    {
      label: "classlib",
      description: vscode.l10n.t("Class library"),
      template: "classlib",
      extraArgs: [],
    },
    {
      label: "console",
      description: vscode.l10n.t("Console application"),
      template: "console",
      extraArgs: [],
    },
    {
      label: "web",
      description: vscode.l10n.t("ASP.NET Core empty"),
      template: "web",
      extraArgs: [],
    },
    {
      label: "webapi",
      description: vscode.l10n.t("ASP.NET Core Web API"),
      template: "webapi",
      extraArgs: [],
    },
    {
      label: "blazor",
      description: vscode.l10n.t("Blazor Web App"),
      template: "blazor",
      extraArgs: [],
    },
    {
      label: "maui",
      description: vscode.l10n.t(".NET MAUI App"),
      template: "maui",
      extraArgs: [],
    },
    {
      label: vscode.l10n.t("Custom…"),
      description: vscode.l10n.t("Short template name (dotnet new list)"),
      template: "__custom__",
      extraArgs: [],
    },
  ];
}

export function registerNewProjectInSolution(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand("dotnetConv.newProjectInSolution", async () => {
    try {
      const slns = await findSolutionFiles();
      if (!slns.length) {
        vscode.window.showErrorMessage(vscode.l10n.t("No solution (.sln) was found in the workspace."));
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
              {
                title: vscode.l10n.t("Solution"),
                placeHolder: vscode.l10n.t("Choose the .sln"),
              },
            );
      if (!slnPick) {
        return;
      }

      const slnPath = slnPick.uri.fsPath;
      const slnDir = path.dirname(slnPath);

      const tpl = await vscode.window.showQuickPick(getTemplates(), {
        title: vscode.l10n.t("dotnet new template"),
        placeHolder: vscode.l10n.t("Choose a project type"),
      });
      if (!tpl) {
        return;
      }

      let templateId = tpl.template;
      let extra = [...tpl.extraArgs];
      if (templateId === "__custom__") {
        const custom = await vscode.window.showInputBox({
          title: vscode.l10n.t("Template"),
          prompt: vscode.l10n.t("Short name (e.g. razorclasslib, worker, xunit)"),
          validateInput: (v) => (v.trim() ? undefined : vscode.l10n.t("Required")),
        });
        if (!custom?.trim()) {
          return;
        }
        templateId = custom.trim();
      }

      const name = await vscode.window.showInputBox({
        title: vscode.l10n.t("Project name"),
        prompt: vscode.l10n.t("Used with dotnet new -n"),
        validateInput: (v) => {
          const t = v.trim();
          if (!t) {
            return vscode.l10n.t("Required");
          }
          if (!/^[\w.-]+$/u.test(t)) {
            return vscode.l10n.t("Use letters, digits, hyphens, dots, or underscores.");
          }
          return undefined;
        },
      });
      if (!name) {
        return;
      }

      const subfolder = await vscode.window.showInputBox({
        title: vscode.l10n.t("Subfolder (optional)"),
        prompt: vscode.l10n.t("Relative path to the .sln directory, for example: src or apps/web"),
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
            vscode.l10n.t(
              "dotnet new finished, but the expected .csproj was not found. Add the project to the solution manually if needed.",
            ),
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
