# -*- coding: utf-8 -*-
"""
Rotas para obter e modificar os metadados dos ativos (tickers).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict

from app.dependencies import get_db, get_current_user
from app.models import User, Ticker
from app.schemas import TickerMetadata, TickerCreate

router = APIRouter(prefix="/api/tickers", tags=["Tickers"])


@router.get("", response_model=Dict[str, TickerMetadata])
def get_tickers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna os metadados de todos os ativos cadastrados pelo usuário no formato de dicionário."""
    tickers = db.query(Ticker).filter(Ticker.user_id == current_user.id).all()
    # Converte a lista em dicionário no formato legado para compatibilidade do frontend
    return {
        t.code.upper(): TickerMetadata(
            name=t.name,
            cnpj=t.cnpj,
            category=t.category,
            razao_social=t.razao_social or t.name
        ) for t in tickers
    }


@router.post("", status_code=status.HTTP_200_OK)
def create_ticker(
    data: TickerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cria ou atualiza os metadados de um ativo do usuário via POST."""
    ticker_code = data.code.upper().strip()
    if not ticker_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código do ticker é obrigatório."
        )
    
    existing_ticker = db.query(Ticker).filter(
        Ticker.user_id == current_user.id,
        Ticker.code == ticker_code
    ).first()
    
    if existing_ticker:
        existing_ticker.name = data.name
        existing_ticker.cnpj = data.cnpj
        existing_ticker.category = data.category
        existing_ticker.razao_social = data.razao_social or data.name
    else:
        new_ticker = Ticker(
            user_id=current_user.id,
            code=ticker_code,
            name=data.name,
            cnpj=data.cnpj,
            category=data.category,
            razao_social=data.razao_social or data.name
        )
        db.add(new_ticker)
        
    db.commit()
    return {"message": f"Ativo {ticker_code} cadastrado com sucesso!"}


@router.put("/{ticker}", status_code=status.HTTP_200_OK)
def update_ticker(
    ticker: str,
    meta: TickerMetadata,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualiza ou cria metadados de um ativo específico do usuário."""
    ticker_code = ticker.upper().strip()
    
    existing_ticker = db.query(Ticker).filter(
        Ticker.user_id == current_user.id,
        Ticker.code == ticker_code
    ).first()
    
    if existing_ticker:
        existing_ticker.name = meta.name
        existing_ticker.cnpj = meta.cnpj
        existing_ticker.category = meta.category
        existing_ticker.razao_social = meta.razao_social or meta.name
    else:
        new_ticker = Ticker(
            user_id=current_user.id,
            code=ticker_code,
            name=meta.name,
            cnpj=meta.cnpj,
            category=meta.category,
            razao_social=meta.razao_social or meta.name
        )
        db.add(new_ticker)
        
    db.commit()
    return {"message": "Ativo atualizado!"}


@router.delete("/{ticker}", status_code=status.HTTP_200_OK)
def delete_ticker(
    ticker: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove um ativo da lista do usuário."""
    ticker_code = ticker.upper().strip()
    
    ticker_obj = db.query(Ticker).filter(
        Ticker.user_id == current_user.id,
        Ticker.code == ticker_code
    ).first()
    
    if not ticker_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ativo não encontrado na lista."
        )
        
    db.delete(ticker_obj)
    db.commit()
    return {"message": "Ativo removido do catálogo!"}
