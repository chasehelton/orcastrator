// Copilot SDK client wrapper

import { CopilotClient, approveAll } from "@github/copilot-sdk";
import type { CopilotSession } from "@github/copilot-sdk";
import type { SessionConfig } from "../core/types.js";

let _client: CopilotClient | null = null;

export async function getClient(): Promise<CopilotClient> {
  if (_client) return _client;

  const token = process.env.GITHUB_TOKEN;

  _client = new CopilotClient({
    ...(token ? { githubToken: token } : {}),
    useLoggedInUser: true,
  });

  await _client.start();

  const authStatus = await _client.getAuthStatus();
  if (!authStatus.isAuthenticated) {
    _client = null;
    throw new Error(
      `Copilot authentication failed. ${authStatus.statusMessage ?? ""}` +
        `\nEnsure you're logged in via \`gh auth login\` or set GITHUB_TOKEN.`,
    );
  }

  return _client;
}

export async function createSession(
  config: SessionConfig,
): Promise<CopilotSession> {
  const client = await getClient();

  const session = await client.createSession({
    model: config.model,
    systemMessage: { mode: "replace", content: config.systemMessage },
    streaming: true,
    onPermissionRequest: approveAll,
    ...(config.workingDirectory
      ? { workingDirectory: config.workingDirectory }
      : {}),
  });

  return session;
}

export async function sendMessage(
  session: CopilotSession,
  prompt: string,
  timeout = 300_000,
): Promise<string> {
  const result = await session.sendAndWait({ prompt }, timeout);
  return (
    result?.data?.content ?? "Task completed but no text response was returned."
  );
}

export async function closeSession(
  session: CopilotSession,
): Promise<void> {
  try {
    await session.disconnect();
  } catch {
    // Session may already be disconnected
  }
}

export async function stopClient(): Promise<void> {
  if (_client) {
    try {
      await _client.stop();
    } catch {
      // Ignore cleanup errors
    }
    _client = null;
  }
}
