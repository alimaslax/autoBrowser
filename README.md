# Moltbot Browser Tool Extraction

This is a standalone extraction of the Moltbot browser tool, driven by a Groq AI agent.

## Setup

1.  **Install Dependencies**
    ```bash
    cd extract
    pnpm install
    # or
    npm install
    ```

2.  **Environment Variables**
    You need a Groq API key to run the agent.
    ```bash
    export GROQ_API_KEY="gsk_..."
    ```

## Usage

Run the agent with a prompt:

```bash
npx tsx index.ts "Go to google.com and search for 'Moltbot AI' and tell me the first result title"
```

## Architecture

-   `src/browser/`: Core Playwright automation logic (adapted from Moltbot).
-   `src/tools/`: The `browser` tool definition and schema.
-   `index.ts`: The main entry point running the Groq agent loop.
-   `src/browser/direct-client.ts`: The simplified client matching the tool actions to Playwright functions.

