// ========== CONFIGURAÇÕES ==========
const DIFICULDADES = {
    facil:   { bpm: 80,  tempoSeta: 4000, nome: 'Electronic Chill — 80 BPM' },
    medio:   { bpm: 120, tempoSeta: 3000, nome: 'Electronic Rush — 120 BPM' },
    dificil: { bpm: 160, tempoSeta: 2000, nome: 'Electronic Chaos — 160 BPM' }
};

const SETAS   = ['↑', '↓', '←', '→'];
const DIRECOES = { '↑': 'cima', '↓': 'baixo', '←': 'esquerda', '→': 'direita' };

// ========== ESTADO DO JOGO ==========
let pontos = 0, vidas = 3, filaSetaS = [], setaAtual = null;
let historicoSetas = [];
let timerInterval = null, tempoRestante = 100;
let dificuldade = 'medio', config = DIFICULDADES['medio'];
let jogoAtivo = false, ultimaDirecao = null, bloqueado = false;

// ========== ÁUDIO ==========
let audioCtx = null;
let musicaAtiva = false;
let beatInterval = null;
let oscillators = [];

function iniciarAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicaAtiva = true;
    tocarMusica(dificuldade);
}

function pararAudio() {
    musicaAtiva = false;
    clearInterval(beatInterval);
    oscillators.forEach(o => { try { o.stop(); } catch(e) {} });
    oscillators = [];
}

// --- Utilitários de síntese ---
function criarOscilador(tipo, freq, ganho, inicio, fim, destino) {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, inicio);
    gain.gain.setValueAtTime(ganho, inicio);
    gain.gain.exponentialRampToValueAtTime(0.0001, fim);
    osc.connect(gain);
    gain.connect(destino || audioCtx.destination);
    osc.start(inicio);
    osc.stop(fim);
    oscillators.push(osc);
}

// Kick drum sintético
function kick(t) {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    gain.gain.setValueAtTime(1.2, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.3);
    oscillators.push(osc);
}

// Snare sintético
function snare(t) {
    const bufferSize = audioCtx.sampleRate * 0.15;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 1000;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    noise.start(t); noise.stop(t + 0.2);
}

// Hi-hat sintético
function hihat(t, volume = 0.3) {
    const bufferSize = audioCtx.sampleRate * 0.05;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 7000;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    noise.start(t); noise.stop(t + 0.08);
}

// Nota de baixo
function bass(t, freq, dur) {
    criarOscilador('sawtooth', freq, 0.35, t, t + dur);
}

// Nota de synth
function synth(t, freq, dur, vol = 0.15) {
    criarOscilador('square', freq, vol, t, t + dur);
}

// ========== MÚSICAS POR DIFICULDADE ==========

function tocarMusica(dif) {
    if (!audioCtx) return;

    const bpm = DIFICULDADES[dif].bpm;
    const beat = 60 / bpm;      // duração de 1 beat em segundos
    const bar  = beat * 4;      // duração de 1 compasso (4 beats)

    if (dif === 'facil') tocarChill(beat, bar);
    else if (dif === 'medio') tocarRush(beat, bar);
    else tocarChaos(beat, bar);
}

// --- FÁCIL: Electronic Chill (80 BPM) ---
// Groove relaxado, baixo suave, poucos hi-hats
function tocarChill(beat, bar) {
    const notas = [65.41, 82.41, 98.00, 110.00]; // C2, E2, G2, A2
    const melNotas = [261.63, 329.63, 392.00, 440.00, 523.25]; // C4 D4 E4 G4 A4

    function loop() {
        if (!musicaAtiva) return;
        const t = audioCtx.currentTime;

        // Kick: beats 1 e 3
        kick(t);
        kick(t + beat * 2);

        // Snare: beat 3
        snare(t + beat * 2);

        // Hi-hats suaves nos beats
        for (let i = 0; i < 4; i++) hihat(t + beat * i, 0.18);

        // Baixo (groove simples)
        bass(t,            notas[0], beat * 1.8);
        bass(t + beat,     notas[1], beat * 0.8);
        bass(t + beat*2,   notas[2], beat * 1.8);
        bass(t + beat*3,   notas[0], beat * 0.8);

        // Melodia suave
        const mel = melNotas[Math.floor(Math.random() * melNotas.length)];
        synth(t + beat * 0.5, mel,       beat * 0.4, 0.08);
        synth(t + beat * 2.5, mel * 1.5, beat * 0.4, 0.08);

        beatInterval = setTimeout(loop, bar * 1000);
    }
    loop();
}

// --- MÉDIO: Electronic Rush (120 BPM) ---
// Clássico four-on-the-floor, bassline energética, synth lead
function tocarRush(beat, bar) {
    const bassNotas = [110.00, 138.59, 164.81, 146.83]; // A2 C#3 E3 D3
    const lead = [523.25, 659.25, 783.99, 880.00, 1046.50]; // C5 E5 G5 A5 C6

    function loop() {
        if (!musicaAtiva) return;
        const t = audioCtx.currentTime;

        // Four-on-the-floor kick
        for (let i = 0; i < 4; i++) kick(t + beat * i);

        // Snare beats 2 e 4
        snare(t + beat);
        snare(t + beat * 3);

        // Hi-hats em colcheias (a cada meio beat)
        for (let i = 0; i < 8; i++) hihat(t + beat * i * 0.5, 0.25);

        // Bassline energética
        bass(t,            bassNotas[0], beat * 0.9);
        bass(t + beat,     bassNotas[1], beat * 0.4);
        bass(t + beat*1.5, bassNotas[1], beat * 0.4);
        bass(t + beat*2,   bassNotas[2], beat * 0.9);
        bass(t + beat*3,   bassNotas[3], beat * 0.9);

        // Synth lead arpejado
        const l = lead[Math.floor(Math.random() * lead.length)];
        synth(t,            l,       beat * 0.45, 0.12);
        synth(t + beat,     l * 1.5, beat * 0.45, 0.10);
        synth(t + beat * 2, l,       beat * 0.45, 0.12);
        synth(t + beat * 3, l * 0.75,beat * 0.45, 0.10);

        beatInterval = setTimeout(loop, bar * 1000);
    }
    loop();
}

// --- DIFÍCIL: Electronic Chaos (160 BPM) ---
// Ritmo denso, kicks e snares duplos, bassline agressiva, synth frenético
function tocarChaos(beat, bar) {
    const bassNotas = [82.41, 110.00, 123.47, 164.81]; // E2 A2 B2 E3
    const lead = [1046.50, 1318.51, 1567.98, 1760.00];

    function loop() {
        if (!musicaAtiva) return;
        const t = audioCtx.currentTime;

        // Kicks duplos e agressivos
        kick(t);
        kick(t + beat * 0.5);
        kick(t + beat * 2);
        kick(t + beat * 2.75);

        // Snares
        snare(t + beat);
        snare(t + beat * 3);
        snare(t + beat * 3.5);

        // Hi-hats em semicolcheias
        for (let i = 0; i < 16; i++) hihat(t + beat * i * 0.25, 0.2);

        // Bassline agressiva
        bass(t,             bassNotas[0], beat * 0.4);
        bass(t + beat*0.5,  bassNotas[1], beat * 0.4);
        bass(t + beat,      bassNotas[2], beat * 0.9);
        bass(t + beat*2,    bassNotas[0], beat * 0.4);
        bass(t + beat*2.5,  bassNotas[3], beat * 0.4);
        bass(t + beat*3,    bassNotas[1], beat * 0.9);

        // Synth caótico
        for (let i = 0; i < 4; i++) {
            const l = lead[Math.floor(Math.random() * lead.length)];
            synth(t + beat * i * 0.9, l, beat * 0.2, 0.1);
        }

        beatInterval = setTimeout(loop, bar * 1000);
    }
    loop();
}

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

    // Iniciar áudio no primeiro toque (requisito dos browsers)
    document.addEventListener('click', function startAudio() {
        if (!audioCtx) iniciarAudio();
        document.removeEventListener('click', startAudio);
    }, { once: true });
    document.addEventListener('touchstart', function startAudioT() {
        if (!audioCtx) iniciarAudio();
        document.removeEventListener('touchstart', startAudioT);
    }, { once: true });
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
        video.onloadeddata = () => { video.play(); resolve(); };
    });
}

// ========== GERAR FILA DE SETAS ==========
function gerarFila() {
    filaSetaS = [];
    for (let i = 0; i < 5; i++) filaSetaS.push(SETAS[Math.floor(Math.random() * SETAS.length)]);
    atualizarProximas();
}

function atualizarProximas() {
    document.getElementById('prox-1').textContent = filaSetaS[0] || '';
    document.getElementById('prox-2').textContent = filaSetaS[1] || '';
}

// ========== PRÓXIMA SETA ==========
function proximaSeta() {
    jogoAtivo = true; bloqueado = false; ultimaDirecao = null;

    if (filaSetaS.length < 3) {
        for (let i = 0; i < 5; i++) filaSetaS.push(SETAS[Math.floor(Math.random() * SETAS.length)]);
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
        document.getElementById('timer-fill').style.background = tempoRestante <= 30 ? '#e24b4a' : '#1d9e75';
        if (tempoRestante <= 0) { clearInterval(timerInterval); errou(); }
    }, intervalo);
}

// ========== HISTÓRICO DE SETAS ==========
function adicionarHistorico(seta, acerto) {
    historicoSetas.push({ seta, acerto });
    if (historicoSetas.length > 6) historicoSetas.shift();

    const container = document.getElementById('historico-setas');
    container.innerHTML = '';
    historicoSetas.forEach(item => {
        const div = document.createElement('div');
        div.className = 'historico-seta ' + (item.acerto ? 'acerto' : 'erro');
        div.textContent = item.seta;
        container.appendChild(div);
    });
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
    adicionarHistorico(setaAtual, true);
    // Som de acerto
    if (audioCtx) {
        const t = audioCtx.currentTime;
        criarOscilador('sine', 880, 0.3, t, t + 0.1);
        criarOscilador('sine', 1320, 0.2, t + 0.08, t + 0.18);
    }
    setTimeout(() => { proximaSeta(); }, 300);
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
    adicionarHistorico(setaAtual, false);
    // Som de erro
    if (audioCtx) {
        const t = audioCtx.currentTime;
        criarOscilador('sawtooth', 150, 0.4, t, t + 0.3);
    }
    setTimeout(() => { vidas <= 0 ? gameOver() : proximaSeta(); }, 300);
}

// ========== ATUALIZAR VIDAS ==========
function atualizarVidas() {
    let display = '';
    for (let i = 0; i < 3; i++) {
        display += i < vidas
            ? '<span style="color:#e24b4a;">♥</span> '
            : '<span style="color:#e24b4a; opacity:0.2;">♥</span> ';
    }
    document.getElementById('vidas-display').innerHTML = display;
}

// ========== GAME OVER ==========
function gameOver() {
    jogoAtivo = false;
    clearInterval(timerInterval);
    pararAudio();
    document.getElementById('jogo').style.display = 'none';
    document.getElementById('gameover').style.display = 'flex';
    document.getElementById('pontos-finais').textContent = pontos;
}

// ========== VOLTAR AO MENU ==========
function voltarMenu() {
    pararAudio();
    window.location.href = 'index.html';
}

// ========== REINICIAR ==========
function reiniciar() {
    pararAudio();
    window.location.href = `game.html?dificuldade=${dificuldade}`;
}

// ========== DETEÇÃO DE CABEÇA ==========
async function detetarCabeca() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');

    await new Promise(resolve => {
        const check = setInterval(() => {
            if (video.videoWidth > 0) { clearInterval(check); resolve(); }
        }, 100);
    });

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    async function loopProcessamento() {
        if (jogoAtivo && !bloqueado) {
            const detecao = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.4 }))
                .withFaceLandmarks();

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (detecao) {
                const direcao = calcularDirecao(detecao.landmarks);
                if (direcao && direcao !== ultimaDirecao) {
                    ultimaDirecao = direcao;
                    if (setaAtual && DIRECOES[setaAtual] === direcao) acertou();
                }
            }
        }
        setTimeout(loopProcessamento, 40);
    }
    loopProcessamento();
}

// ========== CALCULAR DIREÇÃO DA CABEÇA ==========
function calcularDirecao(landmarks) {
    const narizArray   = landmarks.getNose();
    const olhoEsqArray = landmarks.getLeftEye();
    const olhoDirArray = landmarks.getRightEye();
    const queixoArray  = landmarks.getJawOutline();

    if (!narizArray || !olhoEsqArray || !olhoDirArray || !queixoArray) return null;

    const olhoEsq = olhoEsqArray[0];
    const olhoDir = olhoDirArray[3];
    const nariz   = narizArray[3];
    const queixo  = queixoArray[8];

    const centroOlhos = {
        x: (olhoEsq.x + olhoDir.x) / 2,
        y: (olhoEsq.y + olhoDir.y) / 2
    };

    const alturaRosto    = queixo.y - centroOlhos.y;
    const distanciaOlhos = Math.abs(olhoEsq.x - olhoDir.x);

    const diffX = -(nariz.x - centroOlhos.x);
    const ratioPosicaoNariz = (nariz.y - centroOlhos.y) / alturaRosto;
    const neutral = 0.40;
    const diffY = ratioPosicaoNariz - neutral;

    const limiarH     = distanciaOlhos * 0.10;
    const limiarCima  = 0.06;
    const limiarBaixo = 0.04;

    const movH = Math.abs(diffX);
    const movV = Math.abs(diffY) * distanciaOlhos;

    if (movV > movH * 0.5) {
        if (diffY < -limiarCima)  return 'cima';
        if (diffY > limiarBaixo)  return 'baixo';
    }

    if (diffX > limiarH)  return 'direita';
    if (diffX < -limiarH) return 'esquerda';

    return null;
}