/**
 * 코디 카드를 그림으로 굽는다. U7(코디 카드)과 마이페이지 상세가 함께 쓴다.
 *
 * ## 글자만 아래로 밀리는 것을 되돌린다
 *
 * html2canvas 1.4.1은 **상자는 제자리에 그리는데 글자는 6px 정도 아래에** 그린다.
 * 마이페이지 카드로 DOM과 캔버스를 픽셀 비교한 값이다 (2026-08-18).
 *
 * | 줄 | 화면(예상 잉크 위치) | 저장본 |
 * |---|---|---|
 * | "상의" 11px | 119.7 | 125.5 |
 * | "상품 1" 15px | 144.7 | 151.5 |
 * | 상품 주소 11px | 172.7 | 179.0 |
 * | 알약 "개인 스타일링" | 32.9 | 39.0 |
 *
 * 흰 상자 위치는 DOM과 0.5px 안에서 같았다. 즉 상자 안에서 글자만 아래로 쏠려,
 * 위는 휑하고 마지막 줄은 상자 바닥에 붙는다. 글꼴(Pretendard·system-ui·Arial)이나
 * line-height(1·normal·1.5)를 바꿔도 밀리는 양은 6px 내외로 같았다.
 *
 * 그래서 **저장할 때 쓰는 복제본에서만** 글자를 6px 끌어올린다. 화면에 보이는 DOM은
 * 건드리지 않는다. 글자 노드를 배경 없는 span으로 감싸 올리므로 알약처럼 배경이 있는
 * 상자는 제자리에 남는다. 이렇게 하면 저장본 잉크 위치가 화면과 1px 안에서 맞는다.
 */
const TEXT_BASELINE_NUDGE_PX = 6;

function nudgeTextUp(root: HTMLElement) {
  const document = root.ownerDocument;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.nodeValue?.trim()) textNodes.push(node);
  }
  for (const node of textNodes) {
    const wrapper = document.createElement("span");
    wrapper.style.position = "relative";
    wrapper.style.top = `-${TEXT_BASELINE_NUDGE_PX}px`;
    node.parentNode?.insertBefore(wrapper, node);
    wrapper.appendChild(node);
  }
}

/** 저장할 카드 그림을 만든다. 실패는 삼키지 않고 그대로 던진다 — 화면이 알려야 한다. */
export async function captureOutfitCard(element: HTMLElement) {
  const { default: html2canvas } = await import("html2canvas");
  return html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    onclone: (_document, cloned) => nudgeTextUp(cloned),
  });
}
