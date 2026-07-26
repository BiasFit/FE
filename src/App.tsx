import { HashRouter } from "react-router-dom";
import { AppRouter } from "./app/AppRouter";
import { AppStateProvider } from "./app/AppStateProvider";

function App() {
  return (
    <HashRouter>
      <AppStateProvider>
        <AppRouter />
      </AppStateProvider>
    </HashRouter>
  );
}

export default App;
