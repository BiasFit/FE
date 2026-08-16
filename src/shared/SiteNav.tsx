import { useLocation, useNavigate } from "react-router-dom";

export function SiteNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const influencerFlow = location.pathname.startsWith("/influencer");
  const internalUserFlow =
    location.pathname.startsWith("/user") &&
    location.pathname !== "/user/login" &&
    location.pathname !== "/user/signup";
  const progressByPath: Record<string, string> = {
    "/user/coaching": "01 / 05",
    "/user/body": "01 / 05",
    "/user/style": "02 / 05",
    "/user/signals": "03 / 05",
    "/user/budget": "04 / 05",
  };
  const userProgress = progressByPath[location.pathname] ?? "05 / 05";

  return (
    <header className="site-nav">
      <div className="nav-inner">
        <button
          className="brand"
          type="button"
          onClick={() => navigate("/")}
          aria-label="Fitto 홈"
        >
          BiasFit
        </button>
        <div className="nav-actions">
          <span className="nav-caption">
            {influencerFlow
              ? "스타일메이트 워크스페이스"
              : "내 취향과 핏에 맞는 코디를 받아보세요."}
          </span>
          {internalUserFlow ? (
            <button className="nav-link nav-progress" type="button" disabled>
              {userProgress}
            </button>
          ) : (
            <button
              className="nav-link"
              type="button"
              onClick={() =>
                navigate(influencerFlow ? "/user/login" : "/influencer/login")
              }
            >
              {influencerFlow ? "사용자로 시작하기" : "인플루언서 로그인"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
