export type AIProvider = "openai" | "gemini";
export interface AISelection { provider?: AIProvider; model?: string }
export interface AIModel { id: string; name: string; preview: boolean; created?: number }
export interface AIProviderModels {
  provider: AIProvider;
  configured: boolean;
  models: AIModel[];
  latest: string | null;
  error?: string;
}
export interface AIModelCatalog { providers: AIProviderModels[] }
