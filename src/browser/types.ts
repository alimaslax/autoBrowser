export type ResolvedBrowserConfig = {
    executablePath?: string;
    headless: boolean;
    noSandbox: boolean;
    enabled?: boolean;
    controlPort?: number;
};

export type ResolvedBrowserProfile = {
    name: string;
    cdpPort: number;
    cdpUrl: string;
    cdpIsLoopback: boolean;
    color: string;
};
