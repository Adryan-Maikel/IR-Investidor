import json
import sqlite3

def verify_migration():
    # Load JSON
    with open(r"c:\Users\adrya\Documents\DeclarAtivo\data.json", "r", encoding="utf-8") as f:
        json_data = json.load(f)
    
    # Connect to SQLite
    conn = sqlite3.connect(r"c:\Users\adrya\Documents\DeclarAtivo\declarativo.db")
    cursor = conn.cursor()
    
    print("--- JSON ---")
    json_tickers = json_data.get("tickers", {})
    json_transactions = json_data.get("transactions", [])
    json_declared_statuses = json_data.get("declared_status", {})
    json_whitelists = json_data.get("whitelist", [])
    json_settings = json_data.get("settings", {})
    
    print("JSON Tickers:", len(json_tickers))
    print("JSON Transactions:", len(json_transactions))
    print("JSON Declared Statuses:", len(json_declared_statuses))
    print("JSON Whitelist:", len(json_whitelists))
    
    print("\n--- DB ---")
    cursor.execute("SELECT count(*) FROM tickers;")
    db_tickers = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM transactions;")
    db_transactions = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM declared_statuses;")
    db_declared_statuses = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM whitelists;")
    db_whitelists = cursor.fetchone()[0]
    
    print("DB Tickers:", db_tickers)
    print("DB Transactions:", db_transactions)
    print("DB Declared Statuses:", db_declared_statuses)
    print("DB Whitelist:", db_whitelists)
    
    # Check if there are missing transactions
    cursor.execute("SELECT id FROM transactions;")
    db_tx_ids = {r[0] for r in cursor.fetchall()}
    
    missing_txs = []
    for tx in json_transactions:
        tx_id = tx.get("id")
        if tx_id not in db_tx_ids:
            missing_txs.append(tx)
            
    print("\nMissing Transactions:", len(missing_txs))
    
    # Check if there are missing tickers
    cursor.execute("SELECT code FROM tickers;")
    db_ticker_codes = {r[0].upper().strip() for r in cursor.fetchall()}
    
    missing_tickers = []
    for code in json_tickers.keys():
        code_upper = code.upper().strip()
        if code_upper not in db_ticker_codes:
            missing_tickers.append(code)
            
    print("Missing Tickers:", len(missing_tickers))
    
    conn.close()

if __name__ == '__main__':
    verify_migration()
