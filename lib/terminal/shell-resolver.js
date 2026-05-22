import path from "node:path";
import { resolveShellProfile as resolveDefaultShellProfile } from "../shell/shell-profile.js";
import {
  getWin32ShellEnvForRuntime,
  resolveWin32ShellRuntime,
} from "../sandbox/win32-exec.js";

function envValue(env, name) {
  const source = env || {};
  const direct = source[name];
  if (direct) return direct;
  const key = Object.keys(source).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? source[key] : undefined;
}

function resolveCmd(env) {
  return envValue(env, "COMSPEC") || envValue(process.env, "COMSPEC") || "cmd.exe";
}

function isWin32PathLike(filePath) {
  return /^[a-z]:[\\/]|^\\\\/i.test(String(filePath || ""));
}

function tokenBaseName(token) {
  const raw = String(token || "");
  const base = isWin32PathLike(raw) || raw.includes("\\")
    ? path.win32.basename(raw)
    : path.basename(raw);
  return base.toLowerCase();
}

function splitShellLikeArgs(command) {
  const args = [];
  let current = "";
  let quote = null;

  const input = String(command || "");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (ch === "\\" && quote !== "'") {
      const next = input[i + 1];
      if (next && (/\s/.test(next) || next === "'" || next === "\"" || next === "\\")) {
        current += next;
        i += 1;
      } else {
        current += ch;
      }
      continue;
    }

    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }

    if (ch === "'" || ch === "\"") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) args.push(current);
  return args;
}

function quoteCmdArg(arg, { always = false } = {}) {
  const text = String(arg ?? "");
  if (!always && /^[^\s"&|<>^()]+$/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function isBatchToken(token) {
  return /\.(?:bat|cmd)$/i.test(tokenBaseName(token));
}

function isPowerShellToken(token) {
  return ["powershell", "powershell.exe", "pwsh", "pwsh.exe"].includes(tokenBaseName(token));
}

function isCmdToken(token) {
  return ["cmd", "cmd.exe"].includes(tokenBaseName(token));
}

function powershellExecutableForToken(token, env) {
  const raw = String(token || "");
  if (isWin32PathLike(raw) || raw.includes("\\") || raw.includes("/")) return raw;
  const base = tokenBaseName(raw);
  if (base === "pwsh" || base === "pwsh.exe") {
    return envValue(env, "HANA_POWERSHELL") || "pwsh.exe";
  }
  return "powershell.exe";
}

function powershellArgsForExplicit(rest) {
  const baseArgs = ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass"];
  return rest.length ? [...baseArgs, ...rest] : baseArgs;
}

function resolvePowerShellTerminal(input, env) {
  const args = splitShellLikeArgs(input);
  const executable = powershellExecutableForToken(args[0], env);
  return {
    file: executable,
    args: powershellArgsForExplicit(args.slice(1)),
    env,
  };
}

function resolveBatchTerminal(input, env) {
  const args = splitShellLikeArgs(input);
  const command = [
    quoteCmdArg(args[0], { always: true }),
    ...args.slice(1).map((arg) => quoteCmdArg(arg)),
  ].join(" ");
  return {
    file: resolveCmd(env),
    args: ["/d", "/s", "/c", `call ${command}`],
    env: undefined,
  };
}

function resolveExplicitCmdTerminal(input, env) {
  const args = splitShellLikeArgs(input).slice(1);
  return {
    file: resolveCmd(env),
    args: args.length ? args : [],
    env: undefined,
  };
}

export function resolveTerminalShell(command = "", {
  platform = process.platform,
  env = process.env,
  profile = "default",
  resolveShellProfile = resolveDefaultShellProfile,
  resolveWin32ShellRuntime: resolveWin32Shell = resolveWin32ShellRuntime,
  getWin32ShellEnvForRuntime: getWin32ShellEnv = getWin32ShellEnvForRuntime,
} = {}) {
  const input = typeof command === "string" ? command : "";
  const tokens = splitShellLikeArgs(input);
  const firstToken = tokens[0] || "";

  if (platform === "win32") {
    if (firstToken && isPowerShellToken(firstToken)) return resolvePowerShellTerminal(input, env);
    if (firstToken && isBatchToken(firstToken)) return resolveBatchTerminal(input, env);
    if (firstToken && isCmdToken(firstToken)) return resolveExplicitCmdTerminal(input, env);
  }

  const shellProfile = resolveShellProfile({
    platform,
    profile,
    env,
    resolveWin32ShellRuntime: resolveWin32Shell,
    getWin32ShellEnvForRuntime: getWin32ShellEnv,
  });
  const args = input
    ? shellProfile.argsForCommand(input)
    : shellProfile.argsForInteractive();

  return {
    file: shellProfile.executable,
    args,
    env: shellProfile.env && shellProfile.env !== env ? shellProfile.env : (platform === "win32" && shellProfile.family === "powershell" ? env : undefined),
  };
}

export const __testing = {
  splitShellLikeArgs,
  tokenBaseName,
};
