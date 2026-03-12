"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Header from "../components/Header";
import * as XLSX from "xlsx";

interface ExcelData {
  nomeEE: string;
  nomeAluno: string;
  emailEE: string;
}

type Step = 1 | 2 | 3 | 4;

interface Toast {
  message: string;
  type: "success" | "loading" | "info" | "error";
  visible: boolean;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [excelData, setExcelData] = useState<ExcelData[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [subject, setSubject] = useState(
    "Convite: {{studentName}} - Espetáculo Final da Escola"
  );
  const [body, setBody] = useState(
    "Caro/a {{EEName}},\n\nVimos por este meio convidá-lo/a e à sua família para o Espetáculo Final da Escola, onde {{studentName}} irá apresentar o seu trabalho.\n\nData: [Inserir Data]\nHora: [Inserir Hora]\nLocal: Auditório da Escola\n\nEsperamos vê-lo/a em breve!\n\nCom os melhores cumprimentos,\nA Equipa da Escola"
  );
  const [sending, setSending] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<Toast>({
    message: "",
    type: "info",
    visible: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  const showToast = (
    message: string,
    type: "success" | "loading" | "info" | "error" = "info"
  ) => {
    setToast({ message, type, visible: true });
    if (type !== "loading") {
      setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
    }
  };

  const parseFile = (file: File) => {
    showToast(`A ler ${file.name}...`, "loading");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];
        const parsed: ExcelData[] = json.map((row) => ({
          nomeEE: row["Nome EE"] || row["Nome do EE"] || row["nomeEE"] || row["EEName"] || "",
          nomeAluno: row["Nome"] || row["Nome do Aluno"] || row["nomeAluno"] || row["studentName"] || "",
          emailEE: row["Email pessoal EE"] || row["Email do EE"] || row["emailEE"] || row["EEemail"] || "",
        }));
        setExcelData(parsed);
        setToast({ message: "", type: "info", visible: false });
        showToast("Ficheiro carregado com sucesso!", "success");
      } catch {
        showToast("Erro ao ler ficheiro.", "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) parseFile(file);
    },
    []
  );

  const resetUpload = () => {
    setExcelData([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const template =
      "EEName,EEemail,studentName\nNome do EE,email@exemplo.com,Nome do Aluno";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template.csv";
    a.click();
    showToast("Template descarregado!", "success");
  };

  const insertVariable = (variable: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = body.substring(0, start) + variable + body.substring(end);
    setBody(newVal);
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + variable.length;
    }, 0);
  };

  const getPreview = (text: string) => {
    if (!excelData.length) return text;
    const s = excelData[0];
    return text
      .replace(/{{EEName}}/g, s.nomeEE)
      .replace(/{{EEemail}}/g, s.emailEE)
      .replace(/{{studentName}}/g, s.nomeAluno)
      .replace(/{nomeEE}/g, s.nomeEE)
      .replace(/{nomeAluno}/g, s.nomeAluno);
  };

  const handleSendEmails = async () => {
    setSending(true);
    showToast("A enviar convites...", "loading");
    try {
      const mappedData = excelData.map((row) => ({
        nomeEE: row.nomeEE,
        nomeAluno: row.nomeAluno,
        emailEE: row.emailEE,
      }));
      // convert template vars to the API format
      const apiMessage = body
        .replace(/{{EEName}}/g, "{nomeEE}")
        .replace(/{{studentName}}/g, "{nomeAluno}")
        .replace(/{{EEemail}}/g, "{emailEE}");
      const apiSubject = subject
        .replace(/{{EEName}}/g, "{nomeEE}")
        .replace(/{{studentName}}/g, "{nomeAluno}")
        .replace(/{{EEemail}}/g, "{emailEE}");

      const response = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          excelData: mappedData,
          subject: apiSubject,
          message: apiMessage,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccessCount(excelData.length);
        setCurrentStep(4);
        setToast({ message: "", type: "info", visible: false });
        showToast("Todos os convites foram enviados!", "success");
      } else {
        showToast(`Erro: ${data.message}`, "error");
      }
    } catch {
      showToast("Erro ao enviar emails.", "error");
    } finally {
      setSending(false);
    }
  };

  const startNewCampaign = () => {
    setExcelData([]);
    setCurrentStep(1);
    setSubject("Convite: {{studentName}} - Espetáculo Final da Escola");
    setBody(
      "Caro/a {{EEName}},\n\nVimos por este meio convidá-lo/a e à sua família para o Espetáculo Final da Escola, onde {{studentName}} irá apresentar o seu trabalho.\n\nData: [Inserir Data]\nHora: [Inserir Hora]\nLocal: Auditório da Escola\n\nEsperamos vê-lo/a em breve!\n\nCom os melhores cumprimentos,\nA Equipa da Escola"
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const stepLabels = ["Upload", "Template", "Revisão", "Enviar"];
  const progressPct = ((currentStep - 1) / 3) * 100;

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-strong rounded-2xl p-8 text-center">
          <div
            className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-4"
            style={{ borderColor: '#1DA1F2', borderTopColor: 'transparent' }}
          ></div>
          <p style={{ color: '#8899A6' }}>A carregar...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <>
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ background: 'rgba(29,161,242,0.1)' }}></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ background: 'rgba(0,186,124,0.1)', animationDelay: '2s' }}></div>
      </div>

      <Header />

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">

        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-center justify-between max-w-3xl mx-auto relative">
            <div className="absolute top-5 left-0 w-full h-1 rounded-full" style={{ background: '#38444D', zIndex: 0 }}></div>
            <div
              className="absolute top-5 left-0 h-1 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: 'linear-gradient(to right, #1DA1F2, #00BA7C)', zIndex: 1 }}
            ></div>
            {stepLabels.map((label, i) => {
              const stepNum = (i + 1) as Step;
              const isCompleted = stepNum < currentStep;
              const isActive = stepNum === currentStep;
              return (
                <div key={stepNum} className="flex flex-col items-center relative z-10">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300"
                    style={{
                      background: isCompleted
                        ? '#00BA7C'
                        : isActive
                        ? '#1DA1F2'
                        : '#253341',
                      border: isCompleted || isActive ? 'none' : '1px solid #38444D',
                      boxShadow: isCompleted
                        ? '0 4px 15px rgba(0,186,124,0.3)'
                        : isActive
                        ? '0 4px 15px rgba(29,161,242,0.5)'
                        : 'none',
                      color: '#ffffff',
                    }}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span
                    className="mt-2 text-sm font-medium"
                    style={{
                      color: isCompleted ? '#00BA7C' : isActive ? '#1DA1F2' : '#8899A6',
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 1: Upload */}
        {currentStep === 1 && (
          <div className="max-w-4xl mx-auto animate-slide-up">
            <div className="glass-strong rounded-3xl p-8 md:p-12 shadow-2xl" style={{ border: '1px solid #38444D' }}>
              <div className="mb-8">
                <h2 className="text-3xl font-display font-bold mb-2 text-white">Upload da Lista de Alunos</h2>
                <p style={{ color: '#8899A6' }}>Carregue um ficheiro Excel com os dados dos encarregados de educação</p>
                <p style={{ color: '#8899A6' }}>Nota: Os dados devem estar com nomeEE, nomeAluno e emailEE</p>
              </div>

              <div
                className={`drop-zone rounded-2xl p-12 text-center cursor-pointer group${dragOver ? ' drag-over' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                />
                <div className="mb-6 relative inline-block">
                  <div className="absolute inset-0 rounded-full blur-xl transition-all" style={{ background: 'rgba(29,161,242,0.2)' }}></div>
                  <svg className="w-16 h-16 relative z-10 mx-auto transform group-hover:scale-110 transition-transform" style={{ color: '#1DA1F2' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-xl font-semibold mb-2 text-white">Largue o ficheiro Excel aqui</p>
                <p className="mb-6" style={{ color: '#8899A6' }}>ou clique para procurar</p>
                <div className="inline-flex items-center space-x-2 text-sm glass px-4 py-2 rounded-full" style={{ color: '#8899A6', border: '1px solid #38444D' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Suporta .xlsx, .xls, .csv</span>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={downloadTemplate}
                  className="text-sm flex items-center space-x-2 transition-colors hover:opacity-80"
                  style={{ color: '#1DA1F2' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Descarregar ficheiro template</span>
                </button>
              </div>

              {excelData.length > 0 && (
                <div className="mt-8 animate-slide-up">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center space-x-2 text-white">
                      <svg className="w-5 h-5" style={{ color: '#00BA7C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        Pré-visualização (<span style={{ color: '#1DA1F2' }}>{excelData.length}</span> alunos)
                      </span>
                    </h3>
                    <button
                      onClick={resetUpload}
                      className="text-sm transition-colors hover:opacity-70"
                      style={{ color: '#F4212E' }}
                    >
                      Limpar e re-carregar
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #38444D', background: '#192734' }}>
                    <table className="w-full text-left">
                      <thead style={{ background: '#253341', borderBottom: '1px solid #38444D' }}>
                        <tr>
                          <th className="px-6 py-4 text-sm font-semibold" style={{ color: '#8899A6' }}>Nome do EE</th>
                          <th className="px-6 py-4 text-sm font-semibold" style={{ color: '#8899A6' }}>Email</th>
                          <th className="px-6 py-4 text-sm font-semibold" style={{ color: '#8899A6' }}>Nome do Aluno</th>
                          <th className="px-6 py-4 text-sm font-semibold" style={{ color: '#8899A6' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excelData.map((row, i) => (
                          <tr key={i} className="transition-colors" style={{ borderTop: i > 0 ? '1px solid #38444D' : undefined }}>
                            <td className="px-6 py-4 text-sm font-medium text-white">{row.nomeEE}</td>
                            <td className="px-6 py-4 text-sm" style={{ color: '#8899A6' }}>{row.emailEE}</td>
                            <td className="px-6 py-4 text-sm font-medium" style={{ color: '#1DA1F2' }}>{row.nomeAluno}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(0,186,124,0.2)', color: '#00BA7C', border: '1px solid rgba(0,186,124,0.3)' }}>
                                Pronto
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="btn-shine twitter-btn-primary text-white font-bold py-3 px-8 rounded-xl flex items-center space-x-2 transition-all transform hover:scale-[1.02]"
                    >
                      <span>Continuar para Template</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Email Template */}
        {currentStep === 2 && (
          <div className="max-w-4xl mx-auto animate-slide-up">
            <div className="glass-strong rounded-3xl p-8 md:p-12 shadow-2xl" style={{ border: '1px solid #38444D' }}>
              <div className="mb-8">
                <h2 className="text-3xl font-display font-bold mb-2 text-white">Compor Convite</h2>
                <p style={{ color: '#8899A6' }}>Escreva o template do email usando variáveis dinâmicas</p>
              </div>

              {/* Variable Tags */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3" style={{ color: '#8899A6' }}>
                  Inserir Variáveis (clique para adicionar):
                </label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: '👤 {{EEName}} - Nome EE', value: '{{EEName}}' },
                    { label: '📧 {{EEemail}} - Email', value: '{{EEemail}}' },
                    { label: '🎓 {{studentName}} - Nome Aluno', value: '{{studentName}}' },
                  ].map((v) => (
                    <button
                      key={v.value}
                      onClick={() => insertVariable(v.value)}
                      className="variable-tag px-4 py-2 rounded-lg text-sm font-medium text-white transition-all transform hover:scale-105"
                      style={{ boxShadow: '0 2px 10px rgba(29,161,242,0.3)' }}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#8899A6' }}>Assunto</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full twitter-input rounded-xl px-4 py-3 font-medium"
                    placeholder="Assunto do email..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#8899A6' }}>Corpo do Email</label>
                  <textarea
                    ref={textareaRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={12}
                    className="w-full twitter-input rounded-xl px-4 py-3 resize-none font-mono text-sm leading-relaxed"
                    placeholder="Escreva o seu email aqui..."
                  />
                </div>

                {/* Live Preview */}
                <div className="glass rounded-xl p-6" style={{ border: '1px solid #38444D', background: '#192734' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#8899A6' }}>Pré-visualização</h4>
                    <span className="text-xs" style={{ color: '#8899A6' }}>Mostrando exemplo com o primeiro aluno</span>
                  </div>
                  <div className="rounded-lg p-6 text-white shadow-inner" style={{ background: '#15202B', border: '1px solid #38444D' }}>
                    <div className="pb-3 mb-3" style={{ borderBottom: '1px solid #38444D' }}>
                      <span className="text-sm" style={{ color: '#8899A6' }}>Para:</span>
                      <span className="ml-2 text-sm font-medium" style={{ color: '#1DA1F2' }}>
                        {excelData.length > 0 ? excelData[0].emailEE : 'ee@exemplo.com'}
                      </span>
                    </div>
                    <div className="pb-3 mb-3" style={{ borderBottom: '1px solid #38444D' }}>
                      <span className="text-sm" style={{ color: '#8899A6' }}>Assunto:</span>
                      <span className="ml-2 text-sm font-semibold text-white">{getPreview(subject)}</span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#d1d5db' }}>{getPreview(body)}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="flex items-center space-x-2 transition-colors hover:text-white"
                    style={{ color: '#8899A6' }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Voltar</span>
                  </button>
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="btn-shine twitter-btn-primary text-white font-bold py-3 px-8 rounded-xl flex items-center space-x-2 transition-all transform hover:scale-[1.02]"
                  >
                    <span>Rever &amp; Enviar</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === 3 && (
          <div className="max-w-4xl mx-auto animate-slide-up">
            <div className="glass-strong rounded-3xl p-8 md:p-12 shadow-2xl" style={{ border: '1px solid #38444D' }}>
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-display font-bold mb-2 text-white">Pronto para Enviar?</h2>
                <p style={{ color: '#8899A6' }}>Reveja a sua campanha antes de enviar a todos os encarregados</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {[
                  { value: excelData.length, label: 'Total de Destinatários', color: '#1DA1F2' },
                  { value: 3, label: 'Variáveis Usadas', color: '#00BA7C' },
                  { value: 'Gmail', label: 'Método de Envio', color: '#F4212E' },
                ].map((stat, i) => (
                  <div key={i} className="glass rounded-2xl p-6 text-center" style={{ border: '1px solid #38444D', background: '#192734' }}>
                    <div className="text-4xl font-bold mb-2" style={{ color: stat.color }}>{stat.value}</div>
                    <div className="text-sm" style={{ color: '#8899A6' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="glass rounded-xl p-6 mb-8" style={{ border: '1px solid #38444D', background: '#192734' }}>
                <h3 className="font-semibold mb-4 flex items-center space-x-2 text-white">
                  <svg className="w-5 h-5" style={{ color: '#1DA1F2' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Resumo do Email</span>
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex">
                    <span className="w-20" style={{ color: '#8899A6' }}>Assunto:</span>
                    <span className="text-white font-medium">{subject}</span>
                  </div>
                  <div className="flex">
                    <span className="w-20 flex-shrink-0" style={{ color: '#8899A6' }}>Template:</span>
                    <span className="overflow-hidden" style={{ color: '#8899A6', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{body}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-4 mb-8 flex items-start space-x-3" style={{ background: 'rgba(244,33,46,0.1)', border: '1px solid rgba(244,33,46,0.2)' }}>
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#F4212E' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm">
                  <p className="font-bold mb-1" style={{ color: '#F4212E' }}>Importante:</p>
                  <p style={{ color: '#8899A6' }}>Isto irá enviar emails reais a todos os encarregados listados. Certifique-se de que os dados do Excel estão corretos.</p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center space-x-2 transition-colors hover:text-white"
                  style={{ color: '#8899A6' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Editar Template</span>
                </button>
                <button
                  onClick={handleSendEmails}
                  disabled={sending}
                  className="btn-shine text-white font-bold py-4 px-10 rounded-xl flex items-center space-x-3 text-lg transition-all transform hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: '#00BA7C', boxShadow: sending ? 'none' : '0 4px 15px rgba(0,186,124,0.3)' }}
                >
                  {sending ? (
                    <>
                      <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>A enviar...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>Enviar Todos os Convites</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {currentStep === 4 && (
          <div className="max-w-2xl mx-auto animate-slide-up">
            <div className="glass-strong rounded-3xl p-12 text-center shadow-2xl" style={{ border: '1px solid #38444D' }}>
              <div className="mb-8 flex justify-center">
                <svg className="success-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                  <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
                  <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                </svg>
              </div>

              <h2 className="text-3xl font-display font-bold mb-4 text-white">Convites Enviados!</h2>
              <p className="mb-8" style={{ color: '#8899A6' }}>
                Todos os encarregados foram notificados sobre o espetáculo final. Verifique a sua pasta de enviados para confirmação.
              </p>

              <div className="glass rounded-2xl p-6 mb-8 inline-block" style={{ border: '1px solid #38444D', background: '#192734' }}>
                <div
                  className="text-5xl font-bold"
                  style={{ background: 'linear-gradient(to right, #00BA7C, #1DA1F2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                  {successCount}
                </div>
                <div className="text-sm mt-1" style={{ color: '#8899A6' }}>Emails entregues com sucesso</div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={startNewCampaign}
                  className="w-full btn-shine twitter-btn-primary text-white font-bold py-4 px-8 rounded-xl transition-all"
                >
                  Iniciar Nova Campanha
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      <div
        className="fixed bottom-6 right-6 z-50 transition-all duration-300"
        style={{ transform: toast.visible ? 'translateY(0)' : 'translateY(80px)', opacity: toast.visible ? 1 : 0 }}
      >
        <div className="glass-strong rounded-xl px-6 py-4 shadow-2xl flex items-center space-x-3" style={{ border: '1px solid #38444D', background: '#192734' }}>
          {toast.type === 'success' && (
            <svg className="w-6 h-6" style={{ color: '#00BA7C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast.type === 'loading' && (
            <svg className="w-6 h-6 animate-spin" style={{ color: '#1DA1F2' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {(toast.type === 'info' || toast.type === 'error') && (
            <svg className="w-6 h-6" style={{ color: toast.type === 'error' ? '#F4212E' : '#1DA1F2' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="font-medium text-white">{toast.message}</span>
        </div>
      </div>
    </>
  );
}
