# -*- coding: utf-8 -*-
"""
Rotas para obter posições consolidadas (Holdings) e posições anuais (Yearly Holdings).
"""

import calendar
from datetime import date
from typing import List, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, Transaction, Ticker
from app.schemas import Holding

router = APIRouter(prefix="", tags=["Holdings"])


def calculate_holdings(transactions: List[Transaction], tickers_metadata: Dict[str, dict]) -> List[Holding]:
    """Calcula o preço médio, custo total e histórico de alienação das transações de forma cronológica."""
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
            meta = tickers_metadata.get(ticker, {}) if tickers_metadata else {}
            holdings_dict[ticker] = {
                "quantity": 0.0,
                "total_cost": 0.0,
                "category": meta.get("category", "Ações"),
                "name": meta.get("name", ticker),
                "cnpj": meta.get("cnpj", ""),
                "razao_social": meta.get("razao_social", ""),
                "last_avg_price": 0.0,
                "last_alienation_date": None,
                "total_bought_quantity": 0.0,
                "total_sold_quantity": 0.0
            }
            
        if action in ["comprar", "recompensa"]:
            holdings_dict[ticker]["quantity"] += qty
            holdings_dict[ticker]["total_cost"] += (qty * price) + taxes
            holdings_dict[ticker]["total_bought_quantity"] += qty
            holdings_dict[ticker]["last_avg_price"] = (
                holdings_dict[ticker]["total_cost"] / holdings_dict[ticker]["quantity"]
                if holdings_dict[ticker]["quantity"] > 0 else price
            )
            holdings_dict[ticker]["last_alienation_date"] = None
        elif action == "vender":
            current_qty = holdings_dict[ticker]["quantity"]
            avg_price = (
                holdings_dict[ticker]["total_cost"] / current_qty
                if current_qty > 0 else (holdings_dict[ticker]["last_avg_price"] or price)
            )
            holdings_dict[ticker]["last_avg_price"] = avg_price
            holdings_dict[ticker]["quantity"] -= qty
            holdings_dict[ticker]["total_sold_quantity"] += qty
            
            # Se zerou ou ficou negativo (devido a resíduo/tolerância), zera o custo e marca a data da alienação
            if holdings_dict[ticker]["quantity"] <= 1e-10:
                holdings_dict[ticker]["quantity"] = 0.0
                holdings_dict[ticker]["total_cost"] = 0.0
                holdings_dict[ticker]["last_alienation_date"] = tx.date
            else:
                holdings_dict[ticker]["total_cost"] = holdings_dict[ticker]["quantity"] * avg_price

        elif action == "desdobramento":
            holdings_dict[ticker]["quantity"] *= qty
            if holdings_dict[ticker]["quantity"] > 0:
                holdings_dict[ticker]["last_avg_price"] = (
                    holdings_dict[ticker]["total_cost"] / holdings_dict[ticker]["quantity"]
                )
            elif qty > 0 and holdings_dict[ticker]["last_avg_price"]:
                holdings_dict[ticker]["last_avg_price"] /= qty

        elif action == "grupamento":
            if qty > 0:
                holdings_dict[ticker]["quantity"] /= qty
                if holdings_dict[ticker]["quantity"] > 0:
                    holdings_dict[ticker]["last_avg_price"] = (
                        holdings_dict[ticker]["total_cost"] / holdings_dict[ticker]["quantity"]
                    )
                elif holdings_dict[ticker]["last_avg_price"]:
                    holdings_dict[ticker]["last_avg_price"] *= qty

        elif action == "incorporacao":
            ticker_dest = tx.ticker_destino.upper().strip() if tx.ticker_destino else ""
            factor = tx.fator_conversao or qty
            
            if ticker_dest:
                if ticker_dest not in holdings_dict:
                    meta_dest = tickers_metadata.get(ticker_dest, {}) if tickers_metadata else {}
                    holdings_dict[ticker_dest] = {
                        "quantity": 0.0,
                        "total_cost": 0.0,
                        "category": meta_dest.get("category", "Ações"),
                        "name": meta_dest.get("name", ticker_dest),
                        "cnpj": meta_dest.get("cnpj", ""),
                        "razao_social": meta_dest.get("razao_social", ""),
                        "last_avg_price": 0.0,
                        "last_alienation_date": None,
                        "total_bought_quantity": 0.0,
                        "total_sold_quantity": 0.0
                    }
                
                old_qty = holdings_dict[ticker]["quantity"]
                old_cost = holdings_dict[ticker]["total_cost"]
                avg_price = (
                    old_cost / old_qty
                    if old_qty > 0 else (holdings_dict[ticker]["last_avg_price"] or price)
                )
                holdings_dict[ticker]["last_avg_price"] = avg_price
                
                # Transfere o custo total e calcula quantidade proporcional
                holdings_dict[ticker_dest]["quantity"] += (old_qty * factor)
                holdings_dict[ticker_dest]["total_cost"] += old_cost
                if holdings_dict[ticker_dest]["quantity"] > 0:
                    holdings_dict[ticker_dest]["last_avg_price"] = (
                        holdings_dict[ticker_dest]["total_cost"] / holdings_dict[ticker_dest]["quantity"]
                    )
                holdings_dict[ticker_dest]["last_alienation_date"] = None
                
                holdings_dict[ticker]["quantity"] = 0.0
                holdings_dict[ticker]["total_cost"] = 0.0
                holdings_dict[ticker]["last_alienation_date"] = tx.date
                
    results = []
    for ticker, values in holdings_dict.items():
        qty = round(values["quantity"], 10)
        if abs(qty) < 1e-10:
            qty = 0.0
        
        cost = round(values["total_cost"], 2)
        if qty == 0:
            cost = 0.0
            
        avg_p = (cost / qty) if qty > 0 else values.get("last_avg_price", 0.0)
        is_alienated = (qty == 0.0)
        
        results.append(Holding(
            ticker=ticker, 
            category=values["category"], 
            name=values.get("name") or ticker,
            cnpj=values.get("cnpj") or "",
            razao_social=values.get("razao_social") or "",
            quantity=qty, 
            average_price=round(avg_p, 4), 
            total_invested=cost,
            is_alienated=is_alienated,
            last_alienation_date=values.get("last_alienation_date"),
            last_avg_price=round(values.get("last_avg_price", 0.0), 4),
            total_bought_quantity=round(values.get("total_bought_quantity", 0.0), 6),
            total_sold_quantity=round(values.get("total_sold_quantity", 0.0), 6)
        ))
    return results


@router.get("/api/holdings", response_model=List[Holding])
def get_holdings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calcula a carteira atual de investimentos do usuário, incluindo posições em aberto e alienadas."""
    transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    tickers = db.query(Ticker).filter(Ticker.user_id == current_user.id).all()
    tickers_metadata = {
        t.code.upper(): {
            "category": t.category,
            "name": t.name,
            "cnpj": t.cnpj,
            "razao_social": t.razao_social or t.name
        } for t in tickers
    }
    
    return calculate_holdings(transactions, tickers_metadata)


@router.get("/api/yearly-holdings")
def get_yearly_holdings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calcula as posições anuais da carteira (posição fechada em 31/12 de cada ano)."""
    transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    tickers = db.query(Ticker).filter(Ticker.user_id == current_user.id).all()
    tickers_metadata = {
        t.code.upper(): {
            "category": t.category,
            "name": t.name,
            "cnpj": t.cnpj,
            "razao_social": t.razao_social or t.name
        } for t in tickers
    }
    
    if not transactions:
        return []
        
    all_years = sorted(list(set([tx.date[:4] for tx in transactions])))
    results = {}
    
    all_tickers_codes = sorted(list(set([tx.ticker.upper().strip() for tx in transactions])))
    for ticker in all_tickers_codes:
        meta = tickers_metadata.get(ticker, {})
        results[ticker] = {
            "ticker": ticker,
            "name": meta.get("name", ticker),
            "cnpj": meta.get("cnpj", ""),
            "razao_social": meta.get("razao_social", ""),
            "category": meta.get("category", "Ações"),
            "years": {}
        }
        
    for year in all_years:
        end_date = f"{year}-12-31"
        year_txs = [tx for tx in transactions if tx.date <= end_date]
        holdings = calculate_holdings(year_txs, tickers_metadata)
        
        for h in holdings:
            results[h.ticker]["years"][year] = {
                "quantity": h.quantity,
                "value": h.total_invested,
                "average_price": h.average_price,
                "last_avg_price": h.last_avg_price,
                "category": h.category,
                "is_alienated": h.is_alienated,
                "last_alienation_date": h.last_alienation_date
            }
            
    return list(results.values())

@router.get("/api/monthly-holdings")
def get_monthly_holdings(
    year: int,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Calcula snapshots mensais reais da carteira pelo custo de aquisição.

    Cada ponto representa a posição acumulada no último dia de cada mês,
    aplicando as mesmas regras de compras, vendas e eventos corporativos
    usadas em /api/holdings e /api/yearly-holdings.

    Para o ano corrente, retorna somente até o mês atual. Anos encerrados
    retornam janeiro a dezembro. O filtro opcional ``category`` usa a
    categoria cadastrada nos metadados do ticker.
    """
    today = date.today()

    if year < 1900 or year > today.year:
        raise HTTPException(
            status_code=400,
            detail=f"Ano inválido. Informe um ano entre 1900 e {today.year}."
        )

    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).all()
    tickers = db.query(Ticker).filter(Ticker.user_id == current_user.id).all()

    tickers_metadata = {
        t.code.upper(): {
            "category": t.category,
            "name": t.name,
            "cnpj": t.cnpj,
            "razao_social": t.razao_social or t.name
        } for t in tickers
    }

    category_filter = category.strip() if category else None
    category_filter_key = category_filter.casefold() if category_filter else None

    last_month = today.month if year == today.year else 12
    monthly_results = []

    for month in range(1, last_month + 1):
        last_day = calendar.monthrange(year, month)[1]
        end_date = f"{year:04d}-{month:02d}-{last_day:02d}"

        snapshot_transactions = [
            tx for tx in transactions
            if tx.date <= end_date
        ]
        holdings = calculate_holdings(snapshot_transactions, tickers_metadata)

        active_holdings = []
        for holding in holdings:
            if holding.quantity <= 0:
                continue

            if category_filter_key and (
                (holding.category or "").strip().casefold() != category_filter_key
            ):
                continue

            active_holdings.append(holding)

        total = round(
            sum(h.total_invested or 0.0 for h in active_holdings),
            2
        )

        monthly_results.append({
            "year": year,
            "month": month,
            "date": end_date,
            "total": total,
            "assetsCount": len(active_holdings),
            "category": category_filter if category_filter else "ALL"
        })

    return monthly_results

