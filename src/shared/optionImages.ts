/**
 * 진단 선택지 참고 사진. 파일명이 `data/options.ts`의 항목 이름과 같아서
 * 번호 접두사만 떼면 바로 매칭된다 (2026-08-16).
 *
 * 사용자 진단 화면(U3)에만 있던 것을 인플루언서 프로필 화면(I2·I3)도 쓰게 옮겼다.
 * 같은 항목을 같은 사진으로 보여줘야 인플루언서가 고른 것과 사용자가 고른 것이
 * 같은 뜻이 된다.
 */

const styleImageFiles = import.meta.glob("../assets/design-elements/fashion_style_images_square_1x1/*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string>;
const itemImageFiles = import.meta.glob("../assets/design-elements/fashion_item_images_square_1x1/*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string>;
const lookImageFiles = import.meta.glob("../assets/design-elements/fashion_reference_based_looks_3x4/*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string>;
const bodyTypeImageFiles = import.meta.glob("../assets/design-elements/body_type_human_like_3x4/*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function imageLookup(files: Record<string, string>) {
  const map: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) {
    const file = path.split("/").pop() ?? "";
    if (/^00_/.test(file)) continue;
    const name = file.replace(/^\d+_/, "").replace(/\.jpg$/, "");
    map[name] = url;
  }
  return map;
}

/** 디자인 요소 26개. */
export const styleImageByName = imageLookup(styleImageFiles);
const itemImageByName = imageLookup(itemImageFiles);
const lookImageByName = imageLookup(lookImageFiles);
/** 체형 3종. */
export const bodyTypeImageByName = imageLookup(bodyTypeImageFiles);

/** 파일명이 "H라인 미디·롱스커트"로 저장돼 있어 데이터의 "H라인 미디/롱스커트"와 문자만 다르다. */
export function itemImage(name: string) {
  return itemImageByName[name] ?? itemImageByName[name.replace("/", "·")];
}

/** 파일명은 "비즈니스"인데 데이터는 "오피스 & 비즈니스캐주얼"이다. */
export function styleLookImage(name: string) {
  return lookImageByName[name] ?? (name.includes("비즈니스") ? lookImageByName["비즈니스"] : undefined);
}
