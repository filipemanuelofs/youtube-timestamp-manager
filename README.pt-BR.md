# YouTube Timestamp Manager

[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)](https://github.com/filipemanuelofs/youtube-timestamp-manager)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Userscript](https://img.shields.io/badge/userscript-violentmonkey-orange.svg)](https://violentmonkey.github.io/)

> 🎯 Crie, gerencie e copie timestamps de vídeos do YouTube com anotações. Feito para aulas, tutoriais e lives.

<img width="300" height="140" alt="image" src="https://github.com/user-attachments/assets/ad11e324-f8fb-485e-8a07-731ae50c03d9" />

## ✨ Funcionalidades

- 📝 **Adicionar timestamps** com anotações próprias
- 🔗 **Copiar link individual** de um timestamp específico
- 📋 **Copiar a lista inteira** de timestamps
- ⛔ **Apagar timestamps** um a um
- ☑️ **Apagar em lote** - marque vários timestamps e remova todos de uma vez
- 📍 **Marcadores na barra de progresso** - cada timestamp vira um pino clicável no scrubber do vídeo
- 💾 **Salvamento automático** - os timestamps ficam guardados por vídeo e expiram em 30 dias
- 🔽 **Minimizar o painel** para não atrapalhar a experiência de assistir
- ⚡ **Navegação rápida** - clique no timestamp para pular para aquele momento
- 🎬 **Suporte completo** - YouTube, Lives, Shorts, Mobile e YouTube Music
- 🌙 **Interface elegante**, moderna e transparente

## 🚀 Instalação

### Pré-requisitos

- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Extensão de userscript instalada:
  - [Violentmonkey](https://violentmonkey.github.io/) (recomendada)
  - [Tampermonkey](https://www.tampermonkey.net/)
  - [Greasemonkey](https://www.greasespot.net/)
  - [Userscripts](https://github.com/quoid/userscripts) (Safari)

### Instalação do script

1. **Clique no link de instalação:**

   - [Youtube Timestamp Manager](https://github.com/filipemanuelofs/youtube-timestamp-manager/raw/main/youtube-timestamp-manager.user.js)

2. **Ou instale manualmente:**
   - Abra a extensão Violentmonkey
   - Clique no botão ➕
   - Cole o código de `youtube-timestamp-manager.user.js`
   - Salve (Ctrl+S)

## 📖 Como usar

### Interface do painel

O painel aparece sozinho no canto inferior esquerdo quando você abre um vídeo do YouTube. Ele começa minimizado — clique em 🔼 para expandir, ou desligue esse comportamento nas configurações.

### Controles do painel

| Botão/Ícone             | Função                                        |
| ----------------------- | --------------------------------------------- |
| **⚙️**                  | Abrir configurações                           |
| **🔽 / 🔼**             | Minimizar/restaurar o painel                  |
| **❌**                  | Fechar o painel (com confirmação)             |
| **📋**                  | Copiar um timestamp individual                |
| **⛔**                  | Apagar o timestamp (com confirmação)          |
| **Add Timestamp**       | Adicionar o tempo atual do vídeo              |
| **Copy Timestamps**     | Copiar todos os timestamps                    |
| **☑️ (na linha)**       | Marcar um timestamp para apagar em lote       |
| **☑️ (no cabeçalho)**   | Marcar ou desmarcar todos de uma vez          |
| **Delete Selected (N)** | Apagar os timestamps marcados (com confirmação) |

Os controles de seleção só aparecem quando a lista passa de 3 timestamps — abaixo disso, apagar um a um com ⛔ é mais rápido.

### Passo a passo

1. **Abra um vídeo do YouTube**

   - O painel aparece sozinho no canto inferior esquerdo

2. **Adicione timestamps:**

   - Clique em "Add Timestamp" no momento desejado
   - Digite uma anotação no campo de texto
   - Repita para adicionar mais timestamps

3. **Navegue pelos timestamps:**

   - Clique no tempo (ex.: 22:30) para pular para aquele momento

4. **Copie timestamps:**

   - **Individual:** clique no ícone 📋 ao lado do timestamp
   - **Lista inteira:** clique em "Copy Timestamps"

5. **Gerencie a lista:**
   - Apague um timestamp com o ícone ⛔
   - Passando de 3 timestamps, aparecem os checkboxes: marque os que quer remover e
     clique em "Delete Selected (N)". O checkbox do cabeçalho marca ou desmarca todos.
   - Minimize o painel com o botão 🔽

## ⚙️ Configurações

Os timestamps são salvos automaticamente por vídeo no `localStorage` do navegador, e
cada um expira 30 dias depois de criado. Clique em ⚙️ no cabeçalho do painel para
abrir as configurações:

| Configuração                               | Padrão   | O que faz                                                       |
| ------------------------------------------ | -------- | --------------------------------------------------------------- |
| **Automatically clean expired timestamps** | Desligado | Descarta timestamps com mais de 30 dias quando o vídeo carrega  |
| **Start widget minimized**                 | Ligado   | Abre o painel recolhido, mostrando só o cabeçalho               |

As duas ficam guardadas localmente e sobrevivem ao fechar o navegador.

### Sites suportados

- ✅ `youtube.com/watch` - vídeos comuns
- ✅ `youtube.com/live` - lives e transmissões
- ✅ `youtube.com/shorts` - YouTube Shorts
- ✅ `m.youtube.com` - YouTube Mobile
- ✅ `music.youtube.com` - YouTube Music

## 🔧 Desenvolvimento

### Como o projeto está organizado

O arquivo principal, que os usuários instalam, é o `youtube-timestamp-manager.user.js` na raiz. É um arquivo único e autocontido que roda direto no navegador — sem servidor, sem backend.

Dentro de `src/` fica a versão modular do mesmo código, quebrada em arquivos menores para facilitar o desenvolvimento. `npm run build` junta tudo de volta nesse arquivo da raiz, então `src/` e `youtube-timestamp-manager.user.js` devem sempre ser commitados juntos — nunca edite o arquivo da raiz à mão.

```
youtube-timestamp-manager.user.js   ← o que os usuários instalam (arquivo único)

src/
├── index.js            ← ponto de partida: detecta quando você abre/sai de um vídeo
├── state.js            ← guarda o vídeo atual e a referência do painel
├── lifecycle.js        ← cria ou remove o painel ao navegar entre páginas
├── ui.js               ← monta todos os elementos visíveis (painel, botões, lista)
├── handlers.js         ← responde às ações do usuário (adicionar, copiar, apagar)
├── progressMarkers.js  ← posiciona os marcadores clicáveis na barra de progresso
└── utils/
    ├── time.js         ← converte segundos em tempo legível (ex.: 1:23:45)
    ├── clipboard.js    ← cuida da cópia de texto para a área de transferência
    ├── storage.js      ← salva e carrega timestamps no navegador (localStorage)
    ├── notification.js ← mostra mensagens rápidas de sucesso/erro na tela
    ├── debounce.js     ← evita que ações disparem vezes demais seguidas
    └── video.js        ← encontra o elemento de vídeo e lê o ID do vídeo atual
```

**Como eles se conectam:** o `index.js` inicia tudo. Ao abrir um vídeo do YouTube, ele chama o `lifecycle.js` para montar o painel. O `ui.js` constrói a interface e liga os botões ao `handlers.js`. Ao adicionar um timestamp, o `handlers.js` salva pelo `storage.js` e avisa o `progressMarkers.js` para atualizar os marcadores da barra de progresso. Ao sair do vídeo, o `lifecycle.js` remove tudo e limpa o estado.

### Build

```bash
npm install       # instala as dependências de dev (esbuild, vitest)
npm run build     # empacota src/ → youtube-timestamp-manager.user.js (raiz do repo)
```

A linha `@version` no cabeçalho do userscript da raiz é a fonte única da versão — o
`build.js` lê esse valor de volta a cada build.

### Testes

```bash
npm test          # vitest + jsdom, execução única
npm run test:watch
```

Todo módulo de `src/` tem uma suíte: os helpers em `tests/utils/`, o resto em
`tests/*.test.js`.

### Contribuindo

1. Faça um fork do repositório
2. Crie um branch para a sua feature (`git checkout -b feature/nova-feature`)
3. Commite as mudanças (`git commit -am 'feat: descreva a mudança'`)
4. Faça push do branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 🐛 Solução de problemas

### O painel não aparece

- Confira se o Violentmonkey está ativo
- Confirme que você está em uma página do YouTube
- Recarregue a página (F5 ou CTRL+F5)

### O botão de copiar não funciona

- Confira as permissões de área de transferência do navegador
- Teste em uma aba HTTPS
- Use Ctrl+V para verificar se foi copiado

### Timestamps errados

- Espere o vídeo carregar por completo
- Veja se o vídeo não está em modo live
- Recarregue a página se precisar

### Os timestamps sumiram

- Timestamps expiram 30 dias depois de criados
- Com "Automatically clean expired timestamps" ligado, eles são descartados na
  próxima vez que você abrir o vídeo
- Ficam guardados no `localStorage` do navegador, então limpar os dados do site ou
  usar outro navegador/perfil perde tudo

## 🌐 Languages

- [English](README.md)
- [Português](README.pt-BR.md)

## ⚠️ Aviso

Este projeto é construído em cima do [ytlivestamper.js](https://github.com/Krazete/bookmarklets/blob/master/ytlivestamper.js), mas não tem relação com o autor original.

## 🤝 Suporte

- 📧 **Issues:** [GitHub Issues](https://github.com/filipemanuelofs/youtube-timestamp-manager/issues)
- 💬 **Discussões:** [GitHub Discussions](https://github.com/filipemanuelofs/youtube-timestamp-manager/discussions)
- ⭐ **Avaliação:** se você curtiu, deixe uma estrela no repositório!
</content>
</invoke>
