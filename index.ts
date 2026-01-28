import "dotenv/config";
import Groq from "groq-sdk";
import { browserTool } from "./src/tools/browser-tool.js";

const client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
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

async function run() {
    const query = process.argv[2];
    if (!query) {
        console.error("Usage: tsx index.ts \"<your query>\"");
        process.exit(1);
    }

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
        {
            role: "system",
            content: `You are a helpful assistant with a browser tool. 
      Use the 'browser' tool to navigate the web and answer the user's request.
      You can 'start' the browser, 'navigate' to a URL, take a 'snapshot' to see the page, and 'act' (click/type) to interact.
      Always start the browser first if it's not running.
      After each navigation or interaction, take a snapshot (preferably format="ai") to understand the page state.
      When you have the answer, reply to the user.`,
        },
        { role: "user", content: query },
    ];

    console.log(`User: ${query}`);

    while (true) {
        const completion = await client.chat.completions.create({
            messages,
            model: "moonshotai/kimi-k2-instruct-0905",
            tools,
            tool_choice: "auto",
        });

        const msg = completion.choices[0]?.message;
        if (!msg) break;

        messages.push(msg);

        if (msg.tool_calls && msg.tool_calls.length > 0) {
            for (const toolCall of msg.tool_calls) {
                if (toolCall.function.name === "browser") {
                    const args = JSON.parse(toolCall.function.arguments);
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
        } else {
            console.log(`AI: ${msg.content}`);
            break;
        }
    }

    // Cleanup
    await browserTool.execute({ action: "stop" });
}

run().catch(console.error);
