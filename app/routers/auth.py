# -*- coding: utf-8 -*-
"""
Rotas de autenticação (registro, login, perfil do usuário).
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, UserSettings
from app.schemas import UserCreate, UserLogin, UserResponse, UserChangePassword, Token
from app.security import verify_password, get_password_hash, create_access_token
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """Registra um novo usuário no sistema."""
    # Verifica se já existe um usuário com o mesmo nome
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este nome de usuário já está sendo utilizado.",
        )
        
    # Cria o novo usuário
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        hashed_pw=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Inicializa as configurações padrões do usuário
    default_settings = UserSettings(
        user_id=new_user.id,
        data={"category_colors": {}}
    )
    db.add(default_settings)
    db.commit()
    
    return new_user


@router.post("/login", response_model=Token)
def login_user(credentials: UserLogin, db: Session = Depends(get_db)):
    """Autentica o usuário e retorna o token de acesso JWT."""
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.hashed_pw):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nome de usuário ou senha incorretos.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Gera o token de acesso
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Retorna os dados do usuário autenticado atual."""
    return current_user


@router.post("/change-password")
def change_password(
    data: UserChangePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Altera a senha do usuário autenticado atual."""
    if not verify_password(data.old_password, current_user.hashed_pw):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha atual está incorreta."
        )
        
    current_user.hashed_pw = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Senha alterada com sucesso!"}
