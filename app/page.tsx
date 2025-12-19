"use client";

import { Button } from "primereact/button";
import { signIn } from "next-auth/react";

export default function Home() {
  const handleLogin = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <main className="main">
      <div className="container">
        <div className="logo">
          <h1 className="title">Envia emails personalizados</h1>
          <p className="description">
            Inicie sessão com o Google para começar. Carregue o seu ficheiro
            Excel com o e-mail, o nome do EE e o nome do aluno.
          </p>
          <Button
            label="Login"
            onClick={handleLogin}
            className="loginButton"
            size="large"
          />
        </div>
      </div>
    </main>
  );
}
