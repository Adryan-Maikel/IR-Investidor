# 🏛️ DeclarAtivo

> **DeclarAtivo** (uma fusão de *Declara* + *Ativo*) é um dashboard profissional e elegante projetado especificamente para investidores brasileiros gerenciarem suas posições, calcularem preço médio e organizarem todas as informações necessárias para a declaração anual de **Imposto de Renda (IRPF)**.
>
> Esta aplicação foi projetada como um sistema ultraleve, focado e de alta performance, contendo apenas módulos essenciais ao controle de ativos financeiros.

---

## ✨ Principais Funcionalidades

*   **📊 Posição Consolidada (Bens e Direitos):** Exibição em tempo real de ativos categorizados (Ações, FIIs, Criptoativos, BDRs), calculando o preço médio ponderado e considerando as taxas operacionais da B3.
*   **💸 Nova Operação & Eventos de Ativos:** Registro intuitivo de transações de Compra, Venda e Recompensa. Suporte nativo para eventos corporativos complexos, como **Desdobramentos (Splits)**, **Grupamentos (Inversos)** e **Incorporações (Fusões)** sem fluxo financeiro direto.
*   **💱 Troca de Cripto (Swap):** Permite registrar a troca direta de criptoativos, registrando de forma automática as ordens de compra e venda casadas necessárias para o fisco.
*   **🔍 Validador & Auditor de Inconsistências:** Sistema inteligente que detecta em tempo real registros duplicados, ativos sem metadados fiscais (como CNPJ de emissores) e erros de saldo insuficiente (venda a descoberto). Conta com suporte a whitelist para ignorar avisos falsos.
*   **📊 Relatório de Ganhos e Perdas (DARF):** Relatório automático das operações do ano-calendário, facilitando o cálculo e apuração de tributos mensais.
*   **🏢 Ficha de FIIs / Fiagro:** Tabela consolidada para preenchimento direto no programa oficial da Receita Federal.
*   **🎨 Customização de Temas:** Suporte completo a modos Escuro, Claro e Automático, com paletas de cores customizáveis para cada categoria de ativo.

---

## 🛠️ Arquitetura e Tecnologias

O **DeclarAtivo** utiliza uma arquitetura minimalista, moderna e extremamente performática:

*   **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+) — Rápido, assíncrono e baseado em tipos padrões do Python (Pydantic v2).
*   **Banco de Dados:** [SQLite](https://sqlite.org/) via [SQLAlchemy](https://www.sqlalchemy.org/) — Integrado com suporte a modo **WAL (Write-Ahead Logging)** e chaves estrangeiras ativas, proporcionando máxima concorrência e integridade referencial.
*   **Segurança:** Controle de acesso multiusuário completo com senhas criptografadas via **BCrypt** e sessões gerenciadas por tokens de acesso **JWT (JSON Web Tokens)**.
*   **Frontend:** SPA (Single Page Application) construída em HTML5 semântico, CSS3 Moderno (CSS Variables, Grid, Flexbox, Glassmorphism, Micro-animações responsivas) e Javascript Puro (Vanilla JS).

---

## 📂 Estrutura de Diretórios do Projeto

O código do projeto é totalmente modular e organizado de acordo com as melhores práticas de desenvolvimento:

```text
DeclarAtivo/
├── main.py                 # Servidor web FastAPI (configuração de middlewares e lifespan do banco)
├── .env                    # Configuração local de variáveis de ambiente (gerado automaticamente)
├── .gitignore              # Regras de segurança para não comitar dados sensíveis ou ambientes locais
├── declarativo.db          # Banco de dados SQLite relacional (produção local)
├── requirements.txt        # Dependências de pacotes Python
├── legacy/                 # Diretório de arquivos de dados históricos/JSON legados
│   ├── data.json           # Banco JSON antigo (migrado)
│   └── data.json.bak       # Backup antigo do JSON
└── app/                    # Código do backend modularizado em Python
    ├── config.py           # Configurações centralizadas do sistema carregadas do .env
    ├── database.py         # Configuração de Engine SQLite, Pragmas (WAL/FK) e criação de tabelas
    ├── dependencies.py     # Injeção de dependências do FastAPI (sessão de DB e autenticação JWT)
    ├── migrate.py          # Script administrativo CLI para migrar bases legadas JSON para SQLite
    ├── models.py           # Modelos de tabelas relacionais do SQLAlchemy (Users, Transactions, etc.)
    ├── schemas.py          # Schemas Pydantic para validação e documentação automática das APIs
    ├── security.py         # Hashing de senhas (BCrypt) e utilitários de tokens (JWT)
    └── routers/            # Módulos de controle de rotas de API
        ├── auth.py         # Cadastro de usuários, login JWT e alteração de senha
        ├── holdings.py     # Consolidação de carteira e posições históricas anuais em 31/12
        ├── reports.py      # Relatório de DARF, auditoria de inconsistências e whitelist
        ├── scraping.py     # Raspagem em tempo real de CNPJs e Razão Social dos ativos
        ├── tickers.py      # Gerenciamento de metadados específicos de ativos
        └── transactions.py # Operações CRUD de transações e swap atômico de Criptomoedas
```

---

## 🚀 Como Executar

### 1. Pré-requisitos
Certifique-se de ter o **Python 3.10** ou superior instalado em sua máquina.

### 2. Instalar dependências
Abra seu terminal na pasta do projeto e instale as dependências listadas no arquivo `requirements.txt`:
```bash
pip install -r requirements.txt
```

### 3. Rodar o Servidor
Execute o comando abaixo para iniciar o backend de desenvolvimento:
```bash
python main.py
```
Isso levantará o servidor FastAPI automaticamente na porta `8000`.

### 4. Acessar a Aplicação
Abra o navegador e acesse:
👉 [http://127.0.0.1:8000](http://127.0.0.1:8000)

---

## 🔐 Autenticação Padrão

Por padrão, a migração inicial de dados do DeclarAtivo vincula todas as transações importadas a um usuário administrador padrão:

*   **Usuário padrão:** `admin`
*   **Senha padrão:** `admin`

> [!IMPORTANT]
> Para garantir a segurança dos seus dados de investimentos locais, recomendamos que você altere sua senha imediatamente após o primeiro login acessando a seção do seu perfil no canto superior direito do dashboard.

---

## 💾 Gerenciamento do Banco de Dados SQLite

O SQLite é extremamente prático e portátil. Ele mantém todo o banco de dados em um único arquivo: `declarativo.db`.

### 🔄 Modos de Arquivo do SQLite
Quando a aplicação está em execução, você verá três arquivos referentes ao banco na raiz:
1.  `declarativo.db` (O banco de dados principal)
2.  `declarativo.db-wal` (Arquivo temporário de escrita - Write-Ahead Log)
3.  `declarativo.db-shm` (Arquivo temporário de índice compartilhado)

### 📦 Como fazer backups seguros
*   Sempre faça backup do arquivo principal `declarativo.db`.
*   Para garantir que o backup seja consistente, **feche o servidor FastAPI** (Ctrl+C no console) antes de copiar o arquivo. Isso fará com que o SQLite aplique todas as alterações pendentes do arquivo `-wal` para o `.db` principal e limpe os arquivos temporários de forma limpa.
*   Basta salvar uma cópia do arquivo `declarativo.db` em sua nuvem ou drive externo de segurança. Para restaurar, basta recolocar o arquivo de cópia na raiz do projeto como `declarativo.db`.

---

## 🏛️ Conceito da Marca (Branding)

O nome **DeclarAtivo** traz um duplo sentido inteligente:
1.  **Declarativo:** Em programação, refere-se ao paradigma onde expressamos a lógica sem descrever o controle de fluxo. No contexto financeiro, significa que o sistema ajuda a tornar sua declaração de investimentos automatizada, rápida e direta.
2.  **Declara + Ativo:** O objetivo central do projeto é registrar, gerenciar e permitir que você **declare seus ativos** financeiros de maneira transparente e sem dores de cabeça com a Receita Federal.
