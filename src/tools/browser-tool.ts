import { BrowserToolSchema, type BrowserToolParams } from "./browser-tool.schema.js";
import { browserStart, browserStop, browserSnapshot, browserAct } from "../browser/direct-client.js";

type ToolExecutionResult = {
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
};

export const browserTool = {
    name: "browser",
    description: "Control a browser to navigate, click, type, and read content.",
    parameters: BrowserToolSchema,
    execute: async (args: BrowserToolParams): Promise<ToolExecutionResult> => {
        try {
            switch (args.action) {
                case "start":
                    await browserStart({ headless: args.headless });
                    return { content: [{ type: "text", text: "Browser started." }] };

                case "stop":
                    await browserStop();
                    return { content: [{ type: "text", text: "Browser stopped." }] };

                case "snapshot": {
                    const res = await browserSnapshot({
                        format: (args.format as "aria" | "ai") ?? "ai",
                        targetId: args.targetId,
                        maxChars: args.maxChars,
                    });
                    return { content: [{ type: "text", text: res.snapshot }] };
                }

                case "act": {
                    if (!args.request) throw new Error("Missing request object for action=act");
                    await browserAct(args.request.kind, args.request);
                    return { content: [{ type: "text", text: "Action executed." }] };
                }

                default:
                    throw new Error(`Unknown action: ${args.action}`);
            }
        } catch (err) {
            return {
                content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true
            };
        }
    },
};
