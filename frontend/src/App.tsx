import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import { Spinner } from "./components/ui/Spinner";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { user, loading, logout } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-brand">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  return user ? <Dashboard user={user} onLogout={logout} /> : <Login />;
}
