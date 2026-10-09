import type { User } from "../types";
import { Button } from "./ui/Button";
import { SlackConnect } from "./SlackConnect";

export function Header({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h1 className="text-lg font-bold">Email scheduler</h1>
        <div className="flex flex-wrap items-center gap-3">
          <SlackConnect />
          <a href="/admin/queues" target="_blank" rel="noreferrer" className="text-sm font-medium text-brand hover:underline">
            Queue dashboard
          </a>
          <div className="flex items-center gap-3 border-l border-line pl-3">
            {user.avatar ? (
              <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full" />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft font-semibold text-brand-dark">
                {(user.name ?? user.email)[0].toUpperCase()}
              </div>
            )}
            <div className="leading-tight">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="text-xs text-ink/60">{user.email}</div>
            </div>
          </div>
          <Button variant="ghost" onClick={onLogout}>Log out</Button>
        </div>
      </div>
    </header>
  );
}
