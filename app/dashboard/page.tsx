"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Button } from "primereact/button"

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="main">
        <div className="container">
          <p>A carregar...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <main className="main">
      <div className="container">
        <h1 className="title">Bem-vindo, {session.user?.name}!</h1>
        <p className="description" style={{ marginTop: "1rem" }}>
          Email: {session.user?.email}
        </p>
        <div style={{ marginTop: "2rem" }}>
          <Button
            label="Terminar Sessão"
            onClick={() => signOut({ callbackUrl: "/" })}
            severity="danger"
            size="large"
          />
        </div>
      </div>
    </main>
  )
}
