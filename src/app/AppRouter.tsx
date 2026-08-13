import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
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
  InfluencerRequestsScreen,
} from "../features/influencer/InfluencerScreens.js";
import {
  BodyScreen,
  BudgetScreen,
  SignalsScreen,
  StyleScreen,
  TpoScreen,
} from "../features/user/DiagnosisScreens.js";
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
  return (
    <div className={state.mode === "group" ? "group-mode" : undefined}>
      <a className="skip" href="#main">
        본문 바로가기
      </a>
      <SiteNav />
      <main className="app" id="main">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/signup" element={<SignupRoleScreen />} />
          <Route path="/user/login" element={<UserLoginScreen />} />
          <Route path="/user/signup" element={<UserSignupScreen />} />
          <Route path="/user/coaching" element={<UserOnly><CoachingScreen /></UserOnly>} />
          <Route path="/user/body" element={<UserOnly><BodyScreen /></UserOnly>} />
          <Route path="/user/style" element={<UserOnly><StyleScreen /></UserOnly>} />
          <Route path="/user/signals" element={<UserOnly><SignalsScreen /></UserOnly>} />
          <Route path="/user/budget" element={<UserOnly><BudgetScreen /></UserOnly>} />
          <Route path="/user/tpo" element={<UserOnly><TpoScreen /></UserOnly>} />
          <Route path="/user/loading" element={<UserOnly><LoadingDnaScreen /></UserOnly>} />
          <Route path="/user/dna" element={<UserOnly><DnaScreen /></UserOnly>} />
          <Route path="/user/top3" element={<UserOnly><Top3Screen /></UserOnly>} />
          <Route path="/user/match" element={<UserOnly><MatchScreen /></UserOnly>} />
          <Route path="/user/request" element={<UserOnly><RequestScreen /></UserOnly>} />
          <Route path="/user/wait" element={<UserOnly><WaitScreen /></UserOnly>} />
          <Route path="/user/outfit" element={<UserOnly><OutfitScreen /></UserOnly>} />
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
