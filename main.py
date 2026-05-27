# -*- coding: utf-8 -*-
"""
Entry-point da aplicação FastAPI do DeclarAtivo.
Configura middlewares, monta rotas modularizadas, executa migrações automáticas de banco de dados
e serve o frontend estático.
"""

import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import create_tables
from app.routers import auth, transactions, tickers, holdings, reports, settings, scraping


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle do FastAPI: Inicializa o banco de dados."""
    print("Iniciando DeclarAtivo...")
    try:
        # Garante a criação das tabelas do banco de dados SQLite
        create_tables()
    except Exception as e:
        print(f"Erro ao inicializar tabelas do banco: {e}")
    yield
    print("Desligando DeclarAtivo...")


app = FastAPI(
    title="DeclarAtivo - IR Inteligente",
    description="Sistema inteligente e seguro para declaração anual de ativos e imposto de renda.",
    version="2.0.0",
    lifespan=lifespan
)

# Configuração de CORS para segurança e flexibilidade local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite chamadas locais de qualquer origem para facilidade no desenvolvimento local
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de todos os routers modularizados
app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(tickers.router)
app.include_router(holdings.router)
app.include_router(reports.router)
app.include_router(settings.router)
app.include_router(scraping.router)


# --- Servir Frontend Estático ---

# Monta o diretório de assets do build do React
if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

# Monta o diretório public para servir assets estáticos
app.mount("/static", StaticFiles(directory="public"), name="static")


@app.get("/")
async def read_index():
    """Retorna o arquivo HTML principal do frontend."""
    if os.path.exists("frontend/dist/index.html"):
        return FileResponse('frontend/dist/index.html')
    return FileResponse('public/index.html')


if __name__ == "__main__":
    import uvicorn
    # A aplicação é configurada para rodar estritamente na porta 8000
    print("Rodando DeclarAtivo na porta 8000...")
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        use_colors=True
    )