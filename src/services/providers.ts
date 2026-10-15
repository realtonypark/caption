import { apiRequest } from "./firebase";
export interface ProviderModel {
  id: string;
  name: string;
  reasoning: boolean;
}
export interface ProviderConnection {
  id: string;
  provider: string;
  name: string;
  kind: "api" | "subscription";
  models: ProviderModel[];
  enabled: string[];
}
export const PROVIDER_CATALOG = [
  { id: "openrouter", name: "OpenRouter" },
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic" },
  { id: "meta", name: "Meta" },
];
export const providerCommand = async (body: Record<string, unknown>) =>
  (await apiRequest("providers", body)).json() as Promise<{
    connections?: ProviderConnection[];
    connection?: ProviderConnection;
  }>;
export const listConnections = async () =>
  (await providerCommand({ command: "list" })).connections ?? [];
