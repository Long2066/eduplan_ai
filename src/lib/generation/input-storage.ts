import "server-only";
import { parseLessonImageDataUrl } from "@/lib/lesson-image-payload";
import type { PersistedGenerationInput } from "@/lib/generation/job-types";
import type { LessonInput } from "@/types/lesson";

export async function persistGenerationInput(
  _uid: string,
  _jobId: string,
  input: LessonInput,
): Promise<PersistedGenerationInput> {
  return {
    ...input,
    uploadedAssets: input.uploadedAssets.map((asset) => {
      const parsed = asset.dataUrl ? parseLessonImageDataUrl(asset.dataUrl) : null;
      const { dataUrl: _dataUrl, previewUrl: _previewUrl, ...metadata } = asset;
      return {
        ...metadata,
        ...(parsed?.mimeType ? { mimeType: parsed.mimeType } : {}),
      };
    }),
  };
}

export async function deletePersistedGenerationInput(
  _uid: string,
  _jobId: string,
  _input: PersistedGenerationInput | null,
) {
  // Images stay in the browser and are never persisted by the staged pipeline.
}

export function lessonInputFromPersisted(input: PersistedGenerationInput): LessonInput {
  return {
    ...input,
    uploadedAssets: input.uploadedAssets.map((asset) => ({ ...asset })),
  };
}
