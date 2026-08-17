/**
 * 상품 링크를 화면에 보여줄 때 쓰는 도메인 표기.
 *
 * `https://www.arielstyle.co.kr/product/%ED%95%9C...` → `arielstyle.co.kr`
 *
 * 퍼센트 인코딩된 경로는 사용자에게 알려주는 것이 없으면서 줄을 길게 만든다.
 * 말줄임(text-overflow)으로 가려 왔는데, 이미지 저장에 쓰는 html2canvas 1.4.1에는
 * `text-overflow` 구현이 없어서 저장본에서는 가려지지 않는다. 표시 자체를 짧게 만들어
 * 말줄임에 기대지 않는다. **링크의 href는 원본 URL 그대로 둔다.**
 */
export function productUrlLabel(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const host = new URL(trimmed).hostname;
    return host.replace(/^www\./, "");
  } catch {
    // 주소 형식이 아니면(인플루언서가 도메인만 적는 등) 원본을 그대로 보여준다.
    // 조용히 빈 값으로 만들면 사용자가 어디로 가는 링크인지 알 수 없다.
    return trimmed;
  }
}
