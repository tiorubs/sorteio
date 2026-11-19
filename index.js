import http from "node:http";

// ---- federal-pedras.ts (JS puro, sem deps) ----
const FEDERAL_PRIMARIA_URL = "https://api.guidi.dev.br/loteria/federal/ultimo";
const FEDERAL_FALLBACK_URL =
  "https://raw.githubusercontent.com/maickon/free-apiloterias/refs/heads/master/database/federal/_ultimo.json";

const GRUPOS_PADRAO = [600, 900, 1200, 2200];

function normalizarBilhete(valor) {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (!/^\d{5,6}$/.test(digitos)) {
    throw new Error(`Bilhete federal inválido: ${JSON.stringify(valor)}`);
  }
  return digitos;
}

function normalizarRespostaFederal(data) {
  const payload = data;
  const concurso = Number(payload.numero);
  if (!Number.isInteger(concurso) || concurso <= 0) {
    throw new Error("Resposta sem número de concurso válido");
  }
  if (!Array.isArray(payload.listaDezenas) || payload.listaDezenas.length < 5) {
    throw new Error("Resposta sem listaDezenas com ao menos 5 bilhetes");
  }
  const bilhetes = payload.listaDezenas.slice(0, 5).map(normalizarBilhete);
  return {
    concurso,
    dataApuracao: String(payload.dataApuracao ?? ""),
    bilhetes,
  };
}

async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchUltimoFederal(timeoutMs = 10_000) {
  let ultimoErro;
  for (const url of [FEDERAL_PRIMARIA_URL, FEDERAL_FALLBACK_URL]) {
    try {
      return normalizarRespostaFederal(await fetchJson(url, timeoutMs));
    } catch (err) {
      ultimoErro = err;
    }
  }
  throw new Error(
    `Falha nas duas fontes da Federal: ${ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro)}`,
  );
}

function extrairJanelasTrasParaFrente(bilhete, tamanho) {
  const digitos = bilhete.replace(/\D/g, "");
  if (digitos.length < tamanho) return [];
  const janelas = [];
  for (let inicio = digitos.length - tamanho; inicio >= 0; inicio--) {
    janelas.push(Number.parseInt(digitos.slice(inicio, inicio + tamanho), 10));
  }
  return janelas;
}

function pedrasDoBilhete(bilhete, tamanhoGrupo) {
  if (!Number.isInteger(tamanhoGrupo) || tamanhoGrupo <= 0) {
    throw new Error(`Tamanho de grupo inválido: ${tamanhoGrupo}`);
  }
  const digitos = normalizarBilhete(bilhete);
  if (tamanhoGrupo < 1000) {
    return extrairJanelasTrasParaFrente(digitos, 3).filter(
      (pedra) => pedra <= tamanhoGrupo,
    );
  }
  return extrairJanelasTrasParaFrente(digitos, 4).map(
    (janela) => janela % tamanhoGrupo,
  );
}

function pedrasPorGrupo(bilhetes, tamanhoGrupo) {
  return bilhetes
    .slice(0, 5)
    .flatMap((bilhete) => pedrasDoBilhete(bilhete, tamanhoGrupo));
}

// ---- public/index.html embutido ----
const INDEX_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Resultados Sorteios Consórcio · Loteria Federal</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%230e3b2c'/%3E%3Ccircle cx='16' cy='16' r='9' fill='none' stroke='%23c9a23c' stroke-width='2'/%3E%3C/svg%3E" />
  <style>
    :root {
      --paper: #f6f2e8;
      --card: #fffdf7;
      --ink: #1c1a15;
      --ink-soft: #4a463c;
      --muted: #8a8474;
      --line: #e2dac4;
      --green: #0e3b2c;
      --green-deep: #0a2c21;
      --brass: #9a7b2d;
      --brass-soft: #c9a23c;
      --danger: #8f1d1d;
      --danger-bg: #faf0ec;
      --serif: Georgia, "Times New Roman", serif;
      --sans: "Segoe UI", system-ui, -apple-system, sans-serif;
      --mono: "SF Mono", ui-monospace, Consolas, monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--sans);
      background: var(--paper);
      color: var(--ink);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .masthead {
      background: var(--green);
      color: #f3ecdb;
      border-bottom: 3px solid var(--brass-soft);
    }
    .masthead-inner {
      max-width: 760px;
      margin: 0 auto;
      padding: 2.6rem 1.25rem 2rem;
    }
    .eyebrow {
      margin: 0 0 0.6rem;
      font-size: 0.72rem;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--brass-soft);
    }
    .masthead h1 {
      font-family: var(--serif);
      font-weight: 400;
      font-size: 2.4rem;
      line-height: 1.1;
      margin: 0;
    }
    .masthead h1 em { font-style: italic; }
    .masthead .sub {
      margin: 0.7rem 0 0;
      font-size: 0.92rem;
      color: #cfc6ab;
    }
    main { max-width: 760px; margin: 0 auto; padding: 0 1.25rem 3rem; }
    .panel {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 4px;
      margin-top: -1.4rem;
      padding: 1.6rem 1.6rem 1.4rem;
      box-shadow: 0 2px 10px rgba(28, 26, 21, 0.07);
    }
    .panel label {
      display: block;
      font-size: 0.72rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 0.6rem;
    }
    .row { display: flex; gap: 0.6rem; }
    input {
      flex: 1;
      font-family: var(--serif);
      font-size: 1.5rem;
      padding: 0.55rem 0.8rem;
      color: var(--ink);
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 3px;
      outline: none;
      font-variant-numeric: tabular-nums;
    }
    input:focus { border-color: var(--brass); box-shadow: 0 0 0 2px rgba(154, 123, 45, 0.18); }
    button.action {
      font-family: var(--sans);
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.4px;
      color: #f7f2e3;
      background: var(--green);
      border: 1px solid var(--green-deep);
      border-radius: 3px;
      padding: 0 1.5rem;
      cursor: pointer;
      white-space: nowrap;
    }
    button.action:hover:not(:disabled) { background: var(--green-deep); }
    button.action:disabled { opacity: 0.6; cursor: wait; }
    .quick { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; margin-top: 1.1rem; }
    .quick span { font-size: 0.78rem; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); }
    .chip {
      font-family: var(--serif);
      font-size: 1rem;
      color: var(--green);
      background: transparent;
      border: 1px solid var(--brass);
      border-radius: 999px;
      padding: 0.25rem 1rem;
      cursor: pointer;
    }
    .chip:hover { background: var(--green); border-color: var(--green); color: #f3ecdb; }
    .chip small { font-family: var(--sans); font-size: 0.68rem; color: inherit; opacity: 0.65; margin-left: 0.3rem; }
    .history-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin: 2.2rem 0 0.2rem;
      padding-bottom: 0.6rem;
      border-bottom: 2px solid var(--ink);
    }
    .history-head h2 {
      font-family: var(--serif);
      font-weight: 400;
      font-style: italic;
      font-size: 1.35rem;
      margin: 0;
    }
    .history-head h2 b { font-style: normal; }
    button.clear {
      background: none;
      border: none;
      color: var(--muted);
      font-size: 0.82rem;
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;
      padding: 0;
    }
    button.clear:hover { color: var(--danger); }
    #historico { margin-top: 1.1rem; display: flex; flex-direction: column; gap: 1.1rem; }
    .empty {
      border: 1px dashed var(--line);
      border-radius: 4px;
      padding: 2.4rem 1rem;
      text-align: center;
      color: var(--muted);
      font-family: var(--serif);
      font-style: italic;
      font-size: 1.02rem;
      background: transparent;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-top: 3px solid var(--brass-soft);
      border-radius: 3px;
      padding: 1.3rem 1.5rem 1.4rem;
      box-shadow: 0 2px 10px rgba(28, 26, 21, 0.06);
      animation: fadeIn 0.3s ease-out;
    }
    .card.erro { border-top-color: var(--danger); }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; }
    .card-head h3 { font-family: var(--serif); font-weight: 400; font-size: 1.45rem; margin: 0; }
    .card-head h3 b { font-weight: 700; }
    .tally {
      font-size: 0.72rem;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--ink-soft);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 0.25rem 0.75rem;
      white-space: nowrap;
    }
    .dateline {
      margin: 0.45rem 0 0;
      font-size: 0.82rem;
      color: var(--muted);
    }
    .dateline strong { color: var(--ink-soft); font-weight: 600; }
    hr.rule { border: none; border-top: 1px solid var(--line); margin: 1rem 0; }
    .sorteados-label, .pedras-label {
      margin: 0 0 0.5rem;
      font-size: 0.7rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--muted);
    }
    .sorteados { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .sorteado {
      font-family: var(--mono);
      font-size: 0.92rem;
      letter-spacing: 2px;
      color: #f3ecdb;
      background: var(--ink);
      border-radius: 3px;
      padding: 0.35rem 0.65rem 0.35rem 0.8rem;
      font-variant-numeric: tabular-nums;
    }
    .board {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(4.4rem, 1fr));
      border: 1px solid var(--line);
      border-radius: 3px;
      overflow: hidden;
      background: #fff;
    }
    .board div {
      font-family: var(--serif);
      font-size: 1.35rem;
      text-align: center;
      padding: 0.55rem 0.25rem;
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      font-variant-numeric: tabular-nums;
    }
    .board div:nth-child(1) { background: #f3ecdb; font-weight: 700; }
    .card.erro p { margin: 0.4rem 0 0; color: var(--danger); font-size: 0.9rem; }
    footer {
      text-align: center;
      color: var(--muted);
      font-size: 0.75rem;
      letter-spacing: 0.5px;
      padding-bottom: 2.5rem;
    }
    footer .rule { width: 60px; border-top: 2px solid var(--brass-soft); margin: 0 auto 0.8rem; }
    @media (max-width: 560px) {
      .masthead h1 { font-size: 1.8rem; }
      .row { flex-direction: column; }
      button.action { padding: 0.8rem; }
    }
  </style>
</head>
<body>
  <div class="masthead">
    <div class="masthead-inner">
      <p class="eyebrow">Loteria Federal · Caixa Econômica Federal</p>
      <h1>Resultados <em>sorteios consórcio</em></h1>
      <p class="sub">Apuração oficial do último concurso — pedras por tamanho de grupo.</p>
    </div>
  </div>

  <main>
    <section class="panel">
      <label for="grupo">Tamanho do grupo</label>
      <form id="form">
        <div class="row">
          <input id="grupo" type="number" min="1" step="1" value="600" required />
          <button class="action" type="submit" id="buscar">Pedras sorteáveis</button>
        </div>
      </form>
      <div class="quick">
        <span>Grupos usuais — toque para apurar</span>
        <button type="button" class="chip" data-grupo="600">600</button>
        <button type="button" class="chip" data-grupo="900">900</button>
        <button type="button" class="chip" data-grupo="1200">1200</button>
        <button type="button" class="chip" data-grupo="2200">2200</button>
      </div>
    </section>

    <div class="history-head">
      <h2>Apurações <b id="count">0</b></h2>
      <button class="clear" type="button" id="limpar">limpar tudo</button>
    </div>
    <div id="historico">
      <div class="empty" id="vazio">Nenhuma apuração ainda — informe o grupo e peça as pedras sorteáveis.</div>
    </div>
  </main>

  <footer>
    <div class="rule"></div>
    Fonte: Caixa via guidi.dev.br (contingência GitHub) · atualização a cada 30 min
  </footer>

  <script>
    const form = document.getElementById("form");
    const grupoInput = document.getElementById("grupo");
    const buscarBtn = document.getElementById("buscar");
    const historico = document.getElementById("historico");
    const countEl = document.getElementById("count");
    let total = 0;

    document.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        grupoInput.value = chip.dataset.grupo;
        form.requestSubmit();
      });
    });

    document.getElementById("limpar").addEventListener("click", () => {
      historico.innerHTML = '<div class="empty" id="vazio">Nenhuma apuração ainda — informe o grupo e peça as pedras sorteáveis.</div>';
      total = 0;
      countEl.textContent = "0";
    });

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      }[c]));
    }

    function adicionarCard(html, isErro) {
      const vazio = document.getElementById("vazio");
      if (vazio) vazio.remove();
      const card = document.createElement("article");
      card.className = "card" + (isErro ? " erro" : "");
      card.innerHTML = html;
      historico.prepend(card);
      total += 1;
      countEl.textContent = String(total);
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const grupo = grupoInput.value.trim();
      if (!grupo) return;
      buscarBtn.disabled = true;
      const original = buscarBtn.textContent;
      buscarBtn.textContent = "Apurando...";
      try {
        const res = await fetch("/api/pedras?grupo=" + encodeURIComponent(grupo));
        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || ("HTTP " + res.status));
        const hora = new Date().toLocaleString("pt-BR");
        const pedras = data.pedras.length
          ? data.pedras.map((p) => "<div>" + escapeHtml(p) + "</div>").join("")
          : '<div style="grid-column:1/-1;padding:.6rem;color:#8a8474;font-family:sans-serif;font-size:.85rem">sem pedras para este grupo</div>';
        adicionarCard(
          '<div class="card-head"><h3>Grupo <b>' + escapeHtml(data.grupo) + "</b></h3>" +
          '<span class="tally">' + data.pedras.length + " pedras</span></div>" +
          '<p class="dateline">Concurso <strong>' + escapeHtml(data.concurso) + "</strong> · " +
          escapeHtml(data.dataApuracao) + " · apurado às " + escapeHtml(hora) + "</p>" +
          '<hr class="rule" />' +
          '<p class="sorteados-label">Bilhetes sorteados — 1º ao 5º prêmio</p>' +
          '<div class="sorteados">' +
          data.bilhetes.map((b) => '<span class="sorteado">' + escapeHtml(b) + "</span>").join("") +
          "</div>" +
          '<hr class="rule" />' +
          '<p class="pedras-label">Pedras sorteáveis</p>' +
          '<div class="board">' + pedras + "</div>",
          false,
        );
      } catch (err) {
        adicionarCard(
          "<h3>Grupo <b>" + escapeHtml(grupo) + "</b> — sem apuração</h3>" +
          "<p>" + escapeHtml(err.message) + "</p>",
          true,
        );
      } finally {
        buscarBtn.disabled = false;
        buscarBtn.textContent = original;
      }
    });
  </script>
</body>
</html>
`;

// ---- server.ts (portado de Bun para Node) ----
const PORT = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  throw new Error(`PORT inválida: ${process.env.PORT}`);
}

const CACHE_TTL_MS = 30 * 60 * 1000;
let cache = null;

async function obterSorteio() {
  if (cache && Date.now() - cache.obtidoEm < CACHE_TTL_MS) return cache.sorteio;
  const sorteio = await fetchUltimoFederal();
  cache = { sorteio, obtidoEm: Date.now() };
  return sorteio;
}

async function buscarPedrasUltimoSorteio(grupos = GRUPOS_PADRAO) {
  if (grupos.length === 0) throw new Error("Informe ao menos um grupo");
  const sorteio = await obterSorteio();
  const entries = grupos.map((grupo) => [
    grupo,
    pedrasPorGrupo(sorteio.bilhetes, grupo),
  ]);
  return { ...sorteio, pedrasPorGrupo: Object.fromEntries(entries) };
}

function parseGrupos(url) {
  const unico = url.searchParams.get("grupo");
  const varios = url.searchParams.get("grupos");
  const raw = unico ?? varios ?? GRUPOS_PADRAO.join(",");
  const grupos = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(grupos)];
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (url.pathname === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(INDEX_HTML);
      return;
    }

    if (url.pathname === "/api/pedras" && req.method === "GET") {
      const grupos = parseGrupos(url);
      if (grupos.length === 0) {
        sendJson(res, 400, {
          erro: "Informe um grupo válido, ex: /api/pedras?grupo=600",
        });
        return;
      }
      try {
        const sorteio = await obterSorteio();
        if (grupos.length === 1) {
          const grupo = grupos[0];
          sendJson(res, 200, {
            concurso: sorteio.concurso,
            dataApuracao: sorteio.dataApuracao,
            bilhetes: sorteio.bilhetes,
            grupo,
            pedras: pedrasPorGrupo(sorteio.bilhetes, grupo),
          });
          return;
        }
        const out = { ...(await buscarPedrasUltimoSorteio(grupos)) };
        sendJson(res, 200, out);
        return;
      } catch (err) {
        sendJson(res, 502, {
          erro: `Falha ao buscar o último sorteio: ${err instanceof Error ? err.message : String(err)}`,
        });
        return;
      }
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Não encontrado");
  } catch (err) {
    sendJson(res, 500, {
      erro: err instanceof Error ? err.message : String(err),
    });
  }
});

server.listen(PORT, () => {
  console.log(`Servidor no ar em http://localhost:${PORT}`);
});
