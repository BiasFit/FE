import { HashRouter } from "react-router-dom";
import { AppRouter } from "./app/AppRouter";
import { AppStateProvider } from "./app/AppStateProvider";
import { AuthProvider } from "./app/AuthProvider";

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppStateProvider>
          <AppRouter />
        </AppStateProvider>
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
