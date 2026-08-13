import type { CSSProperties } from "react";

/**
 * 인플루언서 사진 자리의 배경을 만든다.
 *
 * **사진이 없으면 중립 배경을 쓴다.** 이게 이 함수의 존재 이유다.
 *
 * CSS(`biasfit.css`)는 순위 자리마다 공용 사진을 깔아 둔다 —
 * `.match-card:nth-child(1) .match-photo{background-image:var(--photo-2)}` 식이다.
 * 그대로 두면 **누가 TOP 1이 되든 같은 사진**이 뜨고, 사용자는 그걸 그 사람 사진이라고 믿는다.
 * 비어 있는 것보다 나쁘다.
 *
 * 사진 등록 절차는 `MEMO/이미지_처리.md` (파일은 우리가 넣고 경로는 SQL로 지정한다).
 */
export function influencerPhotoStyle(
  profileImageUrl: string | null | undefined,
): CSSProperties {
  if (!profileImageUrl) {
    // 체형 유형 카드(.body-visual)와 같은 톤이라 화면에서 튀지 않는다.
    return { backgroundImage: "linear-gradient(145deg,#f5f3ff,#eef6ff)" };
  }
  return { backgroundImage: `url("${profileImageUrl}")` };
}
