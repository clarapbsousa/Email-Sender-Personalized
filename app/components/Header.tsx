"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "primereact/button";

export default function Header() {
  const { data: session } = useSession();

  if (!session) {
    return null;
  }

  return (
    <header className="header">
      <div className="header-content">
        <h2 className="header-title">Email Sender</h2>
        <div className="header-user">
          <span className="user-email">{session.user?.email}</span>
          <Button
            label="Sair"
            icon="pi pi-sign-out"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="logout-button"
            size="small"
          />
        </div>
      </div>
    </header>
  );
}
