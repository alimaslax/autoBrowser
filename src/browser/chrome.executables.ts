import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ResolvedBrowserConfig } from "./types.js";

export type BrowserExecutable = {
  kind: "brave" | "canary" | "chromium" | "chrome" | "custom" | "edge";
  path: string;
};

const CHROMIUM_BUNDLE_IDS = new Set([
  "com.google.Chrome",
  "com.google.Chrome.beta",
  "com.google.Chrome.canary",
  "com.google.Chrome.dev",
  "com.brave.Browser",
  "com.brave.Browser.beta",
  "com.brave.Browser.nightly",
  "com.microsoft.Edge",
  "com.microsoft.EdgeBeta",
  "com.microsoft.EdgeDev",
  "com.microsoft.EdgeCanary",
  "org.chromium.Chromium",
  "com.vivaldi.Vivaldi",
  "com.operasoftware.Opera",
  "com.operasoftware.OperaGX",
  "com.yandex.desktop.yandex-browser",
  "company.thebrowser.Browser", // Arc
]);

const CHROMIUM_DESKTOP_IDS = new Set([
  "google-chrome.desktop",
  "google-chrome-beta.desktop",
  "google-chrome-unstable.desktop",
  "brave-browser.desktop",
  "microsoft-edge.desktop",
  "microsoft-edge-beta.desktop",
  "microsoft-edge-dev.desktop",
  "microsoft-edge-canary.desktop",
  "chromium.desktop",
  "chromium-browser.desktop",
  "vivaldi.desktop",
  "vivaldi-stable.desktop",
  "opera.desktop",
  "opera-gx.desktop",
  "yandex-browser.desktop",
  "org.chromium.Chromium.desktop",
]);

const CHROMIUM_EXE_NAMES = new Set([
  "chrome.exe",
  "msedge.exe",
  "brave.exe",
  "brave-browser.exe",
  "chromium.exe",
  "vivaldi.exe",
  "opera.exe",
  "launcher.exe",
  "yandex.exe",
  "yandexbrowser.exe",
  // mac/linux names
  "google chrome",
  "google chrome canary",
  "brave browser",
  "microsoft edge",
  "chromium",
  "chrome",
  "brave",
  "msedge",
  "brave-browser",
  "google-chrome",
  "google-chrome-stable",
  "google-chrome-beta",
  "google-chrome-unstable",
  "microsoft-edge",
  "microsoft-edge-beta",
  "microsoft-edge-dev",
  "microsoft-edge-canary",
  "chromium-browser",
  "vivaldi",
  "vivaldi-stable",
  "opera",
  "opera-stable",
  "opera-gx",
  "yandex-browser",
]);

function exists(filePath: string) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function execText(
  command: string,
  args: string[],
  timeoutMs = 1200,
  maxBuffer = 1024 * 1024,
): string | null {
  try {
    const output = execFileSync(command, args, {
      timeout: timeoutMs,
      encoding: "utf8",
      maxBuffer,
    });
    return String(output ?? "").trim() || null;
  } catch {
    return null;
  }
}

function inferKindFromIdentifier(identifier: string): BrowserExecutable["kind"] {
  const id = identifier.toLowerCase();
  if (id.includes("brave")) return "brave";
  if (id.includes("edge")) return "edge";
  if (id.includes("chromium")) return "chromium";
  if (id.includes("canary")) return "canary";
  if (
    id.includes("opera") ||
    id.includes("vivaldi") ||
    id.includes("yandex") ||
    id.includes("thebrowser")
  ) {
    return "chromium";
  }
  return "chrome";
}

function inferKindFromExecutableName(name: string): BrowserExecutable["kind"] {
  const lower = name.toLowerCase();
  if (lower.includes("brave")) return "brave";
  if (lower.includes("edge") || lower.includes("msedge")) return "edge";
  if (lower.includes("chromium")) return "chromium";
  if (lower.includes("canary") || lower.includes("sxs")) return "canary";
  if (lower.includes("opera") || lower.includes("vivaldi") || lower.includes("yandex"))
    return "chromium";
  return "chrome";
}

function detectDefaultChromiumExecutable(platform: NodeJS.Platform): BrowserExecutable | null {
  if (platform === "darwin") return detectDefaultChromiumExecutableMac();
  if (platform === "linux") return detectDefaultChromiumExecutableLinux();
  if (platform === "win32") return detectDefaultChromiumExecutableWindows();
  return null;
}

function detectDefaultChromiumExecutableMac(): BrowserExecutable | null {
  const bundleId = detectDefaultBrowserBundleIdMac();
  if (!bundleId || !CHROMIUM_BUNDLE_IDS.has(bundleId)) return null;

  const appPathRaw = execText("/usr/bin/osascript", [
    "-e",
    `POSIX path of (path to application id "${bundleId}")`,
  ]);
  if (!appPathRaw) return null;
  const appPath = appPathRaw.trim().replace(/\/$/, "");
  const exeName = execText("/usr/bin/defaults", [
    "read",
    path.join(appPath, "Contents", "Info"),
    "CFBundleExecutable",
  ]);
  if (!exeName) return null;
  const exePath = path.join(appPath, "Contents", "MacOS", exeName.trim());
  if (!exists(exePath)) return null;
  return { kind: inferKindFromIdentifier(bundleId), path: exePath };
}

function detectDefaultBrowserBundleIdMac(): string | null {
  const plistPath = path.join(
    os.homedir(),
    "Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist",
  );
  if (!exists(plistPath)) return null;
  const handlersRaw = execText(
    "/usr/bin/plutil",
    ["-extract", "LSHandlers", "json", "-o", "-", "--", plistPath],
    2000,
    5 * 1024 * 1024,
  );
  if (!handlersRaw) return null;
  let handlers: unknown;
  try {
    handlers = JSON.parse(handlersRaw);
  } catch {
    return null;
  }
  if (!Array.isArray(handlers)) return null;

  const resolveScheme = (scheme: string) => {
    let candidate: string | null = null;
    for (const entry of handlers) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      if (record.LSHandlerURLScheme !== scheme) continue;
      const role =
        (typeof record.LSHandlerRoleAll === "string" && record.LSHandlerRoleAll) ||
        (typeof record.LSHandlerRoleViewer === "string" && record.LSHandlerRoleViewer) ||
        null;
      if (role) candidate = role;
    }
    return candidate;
  };

  return resolveScheme("http") ?? resolveScheme("https");
}

function detectDefaultChromiumExecutableLinux(): BrowserExecutable | null {
  // Best-effort Linux detection
  const candidates = [
    { kind: "chrome", path: "/usr/bin/google-chrome" },
    { kind: "chromium", path: "/usr/bin/chromium" },
    { kind: "chromium", path: "/usr/bin/chromium-browser" },
  ] as const;

  for (const c of candidates) {
    if (exists(c.path)) return { kind: c.kind, path: c.path };
  }
  return null;
}

function detectDefaultChromiumExecutableWindows(): BrowserExecutable | null {
  // Simplification for extraction: assume default paths or PATH availability
  return null;
}


function findFirstExecutable(candidates: Array<BrowserExecutable>): BrowserExecutable | null {
  for (const candidate of candidates) {
    if (exists(candidate.path)) return candidate;
  }

  return null;
}

export function findChromeExecutableMac(): BrowserExecutable | null {
  const candidates: Array<BrowserExecutable> = [
    {
      kind: "chrome",
      path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
    {
      kind: "chrome",
      path: path.join(os.homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    },
    {
      kind: "brave",
      path: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    },
    {
      kind: "brave",
      path: path.join(os.homedir(), "Applications/Brave Browser.app/Contents/MacOS/Brave Browser"),
    },
    {
      kind: "chromium",
      path: "/Applications/Chromium.app/Contents/MacOS/Chromium",
    },
    {
      kind: "chromium",
      path: path.join(os.homedir(), "Applications/Chromium.app/Contents/MacOS/Chromium"),
    },
    {
      kind: "canary",
      path: "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    },
  ];

  return findFirstExecutable(candidates);
}

export function findChromeExecutableLinux(): BrowserExecutable | null {
  const candidates: Array<BrowserExecutable> = [
    { kind: "chrome", path: "/usr/bin/google-chrome" },
    { kind: "chrome", path: "/usr/bin/google-chrome-stable" },
    { kind: "chrome", path: "/usr/bin/chrome" },
    { kind: "chromium", path: "/usr/bin/chromium" },
    { kind: "chromium", path: "/usr/bin/chromium-browser" },
    { kind: "chromium", path: "/snap/bin/chromium" },
  ];

  return findFirstExecutable(candidates);
}

export function findChromeExecutableWindows(): BrowserExecutable | null {
  // Simplified windows detection
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const joinWin = path.win32.join;

  const candidates: BrowserExecutable[] = [
    { kind: "chrome", path: joinWin(programFiles, "Google", "Chrome", "Application", "chrome.exe") },
    { kind: "chrome", path: joinWin(programFilesX86, "Google", "Chrome", "Application", "chrome.exe") },
  ];
  return findFirstExecutable(candidates);
}

export function resolveBrowserExecutableForPlatform(
  resolved: ResolvedBrowserConfig,
  platform: NodeJS.Platform,
): BrowserExecutable | null {
  if (resolved.executablePath) {
    if (!exists(resolved.executablePath)) {
      throw new Error(`browser.executablePath not found: ${resolved.executablePath}`);
    }
    return { kind: "custom", path: resolved.executablePath };
  }

  const detected = detectDefaultChromiumExecutable(platform);
  if (detected) return detected;

  if (platform === "darwin") return findChromeExecutableMac();
  if (platform === "linux") return findChromeExecutableLinux();
  if (platform === "win32") return findChromeExecutableWindows();
  return null;
}
