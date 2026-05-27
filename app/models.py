# -*- coding: utf-8 -*-
"""
Modelos de dados SQLAlchemy para o DeclarAtivo.
Suporta múltiplos usuários e mapeia todas as tabelas necessárias.
"""

from datetime import datetime
import uuid
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_pw = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relacionamentos
    tickers = relationship("Ticker", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    declared_statuses = relationship("DeclaredStatus", back_populates="user", cascade="all, delete-orphan")
    whitelists = relationship("Whitelist", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Ticker(Base):
    __tablename__ = "tickers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    code = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    cnpj = Column(String, nullable=True)
    category = Column(String, default="Ações", nullable=False)
    razao_social = Column(String, nullable=True)

    # Relacionamento com User
    user = relationship("User", back_populates="tickers")

    __table_args__ = (
        UniqueConstraint("user_id", "code", name="uq_user_ticker_code"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker = Column(String, nullable=False)
    action = Column(String, nullable=False)  # "Comprar", "Vender", "Desdobramento", "Grupamento", "Incorporacao", "Recompensa"
    quantity = Column(Float, nullable=False)
    price_per_share = Column(Float, nullable=False)
    taxes = Column(Float, default=0.0, nullable=False)
    date = Column(String, nullable=False)  # Formato "YYYY-MM-DD"
    ticker_destino = Column(String, nullable=True)
    fator_conversao = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="transactions")


class DeclaredStatus(Base):
    __tablename__ = "declared_statuses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker = Column(String, nullable=False)
    year = Column(String, nullable=False)

    user = relationship("User", back_populates="declared_statuses")

    __table_args__ = (
        UniqueConstraint("user_id", "ticker", "year", name="uq_user_ticker_year"),
    )


class Whitelist(Base):
    __tablename__ = "whitelists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ref_id = Column(String, nullable=False)  # Pode ser ID de transação ou código de ticker

    user = relationship("User", back_populates="whitelists")

    __table_args__ = (
        UniqueConstraint("user_id", "ref_id", name="uq_user_ref_id"),
    )


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    data = Column(JSON, default=dict, nullable=False)

    user = relationship("User", back_populates="settings")
