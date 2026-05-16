import * as vscode from "vscode";
import * as path from "node:path";
import { findNearestCsproj, inferNamespace, resolveTargetDirectory } from "../workspace";
import { writeUtf8File } from "../fsUtil";

type ArtifactKind = "class" | "interface" | "razorComponent" | "razorPage";

function toPascalFileBase(raw: string): string {
  const trimmed = raw.trim().replace(/\.(cs|razor)$/i, "");
  const safe = trimmed.replace(/[^a-zA-Z0-9_]/g, "");
  if (!safe) {
    throw new Error("Nombre inválido.");
  }
  return safe.charAt(0).toUpperCase() + safe.slice(1);
}

function buildContent(kind: ArtifactKind, ns: string, name: string, pageRoute?: string): string {
  switch (kind) {
    case "class":
      return `namespace ${ns};\n\npublic sealed class ${name}\n{\n}\n`;
    case "interface":
      return `namespace ${ns};\n\npublic interface ${name}\n{\n}\n`;
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
      ? "IMiServicio o MiServicio"
      : kind === "razorPage"
        ? "Nombre del componente (ruta opcional en el siguiente paso)"
        : "Nombre (sin extensión)";
  return vscode.window.showInputBox({
    title:
      kind === "class"
        ? "Nueva clase C#"
        : kind === "interface"
          ? "Nueva interfaz C#"
          : kind === "razorComponent"
            ? "Nuevo componente Razor"
            : "Nueva página Razor",
    prompt: placeHolder,
    validateInput: (v) => {
      const t = v.trim();
      if (!t) {
        return "Escribe un nombre.";
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) {
        return "Identificador C# típico: letra o _, luego letras, números o _.";
      }
      return undefined;
    },
  });
}

async function promptRoute(defaultRoute: string): Promise<string | undefined> {
  return vscode.window.showInputBox({
    title: "Ruta @page",
    prompt: "Ejemplo: /clientes o clientes",
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

          const content = buildContent(kind, ns, baseName, pageRoute);
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
  };

  register("class", "dotnetConv.addClass");
  register("interface", "dotnetConv.addInterface");
  register("razorComponent", "dotnetConv.addRazorComponent");
  register("razorPage", "dotnetConv.addRazorPage");
}
