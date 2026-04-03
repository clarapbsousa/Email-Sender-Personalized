import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const emailStatusCache = new Map<string, { email: string; status: 'pending' | 'sent' | 'failed'; error?: string }>()
type ExcelRow = Record<string, string>

const escapeRegExp = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const applyTemplateWithRow = (template: string, row: ExcelRow) => {
  let parsedTemplate = template

  Object.entries(row).forEach(([columnName, columnValue]) => {
    const escapedColumnName = escapeRegExp(columnName)
    parsedTemplate = parsedTemplate.replace(
      new RegExp(`{\\s*${escapedColumnName}\\s*}`, "g"),
      columnValue || ""
    )
  })

  return parsedTemplate
}

export async function POST(request: NextRequest) {
  try {
    const {
      excelData,
      emailColumns,
      subject,
      message,
      resumeSessionId,
    }: {
      excelData: ExcelRow[]
      emailColumns: string[]
      subject: string
      message: string
      resumeSessionId?: string
    } = await request.json()
    const session: any = await getServerSession(authOptions)

    if (!emailColumns || emailColumns.length === 0) {
      return NextResponse.json(
        { success: false, message: "É obrigatório selecionar pelo menos uma coluna de emails." },
        { status: 400 }
      )
    }

    const invalidRows = excelData.flatMap((row, index) => {
      return emailColumns
        .map((columnName) => ({
          index,
          columnName,
          value: (row[columnName] || "").trim(),
        }))
        .filter(({ value }) => !value.includes("@"))
    })

    if (invalidRows.length > 0) {
      const uniqueColumns = Array.from(new Set(invalidRows.map((item) => item.columnName))).join(", ")
      return NextResponse.json(
        {
          success: false,
          message: `As colunas (${uniqueColumns}) contêm ${invalidRows.length} valor(es) inválido(s) sem @.`,
        },
        { status: 400 }
      )
    }

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

    const sendEmail = async (row: ExcelRow, index: number, retryCount = 0): Promise<any> => {
      const recipientEmails = emailColumns
        .map((columnName) => (row[columnName] || "").trim())
        .filter((value) => value.includes("@"))

      const dedupedRecipientEmails = Array.from(new Set(recipientEmails))
      const recipientEmail = dedupedRecipientEmails.join(",")

      if (!recipientEmail) {
        return { email: "", success: false, error: `Linha sem emails válidos nas colunas selecionadas` }
      }

      const emailKey = `${sessionId}-${recipientEmail}`
      
      // Verificar se já foi enviado com sucesso
      const cachedStatus = emailStatusCache.get(emailKey)
      if (cachedStatus?.status === 'sent') {
        return { email: recipientEmail, recipients: dedupedRecipientEmails, success: true, cached: true }
      }

      const personalizedMessage = applyTemplateWithRow(message, row)
      const personalizedSubject = applyTemplateWithRow(subject, row)

      const emailContent = [
        `From: ${session.user.email}`,
        `To: ${recipientEmail}`,
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
        emailStatusCache.set(emailKey, { email: recipientEmail, status: 'sent' })
        
        return { email: recipientEmail, recipients: dedupedRecipientEmails, success: true }
        
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
        emailStatusCache.set(emailKey, { email: recipientEmail, status: 'failed', error: errorMsg })
        
        console.error(`✗ Erro ao enviar email ${index + 1}/${excelData.length} para ${recipientEmail}:`, errorMsg)
        return { 
          email: recipientEmail,
          recipients: dedupedRecipientEmails,
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
