# -*- coding: utf-8 -*-
"""
Rotas para obter posições consolidadas (Holdings) e posições anuais (Yearly Holdings).
"""

from typing import List, Dict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, Transaction, Ticker
from app.schemas import Holding

router = APIRouter(prefix="", tags=["Holdings"])


def calculate_holdings(transactions: List[Transaction], tickers_metadata: Dict[str, dict]) -> List[Holding]:
    """Calcula o preço médio e custo total das transações de forma cronológica."""
    holdings_dict = {}
    
    # Prioridade para operações no mesmo dia: Comprar/Recompensa (1) -> Desdobramento (2) -> Grupamento (2) -> Incorporacao (3) -> Vender (4)
    def tx_priority(tx: Transaction):
        p = {'comprar': 1, 'recompensa': 1, 'desdobramento': 2, 'grupamento': 2, 'incorporacao': 3, 'vender': 4}
        return p.get(tx.action.lower(), 5)

    sorted_txs = sorted(transactions, key=lambda x: (x.date, tx_priority(x)))
    
    for tx in sorted_txs:
        ticker = tx.ticker.upper().strip()
        qty = tx.quantity
        price = tx.price_per_share
        taxes = tx.taxes
        action = tx.action.lower()
        
        if ticker not in holdings_dict:
            category = "Ações"
            if tickers_metadata and ticker in tickers_metadata:
                category = tickers_metadata[ticker].get("category", "Ações")
            holdings_dict[ticker] = {"quantity": 0, "total_cost": 0, "category": category}
            
        if action in ["comprar", "recompensa"]:
            holdings_dict[ticker]["quantity"] += qty
            holdings_dict[ticker]["total_cost"] += (qty * price) + taxes
        elif action == "vender":
            # Usar tolerância para evitar resíduos de ponto flutuante
            if (qty - holdings_dict[ticker]["quantity"]) > 1e-10:
                avg_price = holdings_dict[ticker]["total_cost"] / holdings_dict[ticker]["quantity"] if holdings_dict[ticker]["quantity"] > 0 else price
            else:
                avg_price = holdings_dict[ticker]["total_cost"] / holdings_dict[ticker]["quantity"] if holdings_dict[ticker]["quantity"] > 0 else price
            
            holdings_dict[ticker]["quantity"] -= qty
            
            # Se zerou ou ficou negativo (devido a imprecisão), zera o custo
            if holdings_dict[ticker]["quantity"] <= 1e-10:
                holdings_dict[ticker]["quantity"] = 0
                holdings_dict[ticker]["total_cost"] = 0
            else:
                holdings_dict[ticker]["total_cost"] = holdings_dict[ticker]["quantity"] * avg_price

        elif action == "desdobramento":
            holdings_dict[ticker]["quantity"] *= qty
        elif action == "grupamento":
            if qty > 0:
                holdings_dict[ticker]["quantity"] /= qty
        elif action == "incorporacao":
            ticker_dest = tx.ticker_destino.upper().strip() if tx.ticker_destino else ""
            factor = tx.fator_conversao or qty
            
            if ticker_dest:
                if ticker_dest not in holdings_dict:
                    category = "Ações"
                    if tickers_metadata and ticker_dest in tickers_metadata:
                        category = tickers_metadata[ticker_dest].get("category", "Ações")
                    holdings_dict[ticker_dest] = {"quantity": 0, "total_cost": 0, "category": category}
                
                old_qty = holdings_dict[ticker]["quantity"]
                old_cost = holdings_dict[ticker]["total_cost"]
                
                # Transfere o custo total e calcula quantidade proporcional
                holdings_dict[ticker_dest]["quantity"] += (old_qty * factor)
                holdings_dict[ticker_dest]["total_cost"] += old_cost
                
                holdings_dict[ticker]["quantity"] = 0
                holdings_dict[ticker]["total_cost"] = 0
                
    results = []
    for ticker, values in holdings_dict.items():
        qty = round(values["quantity"], 10)
        if abs(qty) < 1e-10:
            qty = 0
        
        cost = round(values["total_cost"], 2)
        if qty == 0:
            cost = 0
            
        avg_p = cost / qty if qty > 0 else 0
        results.append(Holding(
            ticker=ticker, 
            category=values["category"], 
            quantity=qty, 
            average_price=round(avg_p, 4), 
            total_invested=cost
        ))
    return results


@router.get("/api/holdings", response_model=List[Holding])
def get_holdings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calcula a carteira atual de investimentos do usuário."""
    transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    tickers = db.query(Ticker).filter(Ticker.user_id == current_user.id).all()
    tickers_metadata = {t.code.upper(): {"category": t.category} for t in tickers}
    
    return calculate_holdings(transactions, tickers_metadata)


@router.get("/api/yearly-holdings")
def get_yearly_holdings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calcula as posições anuais da carteira (posição fechada em 31/12 de cada ano)."""
    transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    tickers = db.query(Ticker).filter(Ticker.user_id == current_user.id).all()
    tickers_metadata = {t.code.upper(): {"category": t.category} for t in tickers}
    
    if not transactions:
        return []
        
    all_years = sorted(list(set([tx.date[:4] for tx in transactions])))
    results = {}
    
    all_tickers_codes = sorted(list(set([tx.ticker.upper().strip() for tx in transactions])))
    for ticker in all_tickers_codes:
        results[ticker] = {"ticker": ticker, "years": {}}
        
    for year in all_years:
        end_date = f"{year}-12-31"
        year_txs = [tx for tx in transactions if tx.date <= end_date]
        holdings = calculate_holdings(year_txs, tickers_metadata)
        
        for h in holdings:
            results[h.ticker]["years"][year] = {
                "quantity": h.quantity,
                "value": h.total_invested,
                "category": h.category
            }
            
    return list(results.values())
