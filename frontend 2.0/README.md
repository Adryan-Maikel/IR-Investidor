# DeclarAtivo 2.0 — frontend

Interface React/Vite com tema claro/escuro e paleta centralizada por tokens CSS.

## Navegação integrada

O antigo drawer lateral foi removido. Os módulos agora aparecem como uma barra de navegação horizontal logo abaixo do header:

- Dashboard
- Bens e Direitos
- Transações
- DARFs & Vendas
- IR Mensal
- FIIs & Fiagro
- Configurações

Ao selecionar uma opção, o conteúdo é renderizado na área de trabalho logo abaixo da barra. O Dashboard continua funcional; os demais módulos estão preparados como telas internas para receber suas implementações.

## Sincronização

O botão textual `Sincronizar` foi removido do Dashboard. A ação agora fica no header como um botão compacto apenas com o ícone de atualização. Ele dispara o mesmo recarregamento de dados do Dashboard e mostra o feedback existente por toast.

## Filtro de classes

A barra `Todas as Classes / Ações / ...` foi removida. A seleção por categoria continua disponível diretamente pelo gráfico de rosca; o comando `Limpar filtro` aparece quando uma categoria estiver selecionada.

## KPI

A classe `.kpi` usa a versão ajustada pelo usuário:

```css
.kpi {
  position: relative;
  overflow: hidden;
  padding: 10px 12px;
  border-left: 4px solid var(--theme-accent);
  border-radius: 14px;
  background: var(--theme-kpi-bg);
  transition: transform 160ms ease;
}
```

Os estilos internos de ícone e hover permanecem aninhados, sem substituir essas propriedades.

## Tema

Os principais tokens estão em `src/index.css`, usando a paleta:

- `#1E401D`
- `#192618`
- `#4D8C30`
- `#F2F2F2`
- `#0D0D0D`

## Histórico mensal

O drill-down anual/mensal continua consumindo:

```text
GET /api/monthly-holdings?year=2025
```

Com filtro opcional por categoria:

```text
GET /api/monthly-holdings?year=2025&category=Ações
```
