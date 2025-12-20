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

    const sendEmail = async (row: any, index: number) => {
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
        console.log(`✓ Email ${index + 1}/${excelData.length} enviado para ${row.emailEE}`)
        return { email: row.emailEE, success: true }
      } catch (error: any) {
        const errorMsg = error.message || String(error)
        console.error(`✗ Erro ao enviar email ${index + 1}/${excelData.length} para ${row.emailEE}:`, errorMsg)
        return { 
          email: row.emailEE, 
          success: false, 
          error: errorMsg 
        }
      }
    }

    // Enviar em lotes de 100 emails em paralelo
    const BATCH_SIZE = 100
    const results = []
    
    console.log(`📧 Iniciando envio de ${excelData.length} emails em lotes de ${BATCH_SIZE}...`)
    
    for (let i = 0; i < excelData.length; i += BATCH_SIZE) {
      const batch = excelData.slice(i, i + BATCH_SIZE)
      console.log(`📦 Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(excelData.length / BATCH_SIZE)} (${batch.length} emails)`)
      
      const batchResults = await Promise.all(
        batch.map((row, index) => sendEmail(row, i + index))
      )
      
      results.push(...batchResults)
      
      // Pequeno delay entre lotes
      if (i + BATCH_SIZE < excelData.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    console.log(`Sucesso: ${successCount}`)
    console.log(`Falhas: ${failCount}`)
    console.log(`Total: ${excelData.length}\n`)

    return NextResponse.json({
      success: true,
      message: `${successCount} emails enviados com sucesso${failCount > 0 ? `, ${failCount} falharam` : ''}`,
      results,
      stats: { successCount, failCount, total: excelData.length }
    })
  } catch (error: any) {
    console.error("Erro ao enviar emails:", error)
    return NextResponse.json(
      { success: false, message: "Erro ao enviar emails", error: error.message },
      { status: 500 }
    )
  }
}
