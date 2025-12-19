import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"

export async function POST(request: NextRequest) {
  try {
    const { excelData, subject, message } = await request.json()
    const session: any = await getServerSession(authOptions)

    if (!session?.user?.email || !session?.accessToken) {
      return NextResponse.json(
        { success: false, message: "Utilizador não autenticado ou sem permissões" },
        { status: 401 }
      )
    }

    // Configurar OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )

    oauth2Client.setCredentials({
      access_token: session.accessToken,
    })

    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    // Enviar emails para cada registo
    const results = await Promise.all(
      excelData.map(async (row: any) => {
        const personalizedMessage = message
          .replace(/{nomeEE}/g, row.nomeEE)
          .replace(/{nomeAluno}/g, row.nomeAluno)
        
        const personalizedSubject = subject
          .replace(/{nomeEE}/g, row.nomeEE)
          .replace(/{nomeAluno}/g, row.nomeAluno)

        const emailContent = [
          `From: ${session.user.email}`,
          `To: ${row.emailEE}`,
          "Content-Type: text/html; charset=UTF-8",
          "MIME-Version: 1.0",
          `Subject: =?UTF-8?B?${Buffer.from(personalizedSubject).toString("base64")}?=`,
          "",
          personalizedMessage.replace(/\n/g, "<br>"),
        ].join("\n")

        const encodedEmail = Buffer.from(emailContent, "utf-8")
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "")

        try {
          await gmail.users.messages.send({
            userId: "me",
            requestBody: {
              raw: encodedEmail,
            },
          })
          return { email: row.emailEE, success: true }
        } catch (error: any) {
          console.error(`Erro ao enviar para ${row.emailEE}:`, error)
          return { 
            email: row.emailEE, 
            success: false, 
            error: error.message 
          }
        }
      })
    )

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      message: `${successCount} emails enviados com sucesso, ${failCount} falharam`,
      results,
    })
  } catch (error: any) {
    console.error("Erro ao enviar emails:", error)
    return NextResponse.json(
      { success: false, message: "Erro ao enviar emails", error: error.message },
      { status: 500 }
    )
  }
}
