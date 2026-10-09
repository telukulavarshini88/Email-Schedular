import { Button } from "../components/ui/Button";

export default function Login() {
  const failed = new URLSearchParams(window.location.search).get("error");
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">Email scheduler</h1>
        <p className="mt-2 text-sm text-ink/60">Schedule outreach and watch it send, even through restarts.</p>
        {failed && <p className="mt-4 text-sm text-red-700">Google sign-in didn't complete. Try again.</p>}
        <Button className="mt-6 w-full" onClick={() => (window.location.href = "/auth/google")}>
          Continue with Google
        </Button>
      </div>
    </main>
  );
}
