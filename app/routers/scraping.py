# -*- coding: utf-8 -*-
"""
Rotas para raspagem assíncrona de metadados de ativos (Ações, FIIs, BDRs, Cripto).
Utiliza httpx para evitar bloqueio do loop de eventos do FastAPI e implementa cache em memória.
"""

import time
import re
from typing import Optional, Dict
from fastapi import APIRouter, Depends
import httpx
from bs4 import BeautifulSoup

from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="", tags=["Scraping"])

# Cache simples em memória: {TICKER: (timestamp_criacao, dados_dict)}
SCRAPING_CACHE: Dict[str, tuple] = {}
CACHE_TTL = 3600  # 1 hora de cache


async def _fetch_crypto_info(ticker: str, client: httpx.AsyncClient) -> Optional[dict]:
    """Tenta obter informações sobre criptoativos via API do CoinGecko."""
    try:
        url = f"https://api.coingecko.com/api/v3/search?query={ticker}"
        r = await client.get(url, timeout=5.0)
        if r.status_code == 200:
            data = r.json()
            if data.get('coins'):
                # Busca match exato do símbolo
                match = next((c for c in data['coins'] if c['symbol'].upper() == ticker), None)
                if match:
                    return {
                        "name": match['name'].upper(),
                        "cnpj": "",
                        "category": "Cripto",
                        "razao_social": match['name'].upper()
                    }
    except Exception as e:
        print(f"Crypto fetch error: {e}")
    return None


async def _fetch_fii_info(ticker: str, headers: dict, category: str, client: httpx.AsyncClient) -> dict:
    """Obtém CNPJ e Razão Social de FIIs via Investidor10."""
    try:
        url = f"https://investidor10.com.br/fiis/{ticker.lower()}/"
        r = await client.get(url, headers=headers, timeout=10.0)
        
        if r.status_code != 200:
            return {"name": ticker, "cnpj": "", "category": category}
        
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # Extrair CNPJ
        cnpj = None
        cnpj_match = re.search(r'(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})', r.text)
        if cnpj_match:
            cnpj = cnpj_match.group(1)
        
        # Extrair Razão Social
        razao_social = None
        for span in soup.find_all(['span', 'div']):
            text = span.get_text(strip=True)
            if text.startswith('Razão Social') and len(text) > 15:
                raw = text.replace('Razão Social', '').strip()
                if 'CNPJ' in raw:
                    raw = raw.split('CNPJ')[0].strip()
                if raw:
                    razao_social = raw
                    break
        
        # Fallback de Regex
        if not razao_social:
            m1 = re.search(r'([A-ZÀ-Ú][A-ZÀ-Ú\s\-\.]+\s*-\s*FUNDO DE INVESTIMENTO IMOBILI[ÁA]RIO)', r.text)
            m2 = re.search(r'(FUNDO DE INVESTIMENTO IMOBILI[ÁA]RIO[^<"]{5,80})', r.text, re.I)
            if m1:
                razao_social = m1.group(1).strip()
            elif m2:
                razao_social = m2.group(1).strip()
        
        display_name = razao_social or ticker
        prefixes_to_remove = [
            r'\s*-?\s*FUNDO DE INVESTIMENTO IMOBILI[ÁA]RIO\s*',
            r'FUNDO DE INVESTIMENTO IMOBILI[ÁA]RIO\s*-?\s*',
            r'FDO\.?\s*INV\.?\s*IMOB\.?\s*',
            r'FII\s+',
        ]
        clean_name = display_name
        for prefix in prefixes_to_remove:
            clean_name = re.sub(prefix, '', clean_name, flags=re.I).strip()
        
        clean_name = clean_name.strip(' -.')
        
        if not clean_name:
            clean_name = ticker
            
        return {
            "name": clean_name.upper(),
            "cnpj": cnpj,
            "category": category,
            "razao_social": (razao_social or clean_name).upper()
        }
        
    except Exception as e:
        print(f"FII fetch error from investidor10: {e}")
        return {"name": ticker, "cnpj": "", "category": category}


@router.get("/api/fetch-ticker-info/{ticker}")
async def fetch_ticker_info(
    ticker: str,
    current_user: User = Depends(get_current_user)
):
    """
    Busca metadados detalhados de um ativo de forma assíncrona nos portais públicos.
    Resultados são cacheados localmente em memória por 1 hora.
    """
    ticker = ticker.upper().strip()
    
    # 1. Verifica cache em memória
    now = time.time()
    if ticker in SCRAPING_CACHE:
        timestamp, cached_data = SCRAPING_CACHE[ticker]
        if now - timestamp < CACHE_TTL:
            return cached_data

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    }
    
    async with httpx.AsyncClient() as client:
        try:
            # Etapa 0: Detecção de criptoativos populares
            crypto_res = await _fetch_crypto_info(ticker, client)
            if crypto_res:
                if ticker in ["BTC", "ETH", "USDT", "SOL", "AVAX", "USDC", "XRP", "ADA", "DOT", "LINK", "ARB", "MATIC", "OP"]:
                    SCRAPING_CACHE[ticker] = (now, crypto_res)
                    return crypto_res
            
            # Etapa 1: Busca de categoria no StatusInvest
            search_url = f"https://statusinvest.com.br/home/mainsearchquery?q={ticker}"
            r = await client.get(search_url, headers=headers, timeout=5.0)
            results = r.json()
            
            if not results:
                res = crypto_res if crypto_res else {"name": "", "cnpj": ""}
                SCRAPING_CACHE[ticker] = (now, res)
                return res
                
            match = next((item for item in results if item.get('code') == ticker), results[0])
            type_id = match.get('type', 1)
            
            display_map = {1: "Ações", 2: "FIIs", 12: "BDRs"}
            display_category = display_map.get(type_id, "Ações")
            
            # Etapa 2: Crawler específico para FIIs
            if type_id == 2:
                res = await _fetch_fii_info(ticker, headers, display_category, client)
                SCRAPING_CACHE[ticker] = (now, res)
                return res
            
            # Etapa 3: Crawler genérico para Ações e BDRs no StatusInvest
            company_name = match.get('name', '').upper()
            company_name = re.sub(rf'\b{ticker}\b', '', company_name, flags=re.I).strip()
            
            slug_map = {1: "acoes", 12: "bdrs"}
            category_slug = slug_map.get(type_id, "acoes")
            slug = match.get('url', f'/{category_slug}/{ticker.lower()}').lstrip('/')
            
            detail_url = f"https://statusinvest.com.br/{slug}"
            dr = await client.get(detail_url, headers=headers, timeout=5.0)
            
            cnpj = None
            cnpj_match = re.search(r'(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})', dr.text)
            if cnpj_match:
                cnpj = cnpj_match.group(1)
                
            res = {
                "name": company_name,
                "cnpj": cnpj,
                "category": display_category,
                "razao_social": company_name
            }
            SCRAPING_CACHE[ticker] = (now, res)
            return res
            
        except Exception as e:
            print(f"Scraping error: {e}")
            res = {"name": "", "cnpj": ""}
            SCRAPING_CACHE[ticker] = (now, res)
            return res
