import type { GenerationPipelineMode } from "@/lib/generation/pipeline-mode";
import { createServerAuthSession } from "@/lib/auth-client";

export function resolveClientGenerationPipelineMode(
  value: string | undefined,
): GenerationPipelineMode {
  return value?.trim().toLowerCase() === "staged" ? "staged" : "legacy";
}

export function configuredClientGenerationPipelineMode() {
  return resolveClientGenerationPipelineMode(process.env.NEXT_PUBLIC_GENERATION_PIPELINE_MODE);
}

export class ClientGenerationConfigError extends Error {
  constructor(
    message: string,
    public readonly code = "GENERATION_CONFIG_UNAVAILABLE",
    public readonly retryable = true,
  ) {
    super(message);
    this.name = "CLIENT_GENERATION_CONFIG_ERROR";
  }
}

export async function loadEffectiveClientGenerationPipelineMode(
  options: {
    publicMode?: GenerationPipelineMode;
    authToken?: string;
    fetcher?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<GenerationPipelineMode> {
  const publicMode = options.publicMode || configuredClientGenerationPipelineMode();
  if (publicMode !== "staged") return "legacy";
  const fetcher = options.fetcher || fetch;
  const headers: Record<string, string> = {};
  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }

  async function executeRequest(allowBootstrap: boolean): Promise<GenerationPipelineMode> {
    options.signal?.throwIfAborted();
    let response: Response;
    try {
      response = await fetcher("/api/lesson/generation-config", {
        method: "GET",
        headers,
        cache: "no-store",
        signal: options.signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ClientGenerationConfigError(
        "Không thể tải cấu hình quy trình nhiều bước. Chưa chuyển sang quy trình một bước; vui lòng kiểm tra kết nối và thử tải lại cấu hình.",
        "GENERATION_CONFIG_NETWORK_ERROR",
        true,
      );
    }

    if (response.status === 401 && allowBootstrap && options.authToken) {
      try {
        await createServerAuthSession({
          user: { getIdToken: async () => options.authToken as string },
          fetcher: (url, init) => fetcher(url, { ...init, signal: options.signal }),
        });
        return await executeRequest(false);
      } catch {
        // Fall through to parse original 401
      }
    }

    let result: unknown;
    try {
      result = JSON.parse(await response.text());
    } catch {
      throw new ClientGenerationConfigError(
        "Máy chủ trả phản hồi không hợp lệ khi tải cấu hình quy trình tạo giáo án.",
        "INVALID_CONFIG_RESPONSE",
        true,
      );
    }

    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new ClientGenerationConfigError(
        "Cấu hình quy trình tạo giáo án không hợp lệ. Vui lòng thử tải lại cấu hình.",
        "INVALID_CONFIG_RESPONSE",
        true,
      );
    }
    const config = result as Record<string, unknown>;
    if (!response.ok) {
      throw new ClientGenerationConfigError(
        typeof config.error === "string" ? config.error : "Không thể tải cấu hình quy trình tạo giáo án. Vui lòng thử lại.",
        typeof config.code === "string" ? config.code : "GENERATION_CONFIG_UNAVAILABLE",
        typeof config.retryable === "boolean" ? config.retryable : response.status >= 500,
      );
    }
    if (config.pipelineMode === "staged" && config.stagedAvailable === true) return "staged";
    if (config.pipelineMode === "legacy" && config.stagedAvailable === false) return "legacy";
    throw new ClientGenerationConfigError(
      "Cấu hình quy trình tạo giáo án không hợp lệ. Vui lòng thử tải lại cấu hình.",
      "INVALID_CONFIG_RESPONSE",
      true,
    );
  }

  return executeRequest(true);
}
