# ⏰🧠 Hora de Lembrar! — Multiplayer Competitivo

![Hora de Lembrar!](public/icons/logo-hora-de-lembrar.svg)

Bora testar essa memória? Jogo da memória multiplayer onde **quem termina primeiro ganha**!

## ✨ Features

- 🌐 **Multiplayer** (2-4 jogadores por sala)
- ⚡ **Competitivo** - cada jogador tem seu próprio tabuleiro
- 🏆 **Modos de jogo**: Rodada única ou Melhor de 3
- 🌙 **Tema escuro** moderno
- 🎬 **Animações GSAP**
- 📱 **Responsivo** (mobile-first, 4x5 grid)
- 📲 **PWA** - instalável no celular
- 🖼️ **Imagens personalizadas**

## 📁 Estrutura

```
memory-game/
├── server/              # Backend Node.js
│   ├── server.js
│   └── gameLogic.js
├── public/              # Frontend
│   ├── images/          # 👉 SUAS 10 IMAGENS AQUI
│   ├── icons/           # Ícones PWA
│   ├── css/
│   ├── js/
│   ├── index.html       # Login
│   ├── lobby.html       # Criar/entrar sala
│   ├── waiting.html     # Sala de espera
│   └── game.html        # Jogo
└── package.json
```

## 🚀 Como Rodar

### 1. Instalar dependências
```bash
npm install
```

### 2. Adicionar imagens
Coloque **10 imagens** em `public/images/` (formato `.webp` recomendado, 200x200px)

### 3. Iniciar servidor
```bash
npm start
```

### 4. Abrir no navegador
```
http://localhost:3000
```

## 🎯 Como Jogar

1. **Digite seu nome** na tela inicial
2. **Escolha o modo**: Rodada Única ou Melhor de 3
3. **Crie uma sala** ou entre com código de 4 letras
4. **Aguarde** outros jogadores (até 4)
5. **Host inicia** o jogo
6. **Encontre os pares** mais rápido que os outros!
7. Quem fizer mais pares primeiro 🏆 **vence**

## 🛠️ Tecnologias

- **Backend:** Node.js, Express, Socket.IO
- **Frontend:** HTML5, CSS3, JavaScript
- **Animações:** GSAP
- **PWA:** Service Worker, Manifest

## 📱 PWA

Para instalar no celular:
1. Abra no Chrome/Safari
2. Menu → "Adicionar à tela inicial"
3. Jogue offline! 🎮

## 🎨 Personalização

- **Imagens:** Substitua os arquivos em `public/images/`
- **Cores:** Edite as variáveis CSS em `public/css/style.css`
- **Animações:** Modifique `public/js/animations.js`

## 📝 Licença

MIT
