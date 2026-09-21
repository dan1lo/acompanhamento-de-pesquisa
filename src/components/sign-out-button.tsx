"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
    >
      Sair
    </button>
  );
}
