import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * QR에 담을 문자열.
 *
 * 상품 주소는 한글이 퍼센트 인코딩돼 241자였다. 인코딩을 풀면 89자로 줄고 QR 칸 수가
 * 49 → 41로 작아진다 — 같은 크기에서 칸 하나가 커져 훨씬 잘 읽힌다.
 *
 * 다만 **되돌렸을 때 원본과 정확히 같은 주소일 때만** 푼다. `%2F`처럼 경로 안에서
 * 의미를 가지는 인코딩을 풀면 다른 주소가 되어 버린다.
 */
export function qrPayload(url: string) {
  try {
    const plain = decodeURIComponent(url);
    return encodeURI(plain) === url ? plain : url;
  } catch {
    // 인코딩이 깨진 주소. 손대지 않고 그대로 담는다.
    return url;
  }
}

/**
 * 상품 링크 QR.
 *
 * 코디 카드를 이미지로 저장하면 링크를 누를 수 없다. 주소를 글자로 다 적어 봐도
 * 한글이 인코딩된 200자짜리라 사람이 따라 칠 수 없다(그래서 화면에는 도메인만
 * 보여준다 — `shared/productUrl.ts`). 저장한 그림에서 상품으로 가는 길은 QR뿐이다.
 *
 * 만드는 일은 전부 브라우저 안에서 끝난다. 상품 주소를 외부 서비스로 보내지 않는다.
 *
 * ## 크기와 형식을 이렇게 정한 이유 (2026-08-18, 저장본에서 실제로 디코딩해 확인)
 *
 * - **SVG를 data URI로 만들어 `<img>`에 넣는다.** html2canvas는 `<img>`를 그대로
 *   그리고, data URI라 캔버스가 오염되지 않아 `toDataURL()`로 저장할 수 있다.
 *   jsdom 테스트에는 canvas가 없어 `toDataURL`(캔버스) 경로는 그 자리에서 깨진다.
 * - **`width`를 반드시 넘긴다.** 안 넘기면 SVG에 width/height 속성이 없어 브라우저가
 *   기본 150px로 잡고, html2canvas는 그 크기로 그린 뒤 상자에 맞춰 자르기만 해서
 *   저장본에서 QR 오른쪽·아래가 잘려 나간다.
 * - **96px.** html2canvas는 이미지를 CSS 크기로 먼저 굽고 나중에 확대한다. 그래서
 *   저장 배율(scale 2)을 올려도 소용이 없고 **화면 크기 자체**가 해상도를 정한다.
 *   실제로 저장본을 디코딩해 보면 64px·80px은 읽히지 않고 96px부터 읽힌다.
 * - **오류 보정은 가장 낮은 L.** 종이에 인쇄해 긁히는 QR이 아니라 화면 속 그림이라,
 *   보정 여유보다 칸 하나가 큰 것이 스캔에 유리하다.
 */
export function ProductQr({ url, size = 96 }: { url: string; size?: number }) {
  const [dataUri, setDataUri] = useState("");

  useEffect(() => {
    let alive = true;
    if (!url.trim()) {
      setDataUri("");
      return;
    }
    void QRCode.toString(qrPayload(url), {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "L",
      width: size,
    })
      .then((svg) => {
        if (alive) setDataUri(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
      })
      .catch((error: unknown) => {
        // QR을 못 만들어도 카드 자체는 그대로 보여야 한다. 자리만 비운다.
        console.log("[BiasFit 코디] 상품 QR 생성 실패", error);
        if (alive) setDataUri("");
      });
    return () => {
      alive = false;
    };
  }, [url, size]);

  if (!dataUri) return null;

  return (
    <img
      src={dataUri}
      alt="상품 링크 QR 코드"
      width={size}
      height={size}
      className="shrink-0 rounded-[6px]"
      style={{ width: size, height: size }}
    />
  );
}
