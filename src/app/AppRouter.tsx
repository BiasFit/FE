import { Navigate, Route, Routes } from "react-router-dom";
import {
  CoachingScreen,
  HomeScreen,
  UserLoginScreen,
} from "../features/user/StartScreens";
import {
  InfluencerSignupScreen,
  SignupRoleScreen,
  UserSignupScreen,
} from "../features/auth/SignupScreens";
import {
  DeliveredScreen,
  InfluencerDetailScreen,
  InfluencerLoginScreen,
  InfluencerProfileScreen,
  InfluencerRequestsScreen,
} from "../features/influencer/InfluencerScreens";
import {
  BodyScreen,
  BudgetScreen,
  SignalsScreen,
  StyleScreen,
  TpoScreen,
} from "../features/user/DiagnosisScreens";
import {
  DnaScreen,
  LoadingDnaScreen,
  Top3Screen,
} from "../features/user/ResultScreens";
import {
  MatchScreen,
  OutfitScreen,
  RequestScreen,
  WaitScreen,
} from "../features/user/CoachingScreens";
import { SiteNav } from "../shared/SiteNav";
import { useAppState } from "./AppStateProvider";

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
          <Route path="/user/coaching" element={<CoachingScreen />} />
          <Route path="/user/body" element={<BodyScreen />} />
          <Route path="/user/style" element={<StyleScreen />} />
          <Route path="/user/signals" element={<SignalsScreen />} />
          <Route path="/user/budget" element={<BudgetScreen />} />
          <Route path="/user/tpo" element={<TpoScreen />} />
          <Route path="/user/loading" element={<LoadingDnaScreen />} />
          <Route path="/user/dna" element={<DnaScreen />} />
          <Route path="/user/top3" element={<Top3Screen />} />
          <Route path="/user/match" element={<MatchScreen />} />
          <Route path="/user/request" element={<RequestScreen />} />
          <Route path="/user/wait" element={<WaitScreen />} />
          <Route path="/user/outfit" element={<OutfitScreen />} />
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
            element={<InfluencerProfileScreen />}
          />
          <Route
            path="/influencer/requests"
            element={<InfluencerRequestsScreen />}
          />
          <Route
            path="/influencer/detail"
            element={<InfluencerDetailScreen />}
          />
          <Route
            path="/influencer/delivered"
            element={<DeliveredScreen />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
