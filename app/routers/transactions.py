# -*- coding: utf-8 -*-
"""
Rotas para operações CRUD e lógicas especiais de transações.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid

from app.dependencies import get_db, get_current_user
from app.models import User, Transaction, Ticker
from app.schemas import TransactionCreate, TransactionResponse

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


@router.get("", response_model=List[TransactionResponse])
def get_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lista todas as transações do usuário logado ordenadas por data."""
    return db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).order_by(Transaction.date.desc(), Transaction.id.desc()).all()


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def add_transaction(
    tx_data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cria uma nova transação e opcionalmente adiciona/atualiza os metadados do ativo."""
    ticker_code = tx_data.ticker.upper().strip()
    
    # Atualiza ou cria metadados do Ticker se fornecido
    if tx_data.company_name:
        existing_ticker = db.query(Ticker).filter(
            Ticker.user_id == current_user.id,
            Ticker.code == ticker_code
        ).first()
        
        if existing_ticker:
            existing_ticker.name = tx_data.company_name
            existing_ticker.cnpj = tx_data.company_cnpj
            existing_ticker.category = tx_data.company_category or "Ações"
            existing_ticker.razao_social = tx_data.company_name
        else:
            new_ticker = Ticker(
                user_id=current_user.id,
                code=ticker_code,
                name=tx_data.company_name,
                cnpj=tx_data.company_cnpj,
                category=tx_data.company_category or "Ações",
                razao_social=tx_data.company_name
            )
            db.add(new_ticker)
            
    # Cria a transação
    new_tx = Transaction(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        ticker=ticker_code,
        action=tx_data.action,
        quantity=tx_data.quantity,
        price_per_share=tx_data.price_per_share,
        taxes=tx_data.taxes,
        date=tx_data.date,
        ticker_destino=tx_data.ticker_destino.upper().strip() if tx_data.ticker_destino else None,
        fator_conversao=tx_data.fator_conversao
    )
    
    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)
    return new_tx


@router.post("/swap", status_code=status.HTTP_201_CREATED)
def atomic_swap(
    payload: List[TransactionCreate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Executa um swap atômico (normalmente venda de cripto e compra de outra)
    garantindo que ambas as operações sejam inseridas com sucesso ou nenhuma.
    """
    if len(payload) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O swap deve conter exatamente 2 transações (venda e compra)."
        )
        
    created_txs = []
    try:
        for tx_data in payload:
            ticker_code = tx_data.ticker.upper().strip()
            
            # Atualiza/Cria metadados do Ticker se fornecido
            if tx_data.company_name:
                existing_ticker = db.query(Ticker).filter(
                    Ticker.user_id == current_user.id,
                    Ticker.code == ticker_code
                ).first()
                
                if existing_ticker:
                    existing_ticker.name = tx_data.company_name
                    existing_ticker.cnpj = tx_data.company_cnpj
                    existing_ticker.category = tx_data.company_category or "Ações"
                    existing_ticker.razao_social = tx_data.company_name
                else:
                    new_ticker = Ticker(
                        user_id=current_user.id,
                        code=ticker_code,
                        name=tx_data.company_name,
                        cnpj=tx_data.company_cnpj,
                        category=tx_data.company_category or "Ações",
                        razao_social=tx_data.company_name
                    )
                    db.add(new_ticker)
            
            new_tx = Transaction(
                id=str(uuid.uuid4()),
                user_id=current_user.id,
                ticker=ticker_code,
                action=tx_data.action,
                quantity=tx_data.quantity,
                price_per_share=tx_data.price_per_share,
                taxes=tx_data.taxes,
                date=tx_data.date,
                ticker_destino=tx_data.ticker_destino.upper().strip() if tx_data.ticker_destino else None,
                fator_conversao=tx_data.fator_conversao
            )
            db.add(new_tx)
            created_txs.append(new_tx)
            
        db.commit()
        for tx in created_txs:
            db.refresh(tx)
        return {"status": "success", "transactions": created_txs}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao executar o swap atômico: {str(e)}"
        )


@router.put("/{tx_id}", response_model=TransactionResponse)
def update_transaction(
    tx_id: str,
    tx_data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualiza os dados de uma transação existente."""
    tx = db.query(Transaction).filter(
        Transaction.id == tx_id,
        Transaction.user_id == current_user.id
    ).first()
    
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação não encontrada."
        )
        
    ticker_code = tx_data.ticker.upper().strip()
    
    # Atualiza ou cria metadados do Ticker se fornecido
    if tx_data.company_name:
        existing_ticker = db.query(Ticker).filter(
            Ticker.user_id == current_user.id,
            Ticker.code == ticker_code
        ).first()
        
        if existing_ticker:
            existing_ticker.name = tx_data.company_name
            existing_ticker.cnpj = tx_data.company_cnpj
            existing_ticker.category = tx_data.company_category or "Ações"
            existing_ticker.razao_social = tx_data.company_name
        else:
            new_ticker = Ticker(
                user_id=current_user.id,
                code=ticker_code,
                name=tx_data.company_name,
                cnpj=tx_data.company_cnpj,
                category=tx_data.company_category or "Ações",
                razao_social=tx_data.company_name
            )
            db.add(new_ticker)
            
    # Atualiza a transação
    tx.ticker = ticker_code
    tx.action = tx_data.action
    tx.quantity = tx_data.quantity
    tx.price_per_share = tx_data.price_per_share
    tx.taxes = tx_data.taxes
    tx.date = tx_data.date
    tx.ticker_destino = tx_data.ticker_destino.upper().strip() if tx_data.ticker_destino else None
    tx.fator_conversao = tx_data.fator_conversao
    
    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{tx_id}")
def delete_transaction(
    tx_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deleta uma transação pertencente ao usuário."""
    tx = db.query(Transaction).filter(
        Transaction.id == tx_id,
        Transaction.user_id == current_user.id
    ).first()
    
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação não encontrada."
        )
        
    db.delete(tx)
    db.commit()
    return {"message": "Transação removida com sucesso!"}
