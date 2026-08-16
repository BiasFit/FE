import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  appReducer,
  type AppAction,
  type AppState,
} from "./appState.js";
import { loadAppState, saveAppState } from "../storage/diagnosisSession.js";

interface AppStateContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  // 새로고침해도 진행 중인 진단이 이어지게 저장된 상태에서 시작한다.
  const [state, dispatch] = useReducer(appReducer, undefined, loadAppState);
  useEffect(() => saveAppState(state), [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return context;
}
