import { HashRouter } from "react-router-dom";
import { AppRouter } from "./app/AppRouter.js";
import { AppStateProvider } from "./app/AppStateProvider.js";
import { AuthProvider } from "./app/AuthProvider.js";
import { ErrorBoundary } from "./app/ErrorBoundary.js";

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppStateProvider>
          {/* 라우터 안쪽에 둔다. 오류 화면도 주소를 바꿔 돌아갈 수 있어야 한다. */}
          <ErrorBoundary>
            <AppRouter />
          </ErrorBoundary>
        </AppStateProvider>
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
