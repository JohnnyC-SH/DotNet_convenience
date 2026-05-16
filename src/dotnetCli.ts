import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as vscode from "vscode";

const execFileAsync = promisify(execFile);

export type DotnetResult = {
  stdout: string;
  stderr: string;
};

export async function runDotnet(args: string[], cwd?: string): Promise<DotnetResult> {
  const { stdout, stderr } = await execFileAsync("dotnet", args, {
    cwd,
    maxBuffer: 20 * 1024 * 1024,
  });
  return { stdout: String(stdout ?? ""), stderr: String(stderr ?? "") };
}

export async function runDotnetWithOutput(
  args: string[],
  cwd: string | undefined,
  title: string,
): Promise<void> {
  const channel = vscode.window.createOutputChannel(".NET Convenience");
  channel.show(true);
  channel.appendLine(`> dotnet ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ")}`);
  if (cwd) {
    channel.appendLine(`(cwd) ${cwd}`);
  }
  try {
    const { stdout, stderr } = await runDotnet(args, cwd);
    if (stdout) {
      channel.appendLine(stdout.trimEnd());
    }
    if (stderr) {
      channel.appendLine(stderr.trimEnd());
    }
    vscode.window.setStatusBarMessage(`${title}: listo`, 5000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    channel.appendLine(msg);
    vscode.window.showErrorMessage(`${title} falló. Revisa el canal de salida ".NET Convenience".`);
    throw e;
  }
}
