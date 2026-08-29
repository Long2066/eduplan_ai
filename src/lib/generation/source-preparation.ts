import "server-only";
import { generationSubjectKind } from "@/lib/generation/subject-routing";
import { buildSourceTruth, type SourceTruth } from "@/lib/generation/source-truth";
import { readNaturalSocialSourceInventory } from "@/lib/natural-social-source-inventory-store";
import { readVietnameseSourceInventory } from "@/lib/vietnamese-source-inventory-store";
import type { LessonInput, NaturalSocialSourceInventory, VietnameseSourceInventory } from "@/types/lesson";

export type StagedSourceContext = {
  subjectKind: ReturnType<typeof generationSubjectKind>;
  ocrSourceHashes: string[];
  sourceTruth: SourceTruth;
  vietnamese?: {
    lessonKey: string;
    verifiedStatus: string;
    sourceHashes: string[];
    inventory: VietnameseSourceInventory;
  };
  naturalSocial?: {
    lessonKey: string;
    verifiedStatus: string;
    sourceHashes: string[];
    inventory: NaturalSocialSourceInventory;
  };
  warnings: string[];
};

export async function prepareStagedSourceContext(
  input: LessonInput,
  ocrSourceHashes: string[],
  ocrText = "",
): Promise<StagedSourceContext> {
  const subjectKind = generationSubjectKind(input);
  const context: StagedSourceContext = {
    subjectKind,
    ocrSourceHashes,
    sourceTruth: buildSourceTruth({ input, ocrText, sourceHashes: ocrSourceHashes }),
    warnings: [],
  };

  if (subjectKind === "vietnamese") {
    try {
      const cached = await readVietnameseSourceInventory(input);
      if (cached?.inventory) {
        context.vietnamese = {
          lessonKey: cached.lessonKey,
          verifiedStatus: cached.verifiedStatus,
          sourceHashes: cached.sourceHashes,
          inventory: cached.inventory,
        };
      }
    } catch (error) {
      context.warnings.push(error instanceof Error ? error.message : "Không thể đọc cache nguồn Tiếng Việt.");
    }
  }

  if (subjectKind === "natural-social") {
    try {
      const cached = await readNaturalSocialSourceInventory(input);
      if (cached?.inventory) {
        context.naturalSocial = {
          lessonKey: cached.lessonKey,
          verifiedStatus: cached.verifiedStatus,
          sourceHashes: cached.sourceHashes,
          inventory: cached.inventory,
        };
      }
    } catch (error) {
      context.warnings.push(error instanceof Error ? error.message : "Không thể đọc cache nguồn Tự nhiên và Xã hội.");
    }
  }

  context.sourceTruth = buildSourceTruth({
    input,
    ocrText,
    sourceHashes: ocrSourceHashes,
    vietnameseInventory: context.vietnamese?.inventory,
    naturalSocialInventory: context.naturalSocial?.inventory,
  });

  return context;
}
