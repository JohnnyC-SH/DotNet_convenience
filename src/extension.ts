import * as vscode from "vscode";
import { registerArtifactCommands } from "./commands/addArtifacts";
import { registerAddController } from "./commands/addController";
import { registerAddProjectReference } from "./commands/addProjectReference";
import { registerNewProjectInSolution } from "./commands/newProjectInSolution";

export function activate(context: vscode.ExtensionContext): void {
  registerArtifactCommands(context);
  registerAddController(context);
  registerAddProjectReference(context);
  registerNewProjectInSolution(context);
}

export function deactivate(): void {}
