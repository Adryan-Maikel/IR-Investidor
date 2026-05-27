# -*- coding: utf-8 -*-
"""
Configuração do banco de dados SQLAlchemy.
Utiliza SQLite com suporte a WAL mode para melhor concorrência.
"""

from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy import create_engine

from app.config import settings


# Configuração do engine SQLite
# check_same_thread=False é necessário para SQLite com FastAPI
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=(settings.ENVIRONMENT == "development"),
)


# Habilita WAL mode e foreign keys no SQLite
@event.listens_for(Engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:  # noqa: ANN001
    """Configura pragmas do SQLite ao conectar."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()


# Fábrica de sessões
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    class_=Session,
)


class Base(DeclarativeBase):
    """Classe base declarativa para todos os modelos."""
    pass


def create_tables() -> None:
    """Cria todas as tabelas no banco de dados."""
    Base.metadata.create_all(bind=engine)
