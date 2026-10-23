# SpotCry Desktop (Node.js/Electron)

Aplicativo de reprodução de músicas local de alta performance reconstruído com Electron.
Focado em alta performance usando Web Technologies puras (HTML5, CSS, Vanilla JS) no frontend, e Node.js com SQLite no backend.

## Funcionalidades
- Interface super leve e responsiva
- Reprodução nativa via `<audio>` HTML5
- Scanner em background
- Extração de Capas e Tags Automáticas (ID3)
- Gestão de Playlists e Favoritos
- Banco de dados de altíssima performance (better-sqlite3)

## Desenvolvimento

1. **Instalar Dependências**
   Certifique-se de ter o Node.js instalado no Windows.
   ```cmd
   npm install
   ```

2. **Rodar em modo de Desenvolvimento**
   ```cmd
   npm start
   ```

## Compilação (.exe)

O `electron-builder` está configurado para gerar o instalador do Windows.
Para criar a build final (`SpotCry Setup 1.0.0.exe` e a versão portátil), execute o arquivo `Compilar_SpotCry.bat` ou rode no terminal:
```cmd
npm run build
```

O arquivo compilado estará disponível na pasta `dist/`.
