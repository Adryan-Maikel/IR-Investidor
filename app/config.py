"""
Configurações centralizadas do DeclarAtivo.
Carrega variáveis de ambiente do arquivo .env.
"""

import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

# Carrega .env do diretório raiz do projeto
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

# Gera .env automaticamente se não existir
if not ENV_PATH.exists():
    generated_key = secrets.token_hex(32)
    ENV_PATH.write_text(
        f"SECRET_KEY={generated_key}\n"
        f"DATABASE_URL=sqlite:///{BASE_DIR / 'declarativo.db'}\n"
        f"ACCESS_TOKEN_EXPIRE_MINUTES=720\n"
    )

load_dotenv(ENV_PATH)


class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    SECRET_KEY: str = os.getenv("SECRET_KEY", secrets.token_hex(32))
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'declarativo.db'}")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))
    ALGORITHM: str = "HS256"
    # Rate limiting
    LOGIN_RATE_LIMIT: int = 5  # tentativas por minuto
    GENERAL_RATE_LIMIT: int = 100  # requests por minuto


settings = Settings()
