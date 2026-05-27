# -*- coding: utf-8 -*-
"""
Rotas para relatórios, verificação de inconsistências, whitelist de alertas e status de declaração.
"""

from typing import List, Dict
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, Transaction, Ticker, DeclaredStatus, Whitelist
from app.schemas import ToggleStatusRequest, BulkStatusRequest, WhitelistRequest

router = APIRouter(prefix="", tags=["Reports & Statuses"])


@router.get("/api/declared-status")
def get_declared_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna o mapeamento de status de declarado do usuário no formato de dicionário legado."""
    statuses = db.query(DeclaredStatus).filter(DeclaredStatus.user_id == current_user.id).all()
    # Retorna no formato legado {"TICKER:ANO": True}
    return {f"{s.ticker.upper()}:{s.year}": True for s in statuses}


@router.post("/api/toggle-declared-status")
def toggle_declared_status(
    req: ToggleStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ativa ou desativa o status de declarado para um determinado ativo e ano."""
    ticker_upper = req.ticker.upper().strip()
    year_str = req.year.strip()
    
    existing = db.query(DeclaredStatus).filter(
        DeclaredStatus.user_id == current_user.id,
        DeclaredStatus.ticker == ticker_upper,
        DeclaredStatus.year == year_str
    ).first()
    
    is_declared = False
    if existing:
        db.delete(existing)
    else:
        new_status = DeclaredStatus(
            user_id=current_user.id,
            ticker=ticker_upper,
            year=year_str
        )
        db.add(new_status)
        is_declared = True
        
    db.commit()
    return {"status": "ok", "is_declared": is_declared}


@router.post("/api/set-declared-status-bulk")
def set_declared_status_bulk(
    req: BulkStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Define o status de declarado em lote para uma lista de ativos."""
    year_str = req.year.strip()
    
    for ticker in req.tickers:
        ticker_upper = ticker.upper().strip()
        
        existing = db.query(DeclaredStatus).filter(
            DeclaredStatus.user_id == current_user.id,
            DeclaredStatus.ticker == ticker_upper,
            DeclaredStatus.year == year_str
        ).first()
        
        if req.is_declared:
            if not existing:
                new_status = DeclaredStatus(
                    user_id=current_user.id,
                    ticker=ticker_upper,
                    year=year_str
                )
                db.add(new_status)
        else:
            if existing:
                db.delete(existing)
                
    db.commit()
    return {"status": "ok"}


@router.get("/api/check-inconsistencies")
def check_inconsistencies(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Analisa a carteira do usuário em busca de transações duplicadas, saldos negativos e metadados faltantes."""
    transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    tickers = db.query(Ticker).filter(Ticker.user_id == current_user.id).all()
    whitelists = db.query(Whitelist).filter(Whitelist.user_id == current_user.id).all()
    
    tickers_meta = {t.code.upper(): {"category": t.category, "cnpj": t.cnpj} for t in tickers}
    whitelist_ids = {w.ref_id for w in whitelists}
    
    inconsistencies = []
    
    # 1. Detectar duplicatas exatas de transação
    seen = {}
    for tx in transactions:
        key = (
            tx.ticker.upper().strip(), 
            tx.action.strip(), 
            float(tx.quantity), 
            float(tx.price_per_share), 
            tx.date, 
            float(tx.taxes or 0.0)
        )
        if key not in seen:
            seen[key] = []
        seen[key].append(tx)
        
    for key, items in seen.items():
        if len(items) > 1:
            inconsistencies.append({
                "type": "DUPLICADO",
                "message": f"{len(items)} registros idênticos para {key[0]} em {key[4]}.",
                "ids": [i.id for i in items],
                "ticker": key[0],
                "date": key[4],
                "quantity": key[2]
            })
            
    # 2. Tickers sem metadados (CNPJ ou categoria) cadastrados, exceto Cripto
    all_tickers = {tx.ticker.upper().strip() for tx in transactions}
    for t in all_tickers:
        meta = tickers_meta.get(t, {})
        if meta.get("category") == "Cripto":
            continue
            
        if t not in tickers_meta or not meta.get("cnpj"):
            inconsistencies.append({
                "type": "DADOS_FALTANDO",
                "message": f"Ticker {t} está sem CNPJ ou Razão Social cadastrada.",
                "ticker": t
            })
            
    # 3. Saldo negativo cronológico (venda descoberta)
    running_balances = {}
    
    # Prioridade de operação no mesmo dia
    def tx_priority(tx: Transaction):
        p = {'comprar': 1, 'recompensa': 1, 'desdobramento': 2, 'grupamento': 2, 'incorporacao': 3, 'vender': 4}
        return p.get(tx.action.lower(), 5)
        
    sorted_txs = sorted(transactions, key=lambda x: (x.date, tx_priority(x)))
    for tx in sorted_txs:
        t = tx.ticker.upper().strip()
        if t not in running_balances:
            running_balances[t] = 0.0
            
        act = tx.action.lower()
        q = float(tx.quantity)
        
        if act in ['comprar', 'recompensa']:
            running_balances[t] += q
        elif act == 'vender':
            if (q - running_balances[t]) > 1e-10:
                inconsistencies.append({
                    "type": "SALDO_INSUFICIENTE",
                    "message": f"Venda de {q} un. de {t} em {tx.date} excede o saldo atual ({running_balances[t]} un.).",
                    "ticker": t,
                    "date": tx.date,
                    "ids": [tx.id]
                })
            running_balances[t] -= q
        elif act == 'desdobramento':
            running_balances[t] *= q
        elif act == 'grupamento':
            if q > 0:
                running_balances[t] /= q
        elif act == 'incorporacao':
            dest = tx.ticker_destino.upper().strip() if tx.ticker_destino else ""
            factor = tx.fator_conversao or q
            if dest:
                if dest not in running_balances:
                    running_balances[dest] = 0.0
                running_balances[dest] += (running_balances[t] * factor)
                running_balances[t] = 0.0
                
    # 4. Filtrar itens na Whitelist
    filtered_inconsistencies = []
    for inc in inconsistencies:
        inc_ids = inc.get("ids", [])
        # Pula se qualquer um dos IDs ou o código do ticker estiver na whitelist
        if any(id in whitelist_ids for id in inc_ids):
            continue
        if inc.get("type") == "DADOS_FALTANDO" and inc.get("ticker") in whitelist_ids:
            continue
            
        filtered_inconsistencies.append(inc)
        
    return filtered_inconsistencies


@router.post("/api/whitelist-inconsistency")
def whitelist_inconsistency(
    payload: WhitelistRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Adiciona transações ou tickers à whitelist para que deixem de exibir alertas de inconsistência."""
    if payload.ids:
        for ref_id in payload.ids:
            existing = db.query(Whitelist).filter(
                Whitelist.user_id == current_user.id,
                Whitelist.ref_id == ref_id
            ).first()
            if not existing:
                new_wl = Whitelist(user_id=current_user.id, ref_id=ref_id)
                db.add(new_wl)
                
    elif payload.ticker:
        ticker_upper = payload.ticker.upper().strip()
        existing = db.query(Whitelist).filter(
            Whitelist.user_id == current_user.id,
            Whitelist.ref_id == ticker_upper
        ).first()
        if not existing:
            new_wl = Whitelist(user_id=current_user.id, ref_id=ticker_upper)
            db.add(new_wl)
            
    db.commit()
    return {"status": "success"}
