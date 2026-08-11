import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// 파일을 병렬 실행하면 기본 1초 안에 렌더가 끝나지 않아 findBy*가 간헐적으로 실패한다.
configure({ asyncUtilTimeout: 5000 });

class ResizeObserverMock implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}

  observe(_target: Element, _options?: ResizeObserverOptions) {}

  unobserve(_target: Element) {}

  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

afterEach(() => cleanup());
