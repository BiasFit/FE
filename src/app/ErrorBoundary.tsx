import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearAppState } from "../storage/diagnosisSession.js";

/**
 * 렌더 중 오류가 나면 React는 트리를 통째로 버린다. 경계가 없으면 화면이 하얗게 되고,
 * 사용자는 자기가 뭘 잘못했는지도 모른 채 흐름에서 튕긴다
 * (`MEMO/KPI_조회_가이드.md`가 "화면이 하얗게 됨"을 치명 증상으로 꼽는다).
 *
 * 여기서 잡아 **무엇이 일어났는지 화면에 남기고** 돌아갈 길을 준다.
 * 오류 원문은 `console.error`로 남긴다 — 삼키면 아무도 원인을 모른다.
 *
 * 진단 상태(sessionStorage)는 건드리지 않는다. 다시 들어가면 이어서 진행할 수 있어야 한다.
 */
interface Props {
  children: ReactNode;
}

interface State {
  message: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return {
      message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[BiasFit 화면] 렌더 중 오류", error, info.componentStack);
  }

  render() {
    if (this.state.message === null) return this.props.children;

    return (
      <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p className="text-[17px] font-bold text-[#0a0a0a]">화면을 표시하지 못했어요.</p>
        <p className="text-[13px] leading-[1.6] text-[#8e8e93]">
          입력하신 내용은 그대로 남아 있어요.
          <br />
          아래 버튼으로 다시 시도해 주세요.
        </p>
        <button
          type="button"
          // `setState`로 자식만 다시 그리면 **같은 값으로 같은 자리에서 다시 터진다.**
          // 통째로 다시 띄워야 저장된 진단을 처음부터 읽으며 복구할 기회가 생긴다.
          onClick={() => window.location.reload()}
          className="rounded-full bg-[#0a0a0a] px-5 py-3 text-[14px] font-semibold text-white"
        >
          다시 불러오기
        </button>
        <button
          type="button"
          // 저장된 값 자체가 망가졌으면 새로고침해도 계속 죽는다. 그 고리를 끊는 마지막 수단이다.
          // 입력이 사라지므로 문구에 그대로 적는다.
          onClick={() => {
            clearAppState();
            window.location.hash = "#/";
            window.location.reload();
          }}
          className="text-[13px] font-medium text-[#8e8e93] underline underline-offset-2"
        >
          처음부터 다시 시작 (입력한 내용은 지워져요)
        </button>
      </section>
    );
  }
}
