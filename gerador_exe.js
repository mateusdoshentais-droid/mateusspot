/**
 * Gerador de Executáveis (.EXE) - SpotCry Desktop
 * Interface CLI interativa e automatizada para compilar o SpotCry.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Cores para o terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

const PROJECT_DIR = __dirname;
const DIST_DIR = path.join(PROJECT_DIR, 'dist');
const BUILD_DIR = path.join(PROJECT_DIR, 'build');
const ICON_PATH = path.join(BUILD_DIR, 'icon.ico');

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[0f');
}

function showBanner() {
  console.log(`${colors.cyan}${colors.bright}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║               🛠️  GERADOR DE EXECUTÁVEL (.EXE)             ║');
  console.log('║                     SPOTCRY DESKTOP                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);
}

function checkEnvironment() {
  console.log(`${colors.yellow}🔍 Verificando integridade do projeto...${colors.reset}`);
  
  if (!fs.existsSync(path.join(PROJECT_DIR, 'node_modules'))) {
    console.log(`${colors.red}⚠️ Dependências não encontradas! Instalando...${colors.reset}`);
    try {
      execSync('npm install', { stdio: 'inherit', cwd: PROJECT_DIR });
      console.log(`${colors.green}✅ Dependências instaladas com sucesso!${colors.reset}\n`);
    } catch (e) {
      console.log(`${colors.red}❌ Falha ao instalar dependências: ${e.message}${colors.reset}`);
      return false;
    }
  }

  if (!fs.existsSync(ICON_PATH)) {
    console.log(`${colors.yellow}⚠️ Aviso: Ícone ${ICON_PATH} não encontrado. Usando ícone padrão.${colors.reset}`);
  } else {
    console.log(`${colors.green}✅ Ícone encontrado: build/icon.ico${colors.reset}`);
  }

  console.log(`${colors.green}✅ Ambiente pronto!${colors.reset}\n`);
  return true;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function listGeneratedFiles() {
  if (!fs.existsSync(DIST_DIR)) return;
  
  console.log(`\n${colors.cyan}📁 Arquivos gerados na pasta 'dist':${colors.reset}`);
  const files = fs.readdirSync(DIST_DIR);
  let found = false;

  for (const file of files) {
    const fullPath = path.join(DIST_DIR, file);
    const stat = fs.statSync(fullPath);
    if (stat.isFile() && file.endsWith('.exe')) {
      found = true;
      console.log(`  ${colors.green}✔ ${file}${colors.reset} (${colors.bright}${formatBytes(stat.size)}${colors.reset})`);
    }
  }

  if (!found) {
    console.log(`  ${colors.gray}(Nenhum arquivo .exe encontrado em dist)${colors.reset}`);
  }
}

function openDistFolder() {
  if (fs.existsSync(DIST_DIR)) {
    const cmd = process.platform === 'win32' ? `explorer "${DIST_DIR}"` : `open "${DIST_DIR}"`;
    try {
      execSync(cmd);
      console.log(`${colors.green}📂 Pasta 'dist' aberta com sucesso no Explorador de Arquivos!${colors.reset}`);
    } catch (err) {
      console.log(`${colors.red}Não foi possível abrir a pasta: ${err.message}${colors.reset}`);
    }
  } else {
    console.log(`${colors.yellow}A pasta 'dist' ainda não existe.${colors.reset}`);
  }
}

function cleanDist() {
  console.log(`${colors.yellow}🧹 Limpando compilações antigas em 'dist'...${colors.reset}`);
  if (fs.existsSync(DIST_DIR)) {
    try {
      fs.rmSync(DIST_DIR, { recursive: true, force: true });
      console.log(`${colors.green}✅ Pasta 'dist' limpa com sucesso!${colors.reset}\n`);
    } catch (e) {
      console.log(`${colors.red}⚠️ Não foi possível limpar 'dist' completamente (arquivos podem estar em uso): ${e.message}${colors.reset}\n`);
    }
  } else {
    console.log(`${colors.green}✅ Nada para limpar!${colors.reset}\n`);
  }
}

async function runBuild(targetArg, title) {
  return new Promise((resolve) => {
    console.log(`\n${colors.magenta}${colors.bright}🚀 Iniciando compilação: ${title}...${colors.reset}`);
    console.log(`${colors.gray}Comando: npx electron-builder ${targetArg}${colors.reset}\n`);

    const startTime = Date.now();
    const args = targetArg.split(' ').filter(Boolean);
    const buildProcess = spawn('npx.cmd', ['electron-builder', ...args], {
      cwd: PROJECT_DIR,
      stdio: 'inherit',
      shell: true
    });

    buildProcess.on('close', (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`\n${colors.green}${colors.bright}🎉 Compilação CONCLUÍDA com sucesso em ${elapsed}s!${colors.reset}`);
        listGeneratedFiles();
        openDistFolder();
      } else {
        console.log(`\n${colors.red}${colors.bright}❌ Erro na compilação! Código de saída: ${code}${colors.reset}`);
      }
      resolve();
    });

    buildProcess.on('error', (err) => {
      console.log(`\n${colors.red}❌ Erro ao executar electron-builder: ${err.message}${colors.reset}`);
      resolve();
    });
  });
}

function showMenu() {
  console.log(`${colors.bright}Escolha o tipo de executável para gerar:${colors.reset}\n`);
  console.log(`  ${colors.green}[1]${colors.reset} 📦 ${colors.bright}Completo (Instalador Setup.exe + Portátil .exe)${colors.reset}`);
  console.log(`  ${colors.cyan}[2]${colors.reset} 💾 ${colors.bright}Apenas Instalador (.exe NSIS - Cria atalhos no Desktop e Iniciar)${colors.reset}`);
  console.log(`  ${colors.yellow}[3]${colors.reset} 🚀 ${colors.bright}Apenas Portátil (.exe Standalone - Executa sem instalar)${colors.reset}`);
  console.log(`  ${colors.blue}[4]${colors.reset} ⚡ ${colors.bright}Versão Rápida Descompactada (win-unpacked - Teste imediato)${colors.reset}`);
  console.log(`  ${colors.magenta}[5]${colors.reset} 🧹 ${colors.bright}Limpar pasta 'dist' (remover versões antigas)${colors.reset}`);
  console.log(`  ${colors.cyan}[6]${colors.reset} 📂 ${colors.bright}Abrir pasta 'dist' no Windows Explorer${colors.reset}`);
  console.log(`  ${colors.gray}[7]${colors.reset} ▶️  ${colors.bright}Testar App no modo desenvolvedor (npm start)${colors.reset}`);
  console.log(`  ${colors.red}[0]${colors.reset} ❌ ${colors.bright}Sair${colors.reset}\n`);
}

async function main() {
  clearScreen();
  showBanner();
  
  if (!checkEnvironment()) {
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

  while (true) {
    showMenu();
    const answer = (await ask(`${colors.cyan}👉 Digite sua opção (0-7): ${colors.reset}`)).trim();

    switch (answer) {
      case '1':
        await runBuild('--win --x64', 'Instalador Setup + Portátil');
        break;
      case '2':
        await runBuild('--win nsis --x64', 'Instalador NSIS (.exe)');
        break;
      case '3':
        await runBuild('--win portable --x64', 'Executável Portátil (.exe)');
        break;
      case '4':
        await runBuild('--win dir --x64', 'Versão Descompactada (win-unpacked)');
        break;
      case '5':
        cleanDist();
        break;
      case '6':
        openDistFolder();
        break;
      case '7':
        console.log(`${colors.green}Iniciando SpotCry no modo desenvolvimento...${colors.reset}`);
        try {
          execSync('npm start', { stdio: 'inherit', cwd: PROJECT_DIR });
        } catch (e) {
          console.log(`${colors.red}Erro ao executar: ${e.message}${colors.reset}`);
        }
        break;
      case '0':
        console.log(`\n${colors.cyan}Até mais! 👋${colors.reset}\n`);
        rl.close();
        process.exit(0);
      default:
        console.log(`\n${colors.red}❌ Opção inválida! Tente novamente.${colors.reset}\n`);
        break;
    }

    console.log('\n' + colors.gray + '─'.repeat(60) + colors.reset + '\n');
  }
}

main().catch(console.error);
