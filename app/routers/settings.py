# -*- coding: utf-8 -*-
"""
Rotas para recuperar e atualizar as configurações visuais e preferências do usuário.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, UserSettings
from app.schemas import UserSettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("")
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna as configurações visuais do usuário autenticado atual."""
    # Garante que as configurações existam no banco
    if not current_user.settings:
        new_settings = UserSettings(
            user_id=current_user.id,
            data={"category_colors": {}}
        )
        db.add(new_settings)
        db.commit()
        db.refresh(current_user)
        
    return current_user.settings.data


@router.put("")
def update_settings(
    payload: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualiza as configurações visuais do usuário autenticado."""
    if not current_user.settings:
        new_settings = UserSettings(
            user_id=current_user.id,
            data=payload.data
        )
        db.add(new_settings)
    else:
        current_user.settings.data = payload.data
        
    db.commit()
    return {"message": "Configurações salvas!"}
