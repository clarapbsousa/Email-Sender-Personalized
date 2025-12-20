"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileUpload } from "primereact/fileupload";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import Header from "../components/Header";
import * as XLSX from "xlsx";

interface ExcelData {
  nomeEE: string;
  nomeAluno: string;
  emailEE: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [excelData, setExcelData] = useState<ExcelData[]>([]);
  const [subject, setSubject] = useState("Informação sobre o aluno");
  const [message, setMessage] = useState(
    "Olá {nomeEE},\n\nVenho por este meio informar sobre o aluno {nomeAluno}.\n\nCom os melhores cumprimentos"
  );
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  const handleFileUpload = (event: any) => {
    const file = event.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet) as any[];

      const parsedData: ExcelData[] = json.map((row) => ({
        nomeEE: row["Nome EE"] || row["Nome do EE"] || row["nomeEE"] || "",
        nomeAluno:
          row["Nome"] || row["Nome do Aluno"] || row["nomeAluno"] || "",
        emailEE:
          row["Email pessoal EE"] || row["Email do EE"] || row["emailEE"] || "",
      }));

      setExcelData(parsedData);
    };
    reader.readAsBinaryString(file);
  };

  const handleSendEmails = async () => {
    setSending(true)
    setSendResult(null)
    try {
      const response = await fetch("/api/send-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          excelData,
          subject,
          message,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSendResult(`✓ ${data.message}`)
      } else {
        setSendResult(`✗ Erro: ${data.message}`)
      }
    } catch (error) {
      console.error("Erro:", error)
      setSendResult("✗ Erro ao enviar emails. Verifique a consola para mais detalhes.")
    } finally {
      setSending(false)
    }
  };

  if (status === "loading") {
    return (
      <div className="main">
        <div className="container">
          <p>A carregar...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <Header />
      <main className="dashboard-main">
        <div className="dashboard-container">
          <div className="upload-section">
            <h2 className="section-title">Upload Ficheiro Excel</h2>
            <p className="section-description">
              O ficheiro deve conter: Nome EE, Nome (do aluno), Email pessoal EE
            </p>
            <FileUpload
              name="excel"
              accept=".xlsx,.xls"
              maxFileSize={1000000}
              onUpload={handleFileUpload}
              customUpload
              uploadHandler={handleFileUpload}
              chooseLabel="Escolher Ficheiro"
              auto
              className="excel-upload"
            />

            {excelData.length > 0 && (
              <div className="data-preview">
                <h3>
                  Pré-visualização dos Dados ({excelData.length} registos)
                </h3>
                <DataTable
                  value={excelData}
                  className="data-table"
                  paginator
                  rows={5}
                >
                  <Column field="nomeEE" header="Nome do EE"></Column>
                  <Column field="nomeAluno" header="Nome do Aluno"></Column>
                  <Column field="emailEE" header="Email do EE"></Column>
                </DataTable>
              </div>
            )}
          </div>

          <div className="message-section">
            <h2 className="section-title">Mensagem do Email</h2>
            <p className="section-description">
              Use {"{nomeEE}"} e {"{nomeAluno}"} para inserir os nomes
              automaticamente
            </p>
            
            <label className="input-label">Assunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="subject-input"
              placeholder="Assunto do email"
            />

            <label className="input-label">Mensagem</label>
            <InputTextarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="message-textarea"
              placeholder="Escreva a sua mensagem aqui..."
            />

            <div className="preview-box">
              <h3>Pré-visualização</h3>
              <div className="preview-content">
                {excelData.length > 0
                  ? message
                      .replace(/{nomeEE}/g, excelData[0].nomeEE)
                      .replace(/{nomeAluno}/g, excelData[0].nomeAluno)
                  : message}
              </div>
            </div>
            
            <Button
              label={sending ? "A enviar..." : `Enviar ${excelData.length} Emails`}
              icon={sending ? "pi pi-spin pi-spinner" : "pi pi-send"}
              onClick={handleSendEmails}
              className="send-button"
              disabled={excelData.length === 0 || sending}
              size="large"
            />
            {sendResult && (
              <div className={`send-result ${sendResult.startsWith('✓') ? 'success' : 'error'}`}>
                {sendResult}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
