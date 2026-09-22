import https from "node:https";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const ALLOWED_TAPHUAN_HOST = "taphuan.nxbgd.vn";
const READER_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type CacheEntry = {
  pages: string[];
  cachedAt: number;
};

const readerCache = new Map<string, CacheEntry>();

export function extractDownloadBookPagesUrls(html: string): string[] {
  const marker = "download_book_pages_urls";
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    return [];
  }

  const startBracket = html.indexOf("[", markerIndex);
  if (startBracket === -1) {
    return [];
  }

  const endBracket = html.indexOf("]", startBracket);
  if (endBracket === -1) {
    return [];
  }

  const jsonSlice = html.slice(startBracket, endBracket + 1);
  try {
    const rawUrls = JSON.parse(jsonSlice) as unknown;
    if (!Array.isArray(rawUrls)) return [];

    return rawUrls.filter((url): url is string => {
      if (typeof url !== "string") return false;
      try {
        const parsed = new URL(url);
        return (
          parsed.hostname === ALLOWED_TAPHUAN_HOST &&
          parsed.pathname.startsWith("/storage/upload/taphuan/")
        );
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

export function requestHttpsGet(targetUrl: string): Promise<{ statusCode: number; data: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    if (parsed.hostname !== ALLOWED_TAPHUAN_HOST) {
      return reject(new Error("Chỉ cho phép truy cập tài nguyên từ taphuan.nxbgd.vn"));
    }

    const req = https.get(targetUrl, { agent: httpsAgent, timeout: 15000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode || 200,
          data: buffer,
          contentType: res.headers["content-type"] || "application/octet-stream",
        });
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Kết nối tới taphuan.nxbgd.vn bị quá thời gian (timeout)."));
    });

    req.on("error", (err) => reject(err));
  });
}

export async function fetchTaphuanReaderPages(readerUrl: string): Promise<string[]> {
  const cached = readerCache.get(readerUrl);
  if (cached && Date.now() - cached.cachedAt < READER_CACHE_TTL_MS) {
    return cached.pages;
  }

  const res = await requestHttpsGet(readerUrl);
  if (res.statusCode !== 200) {
    throw new Error(`taphuan.nxbgd.vn trả về mã lỗi HTTP ${res.statusCode}`);
  }

  const html = res.data.toString("utf8");
  const pages = extractDownloadBookPagesUrls(html);
  if (pages.length === 0) {
    throw new Error("Không tìm thấy danh sách trang SGK trong reader của taphuan.nxbgd.vn");
  }

  readerCache.set(readerUrl, { pages, cachedAt: Date.now() });
  return pages;
}

export async function fetchTaphuanPageBuffer(pageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await requestHttpsGet(pageUrl);
  if (res.statusCode !== 200) {
    throw new Error(`Không thể tải ảnh trang SGK: HTTP ${res.statusCode}`);
  }
  return {
    buffer: res.data,
    contentType: res.contentType,
  };
}

export function clearReaderCacheForTest() {
  readerCache.clear();
}
