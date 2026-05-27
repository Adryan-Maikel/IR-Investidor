# -*- coding: utf-8 -*-
"""
Script de migração de dados de data.json para o banco de dados SQLite modular.
Associa todos os dados existentes a um usuário padrão 'admin'.
"""

import json
import os
import shutil
from sqlalchemy.orm import Session

from app.database import engine, Base, SessionLocal
from app.models import User, Ticker, Transaction, DeclaredStatus, Whitelist, UserSettings
from app.security import get_password_hash


def migrate_data():
    db_path = "declarativo.db"
    json_path = "data.json"
    backup_path = "data.json.bak"
    
    # 1. Verifica se o arquivo está na raiz ou na pasta legacy
    if not os.path.exists(json_path) and os.path.exists(os.path.join("legacy", "data.json")):
        json_path = os.path.join("legacy", "data.json")
        backup_path = os.path.join("legacy", "data.json.bak")
        print(f"Usando arquivo de dados legado em: {json_path}")
    
    print("Iniciando migração de dados...")
    
    # 2. Cria as tabelas do banco se não existirem
    Base.metadata.create_all(bind=engine)
    print("Tabelas do banco de dados verificadas/criadas.")
    
    db: Session = SessionLocal()
    
    try:
        # 3. Garante o usuário padrão 'admin'
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            print("Criando usuário padrão 'admin'...")
            hashed_pw = get_password_hash("admin")
            admin_user = User(username="admin", hashed_pw=hashed_pw)
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            print("Usuário 'admin' criado com sucesso. Senha padrão: admin")
        else:
            print("Usuário 'admin' já existe. Pulando criação.")
            
        # 4. Verifica se o arquivo de dados existe
        if not os.path.exists(json_path):
            print("Arquivo de dados legado (data.json) não encontrado. Nada para migrar.")
            return
            
        # Cria backup do data.json para segurança
        if not os.path.exists(backup_path):
            shutil.copyfile(json_path, backup_path)
            print(f"Backup de segurança criado em '{backup_path}'.")
            
        # 4. Carrega o arquivo data.json
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # Se for uma lista plana legada, normaliza (idêntico ao load_data anterior)
        if isinstance(data, list):
            print("Detectado formato JSON legado de lista plana. Normalizando...")
            new_data = {"tickers": {}, "transactions": [], "settings": {"category_colors": {}}, "declared_status": {}, "whitelist": []}
            import uuid
            for tx in data:
                ticker = tx.get("ticker")
                if ticker and tx.get("company_name"):
                    new_data["tickers"][ticker] = {
                        "name": tx["company_name"],
                        "cnpj": tx.get("company_cnpj"),
                        "category": tx.get("company_category", "Ações")
                    }
                tx.pop("company_name", None); tx.pop("company_cnpj", None); tx.pop("company_category", None)
                if 'id' not in tx: tx['id'] = str(uuid.uuid4())
                new_data["transactions"].append(tx)
            data = new_data
            
        # 5. Migra os Tickers
        tickers_data = data.get("tickers", {})
        print(f"Migrando {len(tickers_data)} ativos (tickers)...")
        for code, meta in tickers_data.items():
            code_upper = code.upper().strip()
            existing_ticker = db.query(Ticker).filter(
                Ticker.user_id == admin_user.id,
                Ticker.code == code_upper
            ).first()
            
            if not existing_ticker:
                db_ticker = Ticker(
                    user_id=admin_user.id,
                    code=code_upper,
                    name=meta.get("name", ""),
                    cnpj=meta.get("cnpj"),
                    category=meta.get("category", "Ações"),
                    razao_social=meta.get("razao_social") or meta.get("name", "")
                )
                db.add(db_ticker)
                
        # 6. Migra as Transações
        transactions_data = data.get("transactions", [])
        print(f"Migrando {len(transactions_data)} transações...")
        for tx in transactions_data:
            tx_id = tx.get("id")
            if not tx_id:
                import uuid
                tx_id = str(uuid.uuid4())
                
            existing_tx = db.query(Transaction).filter(
                Transaction.id == tx_id
            ).first()
            
            if not existing_tx:
                db_tx = Transaction(
                    id=tx_id,
                    user_id=admin_user.id,
                    ticker=tx.get("ticker", "").upper().strip(),
                    action=tx.get("action", "Comprar"),
                    quantity=float(tx.get("quantity", 0)),
                    price_per_share=float(tx.get("price_per_share", 0)),
                    taxes=float(tx.get("taxes", 0)),
                    date=tx.get("date", ""),
                    ticker_destino=tx.get("ticker_destino").upper().strip() if tx.get("ticker_destino") else None,
                    fator_conversao=float(tx.get("fator_conversao")) if tx.get("fator_conversao") is not None else None
                )
                db.add(db_tx)
                
        # 7. Migra DeclaredStatus
        declared_statuses = data.get("declared_status", {})
        print(f"Migrando {len(declared_statuses)} status de declaração anual...")
        for key in declared_statuses.keys():
            try:
                parts = key.split(":")
                if len(parts) == 2:
                    ticker, year = parts[0].upper().strip(), parts[1].strip()
                    existing_status = db.query(DeclaredStatus).filter(
                        DeclaredStatus.user_id == admin_user.id,
                        DeclaredStatus.ticker == ticker,
                        DeclaredStatus.year == year
                    ).first()
                    
                    if not existing_status:
                        db_status = DeclaredStatus(
                            user_id=admin_user.id,
                            ticker=ticker,
                            year=year
                        )
                        db.add(db_status)
            except Exception as ex:
                print(f"Erro ao migrar status de declaração para chave {key}: {ex}")
                
        # 8. Migra Whitelist
        whitelist_data = data.get("whitelist", [])
        print(f"Migrando {len(whitelist_data)} itens na whitelist de inconsistências...")
        for ref_id in whitelist_data:
            existing_wl = db.query(Whitelist).filter(
                Whitelist.user_id == admin_user.id,
                Whitelist.ref_id == ref_id
            ).first()
            
            if not existing_wl:
                db_wl = Whitelist(
                    user_id=admin_user.id,
                    ref_id=ref_id
                )
                db.add(db_wl)
                
        # 9. Migra UserSettings
        settings_data = data.get("settings", {"category_colors": {}})
        print("Migrando configurações do usuário...")
        existing_settings = db.query(UserSettings).filter(
            UserSettings.user_id == admin_user.id
        ).first()
        
        if existing_settings:
            existing_settings.data = settings_data
        else:
            db_settings = UserSettings(
                user_id=admin_user.id,
                data=settings_data
            )
            db.add(db_settings)
            
        db.commit()
        print("Migração concluída com sucesso no SQLite!")
        
    except Exception as e:
        db.rollback()
        print(f"Erro fatal durante a migração: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    migrate_data()
