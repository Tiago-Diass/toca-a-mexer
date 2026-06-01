// ========== CONFIGURAÇÕES ==========
const DIFICULDADES = {
    facil: { bpm: 80, tempoSeta: 4000, nome: 'Electronic Chill — 80 BPM' },
    medio: { bpm: 120, tempoSeta: 3000, nome: 'Electronic Rush — 120 BPM' },
    dificil: { bpm: 160, tempoSeta: 2000, nome: 'Electronic Chaos — 160 BPM' }
};

const SETAS = ['↑', '↓', '←', '→'];
const DIRECOES = {
    '↑': 'cima',
    '↓': 'baixo',
    '←': 'esquerda',
    '→': 'direita'
};

// ========== ESTADO DO JOGO ==========
let pontos = 0;
let vidas = 3;
let filaSetaS = [];
let setaAtual = null;
let timerInterval = null;
let tempoRestante = 100;
let dificuldade = 'medio';
let config = DIFICULDADES['medio'];
let jogoAtivo = false;
let ultimaDirecao = null;
let bloqueado = false;

// ========== INICIALIZAÇÃO ==========
window.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    dificuldade = params.get('dificuldade') || 'medio';
    config = DIFICULDADES[dificuldade];

    document.getElementById('musica-nome').textContent = config.nome;

    await carregarModelos();
    await iniciarCamera();
    gerarFila();
    proximaSeta();
    detetarCabeca();
});

// ========== CARREGAR MODELOS FACE-API ==========
async function carregarModelos() {
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    console.log('Modelos carregados!');
}

// ========== CÂMARA ==========
async function iniciarCamera() {
    const video = document.getElementById('video');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    return new Promise(resolve => {
        video.onloadeddata = () => {
            video.play();
            resolve();
        };
    });
}

// ========== GERAR FILA DE SETAS ==========
function gerarFila() {
    filaSetaS = [];
    for (let i = 0; i < 5; i++) {
        filaSetaS.push(SETAS[Math.floor(Math.random() * SETAS.length)]);
    }
    atualizarProximas();
}

function atualizarProximas() {
    document.getElementById('prox-1').textContent = filaSetaS[0] || '';
    document.getElementById('prox-2').textContent = filaSetaS[1] || '';
}

// ========== PRÓXIMA SETA ==========
function proximaSeta() {
    jogoAtivo = true;
    bloqueado = false;
    ultimaDirecao = null;

    if (filaSetaS.length < 3) {
        for (let i = 0; i < 5; i++) {
            filaSetaS.push(SETAS[Math.floor(Math.random() * SETAS.length)]);
        }
    }

    setaAtual = filaSetaS.shift();
    atualizarProximas();
    document.getElementById('seta-atual').textContent = setaAtual;
    document.getElementById('seta-atual').style.color = '';
    document.getElementById('seta-atual').style.border = '2px solid #1d9e75';

    tempoRestante = 100;
    clearInterval(timerInterval);

    const intervalo = config.tempoSeta / 100;
    timerInterval = setInterval(() => {
        tempoRestante -= 1;
        document.getElementById('timer-fill').style.width = tempoRestante + '%';

        if (tempoRestante <= 30) {
            document.getElementById('timer-fill').style.background = '#e24b4a';
        } else {
            document.getElementById('timer-fill').style.background = '#1d9e75';
        }

        if (tempoRestante <= 0) {
            clearInterval(timerInterval);
            errou();
        }
    }, intervalo);
}

// ========== ACERTOU ==========
function acertou() {
    if (bloqueado) return;
    bloqueado = true;

    pontos += 10;
    document.getElementById('pontos-display').textContent = pontos;
    document.getElementById('seta-atual').style.color = '#5dcaa5';

    clearInterval(timerInterval);
    ultimaDirecao = null;

    setTimeout(() => {
        proximaSeta();
    }, 300);
}

// ========== ERROU ==========
function errou() {
    if (bloqueado) return;
    bloqueado = true;

    vidas--;
    atualizarVidas();
    document.getElementById('seta-atual').style.color = '#e24b4a';
    clearInterval(timerInterval);
    ultimaDirecao = null;

    setTimeout(() => {
        if (vidas <= 0) {
            gameOver();
        } else {
            proximaSeta();
        }
    }, 300);
}

// ========== ATUALIZAR VIDAS ==========
function atualizarVidas() {
    let display = '';
    for (let i = 0; i < 3; i++) {
        if (i < vidas) {
            display += '<span style="color:#e24b4a;">♥</span> ';
        } else {
            display += '<span style="color:#e24b4a; opacity:0.2;">♥</span> ';
        }
    }
    document.getElementById('vidas-display').innerHTML = display;
}

// ========== GAME OVER ==========
function gameOver() {
    jogoAtivo = false;
    clearInterval(timerInterval);
    document.getElementById('jogo').style.display = 'none';
    document.getElementById('gameover').style.display = 'flex';
    document.getElementById('pontos-finais').textContent = pontos;
}

// ========== VOLTAR AO MENU ==========
function voltarMenu() {
    window.location.href = 'index.html';
}

// ========== REINICIAR ==========
function reiniciar() {
    window.location.href = `game.html?dificuldade=${dificuldade}`;
}

// ========== DETEÇÃO DE CABEÇA ==========
async function detetarCabeca() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');

    await new Promise(resolve => {
        const check = setInterval(() => {
            if (video.videoWidth > 0) {
                clearInterval(check);
                resolve();
            }
        }, 100);
    });

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    async function loopProcessamento() {
        if (jogoAtivo && !bloqueado) {
            const detecao = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({
                    inputSize: 160,
                    scoreThreshold: 0.4
                }))
                .withFaceLandmarks();

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (detecao) {
                const direcao = calcularDirecao(detecao.landmarks);

                if (direcao && direcao !== ultimaDirecao) {
                    ultimaDirecao = direcao;
                    console.log('Direção detetada:', direcao, '| Precisa:', DIRECOES[setaAtual]);
                    if (setaAtual && DIRECOES[setaAtual] === direcao) {
                        acertou();
                    }
                }
            } else {
                console.log('Rosto não detetado');
            }
        }

        setTimeout(loopProcessamento, 40);
    }

    loopProcessamento();
}

// ========== CALCULAR DIREÇÃO DA CABEÇA ==========
function calcularDirecao(landmarks) {
    // 1. Ir buscar as listas oficiais de pontos estáveis (Nariz e Olhos)
    const narizArray = landmarks.getNose();
    const olhoEsqArray = landmarks.getLeftEye();
    const olhoDirArray = landmarks.getRightEye();

    // Segurança contra frames perdidos
    if (!narizArray || !olhoEsqArray || !olhoDirArray) return null;

    // 2. Usar o índice 0 (primeiro elemento do array) para extrair os pontos reais {x, y}
    const pontoNariz = narizArray[3]; // Ponta central do nariz
    const pontoOlhoEsq = olhoEsqArray[0]; // Canto externo esquerdo
    const pontoOlhoDir = olhoDirArray[3]; // Canto externo direito

    // 3. Calcular o ponto central exato entre os dois olhos
    const centroOlhos = {
        x: (pontoOlhoEsq.x + pontoOlhoDir.x) / 2,
        y: (pontoOlhoEsq.y + pontoOlhoDir.y) / 2
    };

    // 4. Distância proporcional dos olhos para calibrar o ecrã dinamicamente
    const distanciaOlhos = Math.abs(pontoOlhoEsq.x - pontoOlhoDir.x);

    // 5. Diferença entre o nariz e o centro estável do rosto
    const diffX = pontoNariz.x - centroOlhos.x;
    const diffY = pontoNariz.y - centroOlhos.y;

    // 6. Configurações de limiares suaves (Para não doer o pescoço)
    const limiarHorizontal = distanciaOlhos * 0.08;
    const limiarBaixo = distanciaOlhos * 0.16;   // Aumentado: impede que a seta para baixo dispare sozinha
    const limiarCima = distanciaOlhos * 0.02;    // Reduzido: basta levantar ligeiramente o queixo

    if (Math.abs(diffX) > Math.abs(diffY)) {
        // Correção do efeito espelho lateral
        if (diffX > limiarHorizontal) return 'esquerda';
        if (diffX < -limiarHorizontal) return 'direita';
    } else {
        // Lógica vertical livre de bugs
        if (diffY < -limiarCima) return 'cima';
        if (diffY > limiarBaixo) return 'baixo';
    }

    return null;
}
