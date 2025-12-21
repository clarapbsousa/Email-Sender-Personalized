# Email Sender Personalized

Sistema de envio de emails personalizados em massa para facilitar a comunicação com encarregados de educação.

## Descrição

Esta aplicação permite enviar emails personalizados automaticamente a partir de um ficheiro Excel. É especialmente útil para escolas e professores que precisam de comunicar com encarregados de educação de forma eficiente.

## Funcionalidades

- **Autenticação Google OAuth** - Login seguro com conta Google
- **Upload de ficheiro Excel** - Suporta formatos `.xls` e `.xlsx`
- **Personalização de mensagens** - Use `{nomeEE}` e `{nomeAluno}` como placeholders
- **Assunto personalizável** - O assunto também suporta placeholders
- **Pré-visualização** - Veja como ficará o email antes de enviar
- **Envio automático via Gmail API** - Integração direta com o Gmail
- **Sistema de retry inteligente** - Respeita rate limits e tenta novamente automaticamente
- **Cache de status** - Evita duplicação de emails já enviados

## Como usar

1. Faça login com a sua conta Google
2. Prepare um ficheiro Excel com as colunas:
   - Nome do Encarregado de Educação (ou variações)
   - Nome do Aluno (ou variações)
   - Email do Encarregado de Educação (ou variações)
3. Faça upload do ficheiro
4. Escreva o assunto e a mensagem usando os placeholders
5. Pré-visualize o email
6. Clique em "Enviar Emails"

## Tecnologias

- **Next.js 14** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **NextAuth.js** - Autenticação OAuth
- **Gmail API** - Envio de emails
- **PrimeReact** - Componentes UI
- **XLSX** - Leitura de ficheiros Excel

## Instalação

```bash
npm install
```

Crie um ficheiro `.env` com as credenciais OAuth do Google:

```
GOOGLE_CLIENT_ID=seu_client_id
GOOGLE_CLIENT_SECRET=seu_client_secret
NEXTAUTH_SECRET=seu_secret_aleatorio
NEXTAUTH_URL=http://localhost:3000
```

Execute o projeto:

```bash
npm run dev
```

---

### Nota importante:
A API do Gmail tem uma limitação de **500 emails por dia** por conta gratuita. Por este motivo, este projeto ainda está em desenvolvimento (WIP) enquanto procuro uma alternativa gratuita, porque sou pobre e não tenho dinheiro para serviços pagos de envio de emails em massa. 
