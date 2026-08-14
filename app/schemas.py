# -*- coding: utf-8 -*-
"""
Schemas Pydantic para validação de dados de entrada e saída.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


# --- Autenticação ---

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    
    model_config = ConfigDict(from_attributes=True)


class UserChangePassword(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6, max_length=100)


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


# --- Transações ---

class TransactionCreate(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    action: str  # "Comprar", "Vender", "Desdobramento", "Grupamento", "Incorporacao", "Recompensa"
    quantity: float = Field(..., gt=0)
    price_per_share: float = Field(..., ge=0)
    taxes: float = Field(default=0.0, ge=0)
    date: str  # YYYY-MM-DD
    ticker_destino: Optional[str] = None
    fator_conversao: Optional[float] = None
    
    # Campo opcional para atualizar metadados na mesma requisição se fornecido
    company_name: Optional[str] = None
    company_cnpj: Optional[str] = None
    company_category: Optional[str] = None


class TransactionResponse(BaseModel):
    id: str
    ticker: str
    action: str
    quantity: float
    price_per_share: float
    taxes: float
    date: str
    ticker_destino: Optional[str] = None
    fator_conversao: Optional[float] = None
    
    model_config = ConfigDict(from_attributes=True)


# --- Tickers ---

class TickerMetadata(BaseModel):
    name: str
    cnpj: Optional[str] = None
    category: str = "Ações"
    razao_social: Optional[str] = None


class TickerCreate(BaseModel):
    code: str
    name: str
    cnpj: Optional[str] = None
    category: str = "Ações"
    razao_social: Optional[str] = None


class TickerResponse(BaseModel):
    code: str
    name: str
    cnpj: Optional[str] = None
    category: str
    razao_social: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# --- DeclaredStatus ---

class ToggleStatusRequest(BaseModel):
    ticker: str
    year: str


class BulkStatusRequest(BaseModel):
    tickers: List[str]
    year: str
    is_declared: bool


# --- Whitelist ---

class WhitelistRequest(BaseModel):
    ids: Optional[List[str]] = None
    ticker: Optional[str] = None


# --- Holdings ---

class Holding(BaseModel):
    ticker: str
    category: str
    quantity: float
    average_price: float
    total_invested: float


# --- Configurações ---

class UserSettingsUpdate(BaseModel):
    data: Dict[str, Any]
