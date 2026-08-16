import type { ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  CoachingScreen,
  HomeScreen,
  UserLoginScreen,
} from "../features/user/StartScreens.js";
import {
  InfluencerSignupScreen,
  SignupRoleScreen,
  UserSignupScreen,
} from "../features/auth/SignupScreens.js";
import {
  DeliveredScreen,
  InfluencerDetailScreen,
  InfluencerLoginScreen,
  InfluencerProfileScreen,
  InfluencerProfileBodyScreen,
  InfluencerProfileBudgetScreen,
  InfluencerRequestsScreen,
} from "../features/influencer/InfluencerScreens.js";
import {
  BodyScreen,
  BudgetScreen,
  DesignScreen,
  FitScreen,
  ItemScreen,
  StyleScreen,
} from "../features/user/DiagnosisScreens.js";
import { PriorityScreen } from "../features/user/PriorityQuestion.js";
import {
  DnaScreen,
  LoadingDnaScreen,
  Top3Screen,
} from "../features/user/ResultScreens.js";
import {
  MatchScreen,
  OutfitScreen,
  RequestScreen,
  WaitScreen,
} from "../features/user/CoachingScreens.js";
import {
  MypageDiagnosisDetailScreen,
  MypageOutfitDetailScreen,
  MypageScreen,
} from "../features/user/MypageScreens.js";
import { SiteNav } from "../shared/SiteNav.js";
import { useAppState } from "./AppStateProvider.js";
import { RequireRole } from "./RequireRole.js";

/** 로그인·회원가입을 뺀 사용자 흐름은 사용자 계정만 볼 수 있다. */
function UserOnly({ children }: { children: ReactElement }) {
  return <RequireRole role="user">{children}</RequireRole>;
}

/** 인플루언서 워크스페이스는 인플루언서 계정만 볼 수 있다 (INFLUENCER_SCREEN_SPEC 3.1). */
function InfluencerOnly({ children }: { children: ReactElement }) {
  return <RequireRole role="influencer">{children}</RequireRole>;
}

export function AppRouter() {
  const { state } = useAppState();
  const location = useLocation();
  // 피그마 v3로 새로 짠 화면(마이페이지, U2 스타일링 유형)은 자체 상단바를 쓴다.
  // 기존 SiteNav(진행률 표시줄)를 겹쳐 보여주면 화면이 두 개로 보이므로 여기서만 뺀다.
  // U3 이후 화면들을 v3로 옮기면 이 목록에 경로를 추가하면 된다.
  const v3Paths = [
    "/signup",
    "/user/login",
    "/user/signup",
    "/user/mypage",
    "/user/coaching",
    "/user/body",
    "/user/fit",
    "/user/style",
    "/user/design",
    "/user/item",
    "/user/budget",
    "/user/priority",
    "/user/loading",
    "/user/dna",
    "/user/top3",
    "/user/match",
    "/user/request",
    "/user/wait",
    "/user/outfit",
    "/influencer/login",
    "/influencer/signup",
    "/influencer/profile",
    "/influencer/requests",
    "/influencer/detail",
    "/influencer/delivered",
  ];
  // "/"는 startsWith 검사로 두면 모든 경로와 매칭돼 SiteNav가 통째로 사라지므로 별도로 비교한다.
  const isV3Shell =
    location.pathname === "/" ||
    v3Paths.some((path) => location.pathname.startsWith(path));
  return (
    <div className={state.mode === "group" ? "group-mode" : undefined}>
      <a className="skip" href="#main">
        본문 바로가기
      </a>
      {isV3Shell ? null : <SiteNav />}
      <main className="app" id="main">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/signup" element={<SignupRoleScreen />} />
          <Route path="/user/login" element={<UserLoginScreen />} />
          <Route path="/user/signup" element={<UserSignupScreen />} />
          <Route path="/user/coaching" element={<UserOnly><CoachingScreen /></UserOnly>} />
          <Route path="/user/body" element={<UserOnly><BodyScreen /></UserOnly>} />
          <Route path="/user/fit" element={<UserOnly><FitScreen /></UserOnly>} />
          <Route path="/user/style" element={<UserOnly><StyleScreen /></UserOnly>} />
          <Route path="/user/design" element={<UserOnly><DesignScreen /></UserOnly>} />
          <Route path="/user/item" element={<UserOnly><ItemScreen /></UserOnly>} />
          <Route path="/user/budget" element={<UserOnly><BudgetScreen /></UserOnly>} />
          <Route path="/user/priority" element={<UserOnly><PriorityScreen /></UserOnly>} />
          <Route path="/user/loading" element={<UserOnly><LoadingDnaScreen /></UserOnly>} />
          <Route path="/user/dna" element={<UserOnly><DnaScreen /></UserOnly>} />
          <Route path="/user/top3" element={<UserOnly><Top3Screen /></UserOnly>} />
          <Route path="/user/match" element={<UserOnly><MatchScreen /></UserOnly>} />
          <Route path="/user/request" element={<UserOnly><RequestScreen /></UserOnly>} />
          <Route path="/user/wait" element={<UserOnly><WaitScreen /></UserOnly>} />
          <Route path="/user/outfit" element={<UserOnly><OutfitScreen /></UserOnly>} />
          <Route path="/user/mypage" element={<UserOnly><MypageScreen /></UserOnly>} />
          <Route
            path="/user/mypage/outfit/:matchResultId"
            element={<UserOnly><MypageOutfitDetailScreen /></UserOnly>}
          />
          <Route
            path="/user/mypage/diagnosis/:matchResultId"
            element={<UserOnly><MypageDiagnosisDetailScreen /></UserOnly>}
          />
          <Route
            path="/influencer/login"
            element={<InfluencerLoginScreen />}
          />
          <Route
            path="/influencer/signup"
            element={<InfluencerSignupScreen />}
          />
          <Route
            path="/influencer/profile"
            element={<InfluencerOnly><InfluencerProfileScreen /></InfluencerOnly>}
          />
          <Route
            path="/influencer/profile/body"
            element={<InfluencerOnly><InfluencerProfileBodyScreen /></InfluencerOnly>}
          />
          <Route
            path="/influencer/profile/budget"
            element={<InfluencerOnly><InfluencerProfileBudgetScreen /></InfluencerOnly>}
          />
          <Route
            path="/influencer/requests"
            element={<InfluencerOnly><InfluencerRequestsScreen /></InfluencerOnly>}
          />
          <Route
            path="/influencer/detail"
            element={<InfluencerOnly><InfluencerDetailScreen /></InfluencerOnly>}
          />
          <Route
            path="/influencer/delivered"
            element={<InfluencerOnly><DeliveredScreen /></InfluencerOnly>}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
