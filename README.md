# Hack Auth Server

## Deploy no Railway

1. Crie conta em railway.app
2. New Project > Deploy from GitHub repo (sobe só a pasta auth-server)
3. Add Plugin > PostgreSQL (Railway cria DATABASE_URL automaticamente)
4. Variables > adicione:
   - DISCORD_TOKEN = token do seu bot
   - DISCORD_WEBHOOK_URL = url do webhook para notificações
   - SECRET_KEY = qualquer string longa aleatória

## Onde colocar o Webhook

No arquivo `.env` (ou nas variáveis do Railway):

```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/SEU_ID/SEU_TOKEN
```

O webhook é usado para **notificações automáticas**:
- ✅ Login bem-sucedido
- 🔗 HWID vinculado pela primeira vez  
- ❌ Tentativa com HWID inválido

## Comandos do Bot

| Comando | Descrição |
|---------|-----------|
| `!criar <user> [dias]` | Cria usuário, envia senha por DM |
| `!desativar <user>` | Bloqueia acesso |
| `!ativar <user>` | Libera acesso |
| `!senha <user>` | Gera nova senha |
| `!reset-hwid <user>` | Reseta HWID vinculado |
| `!deletar <user>` | Remove usuário |
| `!info <user>` | Detalhes do usuário |
| `!listar` | Lista todos |

## Endpoint da API

```
POST https://sua-url.railway.app/auth/login
Body: { "username": "x", "password": "y", "hwid": "z" }
```
