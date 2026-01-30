import "dotenv/config";
import OpenAI from "openai";
import { browserTool } from "./src/tools/browser-tool.js";

// Connect to local Ollama server (OpenAI-compatible API)
const client = new OpenAI({
    baseURL: "http://localhost:11434/v1",
    apiKey: "ollama", // Ollama doesn't require an API key, but OpenAI SDK needs one
});

const tools = [
    {
        type: "function" as const,
        function: {
            name: browserTool.name,
            description: browserTool.description,
            parameters: browserTool.parameters,
        },
    },
];

// Helper to extract JSON objects from text (for models that output JSON as text instead of tool calls)
function extractJsonFromText(text: string): object[] {
    const results: object[] = [];
    const jsonRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    const matches = text.match(jsonRegex);
    if (matches) {
        for (const match of matches) {
            try {
                const parsed = JSON.parse(match);
                if (parsed.action) {
                    results.push(parsed);
                }
            } catch {
                // Not valid JSON, skip
            }
        }
    }
    return results;
}

async function run() {
    const query = process.argv[2];
    if (!query) {
        console.error("Usage: tsx index.ts \"<your query>\"");
        process.exit(1);
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
            role: "system",
            content: `You are a helpful assistant with a browser tool.
You MUST use the browser tool to help the user. Always start by calling the browser tool.

IMPORTANT: Output ONE JSON object per response to call the browser tool.
The "action" parameter MUST be one of: "start", "stop", "snapshot", "act"

Available actions (output as JSON):

1. Start browser:
   {"action": "start"}

2. Stop browser:
   {"action": "stop"}

3. Take snapshot (to see the page):
   {"action": "snapshot", "format": "ai"}

4. Perform interactions - use action="act" with a "request" object:
   - Navigate: {"action": "act", "request": {"kind": "navigate", "url": "https://example.com"}}
   - Click: {"action": "act", "request": {"kind": "click", "ref": "e13"}}
   - Type: {"action": "act", "request": {"kind": "type", "ref": "e5", "text": "hello"}}

Workflow - output ONE action at a time, wait for result:
1. First: {"action": "start"}
2. Then: {"action": "act", "request": {"kind": "navigate", "url": "..."}}
3. Then: {"action": "snapshot", "format": "ai"}
4. Continue interacting based on what you see

When you have the final answer, just respond normally without JSON.`,
        },
        { role: "user", content: query },
    ];

    console.log(`User: ${query}`);

    let iterations = 0;
    const maxIterations = 20;

    while (iterations < maxIterations) {
        iterations++;

        const completion = await client.chat.completions.create({
            messages,
            model: "qwen3:1.7b",
        });

        const msg = completion.choices[0]?.message;
        if (!msg) break;

        const content = msg.content || "";

        // Check if model used proper tool calls
        if (msg.tool_calls && msg.tool_calls.length > 0) {
            messages.push(msg);
            for (const toolCall of msg.tool_calls) {
                const tc = toolCall as { id: string; function: { name: string; arguments: string } };
                if (tc.function.name === "browser") {
                    const args = JSON.parse(tc.function.arguments);
                    console.log(`Tool Call: browser.${args.action}`, args);

                    const result = await browserTool.execute(args);
                    console.log(`Tool Result:`, result.isError ? "Error" : "Success");

                    messages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: result.content[0].text,
                    });
                }
            }
            continue;
        }

        // Fallback: Try to extract JSON from text content (for smaller models)
        const jsonCommands = extractJsonFromText(content);

        if (jsonCommands.length > 0) {
            messages.push({ role: "assistant", content });

            for (const args of jsonCommands) {
                const browserArgs = args as { action: string;[key: string]: unknown };
                console.log(`Tool Call (from text): browser.${browserArgs.action}`, browserArgs);

                const result = await browserTool.execute(browserArgs);
                console.log(`Tool Result:`, result.isError ? "Error" : "Success");

                messages.push({
                    role: "user",
                    content: `Tool result: ${result.content[0].text}`,
                });
            }
        } else {
            // No JSON found - this is the final response
            console.log(`AI: ${content}`);
            break;
        }
    }

    // Cleanup
    await browserTool.execute({ action: "stop" });
}

run().catch(console.error);
