import * as vscode from "vscode";
import * as path from "node:path";
import { findAllCsproj, findNearestCsproj, resolveTargetDirectory } from "../workspace";
import { runDotnetWithOutput } from "../dotnetCli";

export function registerAddProjectReference(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand("dotnetConv.addProjectReference", async () => {
    try {
      const projects = await findAllCsproj();
      if (projects.length < 2) {
        vscode.window.showErrorMessage(
          vscode.l10n.t(
            "At least two projects (.csproj) are required in the workspace to add a reference.",
          ),
        );
        return;
      }

      const fromDir = await resolveTargetDirectory(undefined);
      const suggested = await findNearestCsproj(fromDir.fsPath);
      const orderedFrom =
        suggested && projects.some((p) => p.fsPath === suggested.fsPath)
          ? [suggested, ...projects.filter((p) => p.fsPath !== suggested.fsPath)]
          : projects;

      const fromPick = await vscode.window.showQuickPick(
        orderedFrom.map((p) => ({
          label: vscode.workspace.asRelativePath(p),
          description: path.basename(p.fsPath),
          uri: p,
        })),
        {
          title: vscode.l10n.t("Project that will receive the reference"),
          placeHolder: suggested
            ? vscode.l10n.t("Suggested above: {0}", vscode.workspace.asRelativePath(suggested))
            : vscode.l10n.t("Choose a .csproj"),
        },
      );
      if (!fromPick) {
        return;
      }

      const candidates = projects.filter((p) => p.fsPath !== fromPick.uri.fsPath);
      const toPick = await vscode.window.showQuickPick(
        candidates.map((p) => ({
          label: vscode.workspace.asRelativePath(p),
          description: path.basename(p.fsPath),
          uri: p,
        })),
        {
          title: vscode.l10n.t("Referenced project"),
          placeHolder: vscode.l10n.t("Pick the other .csproj"),
        },
      );
      if (!toPick) {
        return;
      }

      const args = ["add", fromPick.uri.fsPath, "reference", toPick.uri.fsPath];
      await runDotnetWithOutput(args, undefined, "dotnet add reference");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      vscode.window.showErrorMessage(msg);
    }
  });
  context.subscriptions.push(disposable);
}
