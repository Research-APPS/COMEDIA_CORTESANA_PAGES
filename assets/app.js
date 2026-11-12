(function () {
  const cfg = window.COMEDIA_PAGES_CONFIG || { password: "comedia26" };
  const CLAVE = "comedia-pages-ok";
  const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

  const gate = document.getElementById("gate");
  const app = document.getElementById("app");
  const formGate = document.getElementById("gateForm");
  const err = document.getElementById("gateError");

  function desbloquear() {
    gate.hidden = true;
    app.hidden = false;
    document.body.classList.remove("es-bloqueado");
    iniciarWiki();
  }

  if (sessionStorage.getItem(CLAVE) === "1") desbloquear();

  formGate.addEventListener("submit", (e) => {
    e.preventDefault();
    if (document.getElementById("gatePass").value === cfg.password) {
      sessionStorage.setItem(CLAVE, "1");
      err.textContent = "";
      desbloquear();
    } else {
      err.textContent = "Contraseña incorrecta.";
    }
  });

  let index = [];
  let facetas = {};
  let porIri = new Map();
  let activa = null;
  let letraActiva = "A";
  let filtros = {};

  function sinTildes(s) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function desbloquearUI() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("es-activa"));
        tab.classList.add("es-activa");
        const vista = tab.dataset.vista;
        document.getElementById("vistaBuscar").hidden = vista !== "buscar";
        document.getElementById("vistaIndice").hidden = vista !== "indice";
      });
    });
  }

  async function iniciarWiki() {
    desbloquearUI();
    let meta, idx, graph;
    try {
      [meta, idx, graph] = await Promise.all([
        fetch("data/meta.json").then((r) => (r.ok ? r.json() : null)),
        fetch("data/index.json").then((r) => r.json()),
        fetch("data/graph.jsonld").then((r) => r.json()),
      ]);
    } catch (e) {
      meta = idx = graph = null;
    }

    if (!idx || !graph) {
      document.getElementById("metaBar").innerHTML =
        "<strong>Sin datos.</strong> Ejecuta <code>python manage.py exportar_ontologia_pages</code>.";
      return;
    }

    index = idx.obras || [];
    facetas = idx.facetas || {};
    porIri = new Map((graph["@graph"] || []).map((n) => [n["@id"], n]));

    rellenarSelect("fAutor", facetas.autores);
    rellenarSelect("fTipo", mergeFacetas(facetas.tipos, facetas.generos));
    rellenarSelect("fFuente", facetas.fuentes);
    rellenarSelect("fLugar", facetas.lugares);
    rellenarSelect("fEspacio", mergeFacetas(facetas.espacios, facetas.categorias_lugar));
    rellenarSelect("fCompania", facetas.companias);
    rellenarSelect("fEstado", facetas.estados);

    const t = meta?.totales || {};
    document.getElementById("metaBar").innerHTML = [
      `<span class="chip"><strong>${t.obras ?? index.length}</strong> obras</span>`,
      `<span class="chip"><strong>${t.autores ?? "—"}</strong> autores</span>`,
      `<span class="chip"><strong>${t.lugares ?? "—"}</strong> lugares</span>`,
      `<span class="chip"><strong>${t.representaciones ?? "—"}</strong> representaciones</span>`,
      meta?.generado_en
        ? `<span>Export: ${new Date(meta.generado_en).toLocaleString("es-ES")}</span>`
        : "",
    ].join("");

    const form = document.getElementById("formBusqueda");
    let esperaFiltro = null;
    function aplicarFiltros(alMomento) {
      clearTimeout(esperaFiltro);
      const run = () => {
        filtros = leerFiltros();
        pintarResultados();
      };
      if (alMomento) run();
      else esperaFiltro = setTimeout(run, 180);
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      aplicarFiltros(true);
    });
    form.addEventListener("reset", () => {
      setTimeout(() => {
        filtros = {};
        pintarResultados();
      }, 0);
    });
    // Dinámico: cada cambio de filtro actualiza la lista (sin pulsar Buscar)
    form.addEventListener("input", (e) => {
      if (!e.target.matches("input, select, textarea")) return;
      aplicarFiltros(e.target.tagName === "SELECT");
    });
    form.addEventListener("change", (e) => {
      if (!e.target.matches("input, select, textarea")) return;
      aplicarFiltros(true);
    });

    montarLetras();
    filtros = {};
    pintarResultados();
    pintarIndice();
  }

  function mergeFacetas(a, b) {
    const mapa = {};
    [...(a || []), ...(b || [])].forEach((x) => {
      mapa[x.value] = (mapa[x.value] || 0) + x.n;
    });
    return Object.keys(mapa)
      .sort((x, y) => x.localeCompare(y, "es"))
      .map((value) => ({ value, n: mapa[value] }));
  }

  function rellenarSelect(id, items) {
    const sel = document.getElementById(id);
    if (!sel || !items) return;
    items.forEach(({ value, n }) => {
      if (!value) return;
      const op = document.createElement("option");
      op.value = value;
      op.textContent = n != null ? `${value} (${n})` : value;
      sel.append(op);
    });
  }

  function leerFiltros() {
    const g = (id) => (document.getElementById(id).value || "").trim();
    return {
      titulo: g("fTitulo"),
      autor: g("fAutor"),
      tipo: g("fTipo"),
      fuente: g("fFuente"),
      lugar: g("fLugar"),
      espacio: g("fEspacio"),
      compania: g("fCompania"),
      estado: g("fEstado"),
      musica: g("fMusica"),
      desde: parseInt(g("fDesde"), 10) || null,
      hasta: parseInt(g("fHasta"), 10) || null,
    };
  }

  function filtrar(lista, f) {
    const q = sinTildes(f.titulo || "");
    return lista.filter((o) => {
      if (f.autor && o.autor !== f.autor) return false;
      if (f.fuente && o.fuente !== f.fuente) return false;
      if (f.estado && o.estado !== f.estado) return false;
      if (f.compania && !(o.companias || []).includes(f.compania)) return false;
      if (f.lugar && !(o.lugares || []).includes(f.lugar)) return false;
      if (f.espacio) {
        const enEsp = (o.espacios || []).includes(f.espacio);
        const enCat = (o.categorias_lugar || []).includes(f.espacio);
        if (!enEsp && !enCat) return false;
      }
      if (f.tipo) {
        const tip = (o.tipo_obra || "") === f.tipo || (o.genero || "") === f.tipo;
        if (!tip) return false;
      }
      if (f.musica === "1" && !o.musica) return false;
      if (f.musica === "0" && o.musica) return false;
      if (f.desde != null || f.hasta != null) {
        if (o.anio_min == null && o.anio_max == null) return false;
        const amin = o.anio_min ?? o.anio_max;
        const amax = o.anio_max ?? o.anio_min;
        if (f.desde != null && amax < f.desde) return false;
        if (f.hasta != null && amin > f.hasta) return false;
      }
      if (q) {
        const blob = sinTildes(
          `${o.titulo} ${o.titulo_alt || ""} ${o.autor} ${o.id} ${o.mecenas || ""}`
        );
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }

  function pintarResultados() {
    const items = filtrar(index, filtros);
    document.getElementById("resultadoN").textContent =
      items.length === index.length
        ? `${items.length} obras`
        : `${items.length} resultado${items.length === 1 ? "" : "s"}`;
    pintarLista(document.getElementById("lista"), items);
  }

  function montarLetras() {
    const caja = document.getElementById("letras");
    caja.replaceChildren();
    const conteo = Object.fromEntries(
      (facetas.letras || []).map((x) => [x.value, x.n])
    );
    LETRAS.forEach((L) => {
      const n = conteo[L] || 0;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "letra" + (L === letraActiva ? " es-activa" : "");
      btn.disabled = n === 0;
      btn.textContent = L;
      btn.title = n ? `${n} obra(s)` : "Sin obras";
      btn.addEventListener("click", () => {
        letraActiva = L;
        montarLetras();
        pintarIndice();
      });
      caja.append(btn);
    });
  }

  function pintarIndice() {
    pintarLista(
      document.getElementById("listaIndice"),
      index.filter((o) => o.letra === letraActiva)
    );
  }

  function pintarLista(caja, items) {
    caja.replaceChildren();
    if (!items.length) {
      const p = document.createElement("p");
      p.className = "vacio";
      p.style.padding = "16px";
      p.textContent = "Ninguna obra coincide.";
      caja.append(p);
      return;
    }
    const tope = 400;
    items.slice(0, tope).forEach((o) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fila" + (activa === o.iri ? " es-activa" : "");
      btn.innerHTML =
        `<span><div class="t"></div><div class="s"></div></span><span class="n"></span>`;
      btn.querySelector(".t").textContent = o.titulo || "(sin título)";
      btn.querySelector(".s").textContent = [o.autor, o.tipo_obra || o.genero, o.id]
        .filter(Boolean)
        .join(" · ");
      btn.querySelector(".n").textContent = o.n_representaciones
        ? `${o.n_representaciones} rep.`
        : "";
      btn.addEventListener("click", () => abrirModal(o));
      caja.append(btn);
    });
    if (items.length > tope) {
      const p = document.createElement("p");
      p.className = "vacio";
      p.style.padding = "12px 16px";
      p.textContent = `Mostrando ${tope} de ${items.length}. Afina la búsqueda para ver el resto.`;
      caja.append(p);
    }
  }

  function refNombre(ref) {
    if (!ref) return "";
    const id = typeof ref === "string" ? ref : ref["@id"];
    const n = porIri.get(id);
    return (n && (n.name || n.identifier)) || id || "";
  }

  function campo(label, valor, { full = false, html = false } = {}) {
    const wrap = document.createElement("div");
    wrap.className = "modal-field" + (full ? " full" : "");
    const lab = document.createElement("label");
    lab.textContent = label;
    const val = document.createElement("div");
    val.className = "valor";
    if (html && valor) val.innerHTML = valor;
    else if (valor !== undefined && valor !== null && valor !== "") val.textContent = String(valor);
    wrap.append(lab, val);
    return wrap;
  }

  function panel(id, nodos) {
    const el = document.createElement("div");
    el.className = "tab-panel";
    el.dataset.panel = id;
    el.hidden = id !== "ident";
    const grid = document.createElement("div");
    grid.className = "modal-grid";
    nodos.forEach((n) => grid.append(n));
    el.append(grid);
    return el;
  }

  function abrirModal(item) {
    activa = item.iri;
    const nodo = porIri.get(item.iri);
    const modal = document.getElementById("fichaModal");
    const titulo = document.getElementById("modalTitulo");
    const cuerpo = document.getElementById("modalCuerpo");
    if (!nodo) return;

    titulo.textContent = nodo.name || item.titulo || "Ficha";
    const fuente = (nodo.fuente_principal || item.fuente || "").toUpperCase();
    document.getElementById("chipFuentesix").hidden = !(
      fuente.includes("FUENTES") || fuente === "AMBAS"
    );
    document.getElementById("chipCatcom").hidden = !(
      fuente.includes("CATCOM") || fuente === "AMBAS"
    );
    const est = document.getElementById("modalEstado");
    est.textContent = nodo.estado_ficha || item.estado || "";
    est.hidden = !est.textContent;

    const catcom = nodo.url_catcom
      ? `<a href="${nodo.url_catcom}" target="_blank" rel="noopener">${nodo.url_catcom}</a>`
      : "";

    const reps = [].concat(nodo.tiene_representacion || []).map((r) => {
      const n = porIri.get(r["@id"] || r);
      if (!n) return null;
      return {
        fecha: n.startDate || n.name || "",
        compania: n.compania || "",
        lugar: refNombre(n.en_lugar || n.location),
      };
    }).filter(Boolean);

    cuerpo.replaceChildren();
    cuerpo.append(
      panel("ident", [
        campo("Fuente / catálogo", nodo.fuente_principal || item.fuente),
        campo("Referencia", nodo.identifier || item.id),
        campo("Enlace CATCOM", catcom, { full: true, html: true }),
        campo("Título original", nodo.titulo, { full: true }),
        campo("Título normalizado", nodo.titulo_limpio || nodo.name),
        campo("Títulos alternativos", nodo.alternateName || item.titulo_alt, { full: true }),
      ]),
      panel("autoria", [
        campo("Dramaturgo / autor", refNombre(nodo.author || nodo.autor), { full: true }),
        campo("Nombres propios / mecenas", nodo.mecenas || item.mecenas, { full: true }),
      ]),
      panel("clasif", [
        campo("Tipo de obra", nodo.tipo_obra || item.tipo_obra),
        campo("Género / subgénero", nodo.genre || item.genero),
        campo("Estado de ficha", nodo.estado_ficha || item.estado),
      ]),
      panel("datacion", [
        campo("Fecha de creación estimada", nodo.fecha_creacion),
        campo(
          "Intervalo de representaciones",
          item.anio_min || item.anio_max
            ? `${item.anio_min || "?"} – ${item.anio_max || "?"}`
            : ""
        ),
        (() => {
          const block = document.createElement("div");
          block.className = "modal-field full";
          const lab = document.createElement("label");
          lab.textContent = "Representaciones";
          block.append(lab);
          if (!reps.length) {
            const v = document.createElement("div");
            v.className = "valor";
            block.append(v);
            return block;
          }
          const ul = document.createElement("ul");
          ul.className = "reps-lista";
          reps.forEach((r) => {
            const li = document.createElement("li");
            li.innerHTML = `<div></div><div class="rep-meta"></div>`;
            li.children[0].textContent = r.fecha || "Sin fecha";
            li.children[1].textContent = [r.lugar, r.compania].filter(Boolean).join(" · ");
            ul.append(li);
          });
          block.append(ul);
          return block;
        })(),
      ]),
      panel("musica", [
        campo("Música conservada", nodo.musica_conservada ? "Sí" : "No"),
        campo("Compositor", nodo.compositor, { full: true }),
      ]),
      panel("contexto", [
        campo("Lugares", (item.lugares || []).join("; "), { full: true }),
        campo("Espacios de representación", (item.espacios || []).join("; "), { full: true }),
        campo("Categorías de lugar", (item.categorias_lugar || []).join("; "), { full: true }),
        campo("Compañías", (item.companias || []).join("; "), { full: true }),
        campo("Página FUENTES IX", nodo.pagina_pdf),
      ]),
      panel("editorial", [
        campo("Testimonio manuscrito", nodo.testimonio_manuscrito ? "Sí" : "No"),
        campo("Testimonio impreso", nodo.testimonio_impreso ? "Sí" : "No"),
        campo("Edición príncipe", nodo.edicion_principe, { full: true }),
        campo("Manuscritos conocidos", nodo.manuscritos_conocidos, { full: true }),
        campo("Ediciones conocidas", nodo.ediciones_conocidas, { full: true }),
        campo("Notas bibliográficas", nodo.notas_bibliograficas, { full: true }),
      ]),
      panel("obs", [
        campo("Notas", nodo.notas, { full: true }),
        campo("Observaciones", nodo.observaciones, { full: true }),
        campo("IRI del grafo", nodo["@id"], { full: true }),
      ])
    );

    document.querySelectorAll("#modalTabs .modal-tab").forEach((t) => {
      t.classList.toggle("es-activa", t.dataset.tab === "ident");
    });
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function cerrarModal() {
    document.getElementById("fichaModal").hidden = true;
    document.body.style.overflow = "";
  }

  document.getElementById("modalCerrar").addEventListener("click", cerrarModal);
  document.getElementById("modalCerrar2").addEventListener("click", cerrarModal);
  document.getElementById("fichaModal").addEventListener("click", (e) => {
    if (e.target.id === "fichaModal") cerrarModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("fichaModal").hidden) cerrarModal();
  });
  document.getElementById("modalTabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".modal-tab");
    if (!tab) return;
    const id = tab.dataset.tab;
    document.querySelectorAll("#modalTabs .modal-tab").forEach((t) => {
      t.classList.toggle("es-activa", t === tab);
    });
    document.querySelectorAll("#modalCuerpo .tab-panel").forEach((p) => {
      p.hidden = p.dataset.panel !== id;
    });
  });
})();
