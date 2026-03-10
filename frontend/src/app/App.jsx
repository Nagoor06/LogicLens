import VerifyEmailPage from "../features/auth/VerifyEmailPage";
import Dashboard from "../pages/Dashboard";

function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/verify-email") {
    return <VerifyEmailPage />;
  }

  return <Dashboard />;
}

export default App;
