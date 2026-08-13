import type {
  LinkCheck,
  OutfitReviewRequest,
} from "../../src/domain/aiContracts.js";

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5000;

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

export function isBlockedHostname(value: string) {
  const hostname = value.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    isPrivateIpv4(hostname) ||
    hostname === "::" ||
    hostname === "::1" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe80:") ||
    hostname.startsWith("::ffff:127.") ||
    hostname.startsWith("::ffff:10.") ||
    hostname.startsWith("::ffff:192.168.")
  );
}

async function assertPublicHost(hostname: string) {
  if (isBlockedHostname(hostname)) {
    throw new Error("내부 네트워크 주소는 사용할 수 없습니다.");
  }
  const dnsModuleName = "node:dns/promises";
  const { lookup } = (await import(dnsModuleName)) as {
    lookup(
      hostname: string,
      options: { all: true },
    ): Promise<Array<{ address: string }>>;
  };
  const addresses = await lookup(hostname, { all: true });
  if (addresses.some(({ address }) => isBlockedHostname(address))) {
    throw new Error("내부 네트워크로 연결되는 주소는 사용할 수 없습니다.");
  }
}

function parsePublicUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL 형식이 올바르지 않습니다.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("http 또는 https URL만 사용할 수 있습니다.");
  }
  if (url.username || url.password) {
    throw new Error("인증 정보가 포함된 URL은 사용할 수 없습니다.");
  }
  return url;
}

async function fetchWithTimeout(url: URL, method: "HEAD" | "GET") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "BiasFit-Link-Checker/1.0" },
    });
  } finally {
    clearTimeout(timer);
  }
}

export function isRetryableLinkStatus(status: number) {
  return status === 401 || status === 403 || status === 429 || status >= 500;
}

export function classifyLinkStatus(status: number): LinkCheck["status"] {
  if (status >= 200 && status < 400) return "pass";
  if (isRetryableLinkStatus(status)) return "operations_review";
  if ([404, 410].includes(status)) return "needs_revision";
  return "failed";
}

async function fetchWithRetry(url: URL, method: "HEAD" | "GET") {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, method);
      if (attempt === 0 && isRetryableLinkStatus(response.status)) continue;
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === 0) continue;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("링크 재시도 실패");
}

async function inspectUrl(inputUrl: string) {
  let current = parsePublicUrl(inputUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicHost(current.hostname);
    let response = await fetchWithRetry(current, "HEAD");
    if (response.status === 405) {
      response = await fetchWithRetry(current, "GET");
      await response.body?.cancel();
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("리다이렉트 주소가 없습니다.");
      if (redirect === MAX_REDIRECTS) {
        throw new Error("허용된 리다이렉트 횟수를 초과했습니다.");
      }
      current = new URL(location, current);
      continue;
    }
    return { status: response.status, finalUrl: current.toString() };
  }
  throw new Error("링크 확인을 완료하지 못했습니다.");
}

async function checkSingleLink(
  memberId: LinkCheck["memberId"],
  itemType: LinkCheck["itemType"],
  inputUrl: string,
): Promise<LinkCheck> {
  try {
    const { status, finalUrl } = await inspectUrl(inputUrl);
    const linkStatus = classifyLinkStatus(status);
    if (linkStatus === "pass") {
      return {
        memberId,
        itemType,
        inputUrl,
        finalUrl,
        status: "pass",
        reason: "제품 페이지에 접속할 수 있습니다.",
        action: "조치 없음",
      };
    }
    if (linkStatus === "operations_review") {
      return {
        memberId,
        itemType,
        inputUrl,
        finalUrl,
        status: "operations_review",
        reason: `자동 점검 제한 또는 일시 오류 (${status})`,
        action: "운영진 검토",
      };
    }
    if (linkStatus === "needs_revision") {
      return {
        memberId,
        itemType,
        inputUrl,
        finalUrl,
        status: "needs_revision",
        reason: `제품 페이지를 찾을 수 없습니다. (${status})`,
        action: "링크 수정",
      };
    }
    return {
      memberId,
      itemType,
      inputUrl,
      finalUrl,
      status: "failed",
      reason: `제품 페이지에 접속할 수 없습니다 (${status})`,
      action: "링크 수정",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "링크 확인 실패";
    const temporary = /abort|timeout|network|fetch failed/i.test(message);
    return {
      memberId,
      itemType,
      inputUrl,
      finalUrl: null,
      status: temporary ? "operations_review" : "failed",
      reason: message,
      action: temporary ? "운영진 검토" : "링크 수정",
    };
  }
}

export async function checkProductLinks(cards: OutfitReviewRequest["cards"]) {
  return Promise.all(
    cards.flatMap((card) => [
      checkSingleLink(card.memberId, "top", card.top.url),
      checkSingleLink(card.memberId, "bottom", card.bottom.url),
    ]),
  );
}
