import type { UploadedAsset } from "@/types/lesson";

export function generationOcrAssetSequence(name?: string) {
  const baseName = (name || "").replace(/\.[^.]+$/, "");
  const exactNumber = baseName.match(/^\s*0*(\d+)\s*$/);
  if (exactNumber) return Number(exactNumber[1]);
  const labeledNumber = baseName.match(/(?:^|[\s._-])(?:trang|page|p|sgk|anh|ảnh)?\s*0*(\d+)(?=$|[\s._-])/i);
  return labeledNumber ? Number(labeledNumber[1]) : null;
}

export function sortGenerationOcrAssets<T extends UploadedAsset>(assets: T[]) {
  return assets
    .map((asset, uploadIndex) => ({
      asset,
      uploadIndex,
      order: typeof asset.order === "number" && Number.isFinite(asset.order) ? asset.order : null,
      sequence: generationOcrAssetSequence(asset.name),
    }))
    .sort((a, b) => {
      if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
      if (a.order !== null && b.order === null) return -1;
      if (a.order === null && b.order !== null) return 1;
      if (a.sequence !== null && b.sequence !== null && a.sequence !== b.sequence) return a.sequence - b.sequence;
      if (a.sequence !== null && b.sequence === null) return -1;
      if (a.sequence === null && b.sequence !== null) return 1;
      return a.uploadIndex - b.uploadIndex;
    })
    .map((item) => item.asset);
}
