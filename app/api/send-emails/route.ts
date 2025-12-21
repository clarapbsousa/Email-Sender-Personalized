import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const emailStatusCache = new Map<string, { email: string; status: 'pending' | 'sent' | 'failed'; error?: string }>()

export async function POST(request: NextRequest) {
  try {
    const { excelData, subject, message, resumeSessionId } = await request.json()
    const session: any = await getServerSession(authOptions)

    if (!session?.user?.email || !session?.accessToken) {
      return NextResponse.json(
        { success: false, message: "Utilizador não autenticado ou sem permissões" },
        { status: 401 }
      )
    }

    // Criar session ID único para este envio
    const sessionId = resumeSessionId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Configurar OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )

    oauth2Client.setCredentials({
      access_token: session.accessToken,
    })

    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    const sendEmail = async (row: any, index: number, retryCount = 0): Promise<any> => {
      const emailKey = `${sessionId}-${row.emailEE}`
      
      // Verificar se já foi enviado com sucesso
      const cachedStatus = emailStatusCache.get(emailKey)
      if (cachedStatus?.status === 'sent') {
        return { email: row.emailEE, success: true, cached: true }
      }

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
        
        // Guardar status de sucesso
        emailStatusCache.set(emailKey, { email: row.emailEE, status: 'sent' })
        
        return { email: row.emailEE, success: true }
        
      } catch (error: any) {
        const errorMsg = error.message || String(error)
        const errorCode = error.code
        
        // Verificar se há header Retry-After
        const retryAfter = error.response?.headers?.['retry-after']
        
        // Detectar rate limit ou quota exceeded
        if ((errorCode === 429 || errorCode === 403) && retryCount < 5) {
          let waitTime = 60000 // Default 60s
          
          if (retryAfter) {
            // Retry-After pode ser em segundos ou uma data
            waitTime = isNaN(retryAfter) 
              ? Math.max(0, new Date(retryAfter).getTime() - Date.now())
              : parseInt(retryAfter) * 1000
          }
          
          console.warn(`⚠️  Rate limit no email ${index + 1}. Aguardando ${waitTime/1000}s... (tentativa ${retryCount + 1}/5)`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          
          return sendEmail(row, index, retryCount + 1)
        }
        
        // Guardar status de falha
        emailStatusCache.set(emailKey, { email: row.emailEE, status: 'failed', error: errorMsg })
        
        console.error(`✗ Erro ao enviar email ${index + 1}/${excelData.length} para ${row.emailEE}:`, errorMsg)
        return { 
          email: row.emailEE, 
          success: false, 
          error: errorMsg 
        }
      }
    }

    // Enviar sequencialmente com concurrency = 1 e delay de 1000ms
    const results = []
    const DELAY_BETWEEN_EMAILS = 1000 // 1 segundo entre cada email
    
    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i]
      
      const result = await sendEmail(row, i)
      results.push(result)
      
      // Delay de 1 segundo entre cada email
      if (i < excelData.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS))
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length
    const cachedCount = results.filter((r) => r.cached).length

    return NextResponse.json({
      success: true,
      message: `${successCount} emails enviados com sucesso${failCount > 0 ? `, ${failCount} falharam` : ''}`,
      results,
      sessionId,
      stats: { successCount, failCount, cachedCount, total: excelData.length }
    })
  } catch (error: any) {
    console.error("Erro ao enviar emails:", error)
    return NextResponse.json(
      { success: false, message: "Erro ao enviar emails", error: error.message },
      { status: 500 }
    )
  }
}
