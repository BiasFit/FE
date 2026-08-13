import { HashRouter } from "react-router-dom";
import { AppRouter } from "./app/AppRouter.js";
import { AppStateProvider } from "./app/AppStateProvider.js";
import { AuthProvider } from "./app/AuthProvider.js";

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
