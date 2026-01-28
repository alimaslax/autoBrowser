import {
    launchClawdChrome,
    stopClawdChrome,
    type RunningChrome,
    isChromeReachable,
} from "./chrome.js";
import {
    navigateViaPlaywright,
    snapshotAriaViaPlaywright,
    snapshotAiViaPlaywright,
} from "./pw-tools-core.snapshot.js";
import {
    clickViaPlaywright,
    typeViaPlaywright,
    scrollIntoViewViaPlaywright,
    hoverViaPlaywright,
} from "./pw-tools-core.interactions.js";

let activeBrowser: RunningChrome | null = null;

export async function browserStart(opts?: { headless?: boolean }) {
    if (activeBrowser) {
        if (await isChromeReachable(`http://127.0.0.1:${activeBrowser.cdpPort}`)) {
            return;
        }
        activeBrowser = null;
    }

    const profileName = "default";
    activeBrowser = await launchClawdChrome(
        {
            headless: opts?.headless ?? false,
            noSandbox: false,
        },
        {
            name: profileName,
            cdpPort: 9222,
            cdpUrl: "http://127.0.0.1:9222",
            cdpIsLoopback: true,
            color: "#ff0000",
        }
    );
}

export async function browserStop() {
    if (!activeBrowser) return;
    await stopClawdChrome(activeBrowser);
    activeBrowser = null;
}

function getCdpUrl() {
    if (!activeBrowser) throw new Error("Browser not started");
    return `http://127.0.0.1:${activeBrowser.cdpPort}`;
}

export type SnapshotResult = {
    ok: true;
    format: "aria" | "ai";
    snapshot: string;
    refs?: Record<string, any>;
};

export async function browserSnapshot(opts: {
    format: "aria" | "ai";
    targetId?: string;
    maxChars?: number;
}): Promise<SnapshotResult> {
    const cdpUrl = getCdpUrl();

    if (opts.format === "ai") {
        const res = await snapshotAiViaPlaywright({
            cdpUrl,
            targetId: opts.targetId,
            maxChars: opts.maxChars,
        });
        return { ok: true, format: "ai", snapshot: res.snapshot, refs: res.refs };
    }

    if (opts.format === "aria") {
        const res = await snapshotAriaViaPlaywright({
            cdpUrl,
            targetId: opts.targetId,
        });
        // Simple text serialization for aria tree
        const snapshot = JSON.stringify(res.nodes, null, 2);
        return { ok: true, format: "aria", snapshot };
    }

    throw new Error("Unsupported format");
}

export async function browserAct(action: string, args: any) {
    const cdpUrl = getCdpUrl();
    const common = { cdpUrl, targetId: args.targetId };

    switch (action) {
        case "navigate":
            return await navigateViaPlaywright({ ...common, url: args.url });
        case "click":
            return await clickViaPlaywright({
                ...common,
                ref: args.ref,
                button: args.button,
                // Removed verified as it's not supported by core tools
            });
        case "type":
            return await typeViaPlaywright({
                ...common,
                ref: args.ref,
                text: args.text,
                submit: args.pressEnter
            });
        case "scroll":
            return await scrollIntoViewViaPlaywright({ ...common, ref: args.ref });
        case "hover":
            return await hoverViaPlaywright({ ...common, ref: args.ref });
        default:
            throw new Error(`Unknown action: ${action}`);
    }
}
