const $ = id => document.getElementById(id);
const API_URL = window.GSP_CONFIG?.SCRIPT_URL || '';
const SOLIC_QUEUE_KEY = 'gsp_solicitante_queue_v1';
const STATUS_CACHE_KEY = 'gsp_ultimo_status_por_chamado';
const CONFIG_CACHE_KEY = 'gsp_configuracoes_cache_v29';
let statusWatchTimer = null;
let tiposSolicitacao = ['Conferência','Acompanhamento','Boletim de Ocorrência'];
let diretorias = ['Brand Marketing','Commercial Fiat','Comercial Jeep','Compras','Comunicação Corporativa','Customer Care','Customer Jeep','Customer Experience','Desenvolvimento de Rede','Design','Engenharia','Fiat Brand','Finance','HR & Transformation','ICT','Industrial','Jeep Brand','Jurídico','Manufatura','Mopar','Parts e Services','Portfolio','Presidência','Produto','Qualidade','Recursos Humanos','Supply Chain','Outra'];
let categorias = ['Equipamento','Material de construção (entulho)','Material diversos','Protótipo','Vasilhames','Outros'];
let ocorrencias = ['Acidente','Agressão física','Avaria em peças / vasilhames','Dano material','Danos às instalações industriais','Demissão','Desaparecimento','Emergência','Entrada com danos','Erro operacional','Furto em área externa','Furto em área interna','Incêndio','Irregularidade','Roubo ou furto','Sintomas de embriaguez','Trânsito','Outros'];
let acompanhamentos = ['Apoio operacional','Acompanhamento de terceiros','Acompanhamento de veículo','Acompanhamento de material','Acompanhamento em área interna','Acompanhamento em área externa','Outros'];
let page = 0;
let botData = {};
let step = 0;
let salvandoChamado = false;
let deferredInstallPrompt = null;

function initCustomSelects(scope=document){
  scope.querySelectorAll('select').forEach(select=>{
    if(!select.dataset.customized){
      select.dataset.customized='1';
      select.classList.add('native-select');
      const trigger=document.createElement('button');
      trigger.type='button';
      trigger.className='select-display';
      trigger.addEventListener('click',()=>openSelectModal(select));
      trigger.addEventListener('keydown',e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); openSelectModal(select); } });
      select.insertAdjacentElement('afterend', trigger);
      select.addEventListener('change',()=>updateCustomSelect(null,select));
    }
    updateCustomSelect(null,select);
  });
}
function updateCustomSelect(id,selectEl=null){
  const select = selectEl || $(id); if(!select) return;
  const trigger = select.parentElement ? select.parentElement.querySelector('.select-display') : null;
  if(!trigger) return;
  const opt = select.options[select.selectedIndex];
  const txt = opt ? String(opt.textContent||'').trim() : 'Selecione';
  const showPlaceholder = !String(select.value||'').trim() && /selecione/i.test(txt);
  trigger.innerHTML = `<span>${txt || 'Selecione'}</span><span class="select-arrow">⌄</span>`;
  trigger.classList.toggle('placeholder', showPlaceholder);
  trigger.disabled = !!select.disabled;
}
function openSelectModal(select){
  document.querySelectorAll('.select-modal-backdrop').forEach(m=>m.remove());
  const label = (select.closest('.field')?.querySelector('label')?.textContent || 'Selecione').replace('*','').trim();
  const options = [...select.options].map(o=>({value:o.value,label:(o.textContent||'').trim()})).filter(o=>o.label);
  const selected = String(select.value||'');
  const d = document.createElement('div');
  d.className='modal-backdrop select-modal-backdrop';
  d.innerHTML = `<div class="modal select-modal"><div class="select-modal-head"><h3>${label}</h3><button type="button" class="select-close">✕</button></div><div class="select-option-list">${options.map(o=>`<button type="button" class="select-option ${o.value===selected?'active':''}" data-value="${String(o.value).replace(/"/g,'&quot;')}">${o.label}</button>`).join('')}</div></div>`;
  d.addEventListener('click',e=>{ if(e.target===d || e.target.closest('.select-close')) d.remove(); });
  d.querySelectorAll('.select-option').forEach(btn=>btn.addEventListener('click',()=>{
    select.value = btn.dataset.value;
    select.dispatchEvent(new Event('change',{bubbles:true}));
    updateCustomSelect(null,select);
    d.remove();
    const next = setTimeout(()=>nextFocus(select),80);
  }));
  document.body.appendChild(d);
}
let lastSpeaker = '';

function setOfflineState(){ document.body.classList.toggle('offline', !navigator.onLine); }
function ensureOfflineBanner(){
  if(document.getElementById('offlineBanner')) return;
  const d=document.createElement('div'); d.id='offlineBanner'; d.className='offline-banner';
  d.textContent='Sem internet: a solicitação será salva neste aparelho e enviada automaticamente quando voltar o sinal.';
  document.body.appendChild(d);
}
function readSolicQueue(){ try{return JSON.parse(localStorage.getItem(SOLIC_QUEUE_KEY)||'[]');}catch(e){return [];} }
function saveSolicQueue(q){ localStorage.setItem(SOLIC_QUEUE_KEY, JSON.stringify(q)); renderPendingSolicitacoes(); }
function renderPendingSolicitacoes(){
  const box=$('pendingOfflineBox');
  if(!box) return;
  const q=readSolicQueue();
  if(!q.length){ box.classList.add('hidden'); box.innerHTML=''; return; }
  const qtd=q.length;
  const ultimo=q[q.length-1];
  const localId=ultimo?.localId || '';
  box.innerHTML = `<strong>⚠️ ${qtd} solicitação(ões) aguardando internet</strong><small>Último número provisório: <strong>${localId}</strong>. Assim que o sinal voltar, o app enviará automaticamente para a planilha e gerará o número oficial GSP.</small>`;
  box.classList.remove('hidden');
}

function readStatusCache(){ try{return JSON.parse(localStorage.getItem(STATUS_CACHE_KEY)||'{}');}catch(e){return {};} }
function saveStatusCache(cache){ localStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(cache||{})); }
function setKnownStatus(id,status,updatedAt){
  if(!id || !status) return;
  const cache=readStatusCache();
  cache[id]={status:String(status||''),updatedAt:updatedAt||new Date().toISOString()};
  saveStatusCache(cache);
}
function getKnownStatus(id){ const cache=readStatusCache(); return cache[id] || null; }
function salvarUltimoChamado(id,status='Recebido',updatedAt=''){
  if(!id) return;
  localStorage.setItem('ultimoChamadoGsp', id);
  if(status) setKnownStatus(id,status,updatedAt || new Date().toISOString());
  const campo=$('consultaId');
  if(campo) campo.value=id;
  const box=$('ultimoChamadoBox');
  if(box){ box.innerHTML=`Último número gerado: <strong>${id}</strong>`; box.classList.remove('hidden'); }
  renderStatusAlert(id,status,updatedAt,false);
}
function carregarUltimoChamado(){
  const id=localStorage.getItem('ultimoChamadoGsp')||'';
  if(id){
    const known=getKnownStatus(id);
    const campo=$('consultaId'); if(campo) campo.value=id;
    const box=$('ultimoChamadoBox'); if(box){ box.innerHTML=`Último número gerado: <strong>${id}</strong>`; box.classList.remove('hidden'); }
    renderStatusAlert(id, known?.status || '', known?.updatedAt || '', false);
  }
}
function renderStatusAlert(id,status,updatedAt,isNew=false){
  const box=$('statusAlertBox');
  if(!box || !id) return;
  const hora = updatedAt ? `<small>Atualizado em ${formatDate(updatedAt)}</small>` : '';
  const destaque = isNew ? ' Nova atualização' : ' Acompanhamento automático';
  box.innerHTML = `<div><strong>🔔${destaque}</strong><br>Chamado <strong>${id}</strong>${status?` está como <strong>${status}</strong>`:''}.${hora}</div>`;
  box.classList.remove('hidden');
}
function formatDate(v){ try{return new Date(v).toLocaleString('pt-BR');}catch(e){return String(v||'-');} }
async function checkStatusUpdate(showSilent=false){
  if(!navigator.onLine) return;
  const id=localStorage.getItem('ultimoChamadoGsp')||'';
  if(!id || !API_URL) return;
  try{
    const res=await apiGet({acao:'consultar',id});
    if(!res.sucesso || !res.chamado) return;
    const c=res.chamado;
    const novo=String(c.STATUS||'').trim();
    const atualizado=c.DATA_HORA_ATUALIZACAO || new Date().toISOString();
    const anterior=getKnownStatus(id);
    const mudou=anterior && anterior.status && novo && anterior.status!==novo;
    setKnownStatus(id,novo,atualizado);
    renderStatusAlert(id,novo,atualizado,mudou);
    const campo=$('consultaId'); if(campo&&!campo.value) campo.value=id;
    if(mudou){
      if(navigator.vibrate) navigator.vibrate([160,80,160]);
      showModal('Atualização do chamado',`Chamado: <strong>${id}</strong><br>Status anterior: <strong>${anterior.status}</strong><br>Novo status: <strong>${novo}</strong><br><br>Essa atualização foi identificada automaticamente pelo aplicativo.`,'🔔',true);
      if($('view-status')?.classList.contains('active')) consultarStatus();
    } else if(showSilent && $('view-status')?.classList.contains('active')) {
      consultarStatus();
    }
  }catch(e){ /* mantém silencioso para não incomodar o solicitante */ }
}
function startStatusWatcher(){
  if(statusWatchTimer) clearInterval(statusWatchTimer);
  setTimeout(()=>checkStatusUpdate(false),2500);
  statusWatchTimer=setInterval(()=>checkStatusUpdate(false),30000);
}

function queueSolicitacao(payload){ const q=readSolicQueue(); const localId='PEND-'+Date.now(); q.push({localId,payload:{...payload},queuedAt:new Date().toISOString()}); saveSolicQueue(q); return localId; }
async function processSolicQueue(){
  if(!navigator.onLine) return;
  const q=readSolicQueue(); if(!q.length) return;
  const pending=[]; const done=[];
  for(const item of q){ try{ const res=await apiCriarChamado(item.payload); if(res&&res.sucesso) done.push(res.id||res.idChamado); else pending.push(item); }catch(e){ pending.push(item); } }
  saveSolicQueue(pending);
  renderPendingSolicitacoes();
  if(done.length){
    const gerados=done.filter(Boolean);
    if(gerados.length) salvarUltimoChamado(gerados[gerados.length-1],'Recebido');
    showModal('Sincronização concluída',`${done.length} solicitação(ões) pendente(s) foram enviadas para a planilha.<br><br>Número oficial do chamado: <strong>${gerados.join(', ')}</strong>`,'✅',true);
  }
}
window.addEventListener('online',()=>{setOfflineState();processSolicQueue();checkStatusUpdate(false);});
window.addEventListener('offline',()=>{setOfflineState();renderPendingSolicitacoes();});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const b = $('installBtn');
  if (b) b.classList.remove('hidden');
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const b = $('installBtn');
  if (b) b.classList.add('hidden');
  showModal('Aplicativo instalado', 'O app foi instalado no aparelho.', '✅', true);
});
async function installApp(){
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    const b = $('installBtn');
    if (b) b.classList.add('hidden');
    return;
  }
  showModal('Instalar aplicativo', 'No Chrome, toque no menu ⋮ e escolha <strong>Instalar app</strong>. Se a opção ainda não aparecer, atualize a página e aguarde alguns segundos.', '⬇️', true);
}
function fillSelect(id,arr){ const el=$(id); if(el) el.innerHTML='<option value="">Selecione</option>'+arr.map(x=>`<option>${x}</option>`).join(''); }

function applyConfiguracoes(cfg){
  if(!cfg || typeof cfg !== 'object') return;
  if(Array.isArray(cfg.TIPO_SOLICITACAO) && cfg.TIPO_SOLICITACAO.length) tiposSolicitacao = cfg.TIPO_SOLICITACAO;
  if(Array.isArray(cfg.DIRETORIA) && cfg.DIRETORIA.length) diretorias = cfg.DIRETORIA;
  if(Array.isArray(cfg.CATEGORIA_CONFERENCIA) && cfg.CATEGORIA_CONFERENCIA.length) categorias = cfg.CATEGORIA_CONFERENCIA;
  if(Array.isArray(cfg.CARACTERISTICA_OCORRENCIA) && cfg.CARACTERISTICA_OCORRENCIA.length) ocorrencias = cfg.CARACTERISTICA_OCORRENCIA;
  if(Array.isArray(cfg.TIPO_ACOMPANHAMENTO) && cfg.TIPO_ACOMPANHAMENTO.length) acompanhamentos = cfg.TIPO_ACOMPANHAMENTO;
  fillSelect('tipo', tiposSolicitacao);
  fillSelect('diretoria', diretorias);
  fillSelect('categoria', categorias);
  fillSelect('ocorrencia', ocorrencias);
  fillSelect('acompanhamento', acompanhamentos);
  initCustomSelects();
  onTipoChange();
  toggleEmpresa();
}
async function carregarConfiguracoes(){
  try{
    const cache = JSON.parse(localStorage.getItem(CONFIG_CACHE_KEY)||'null');
    if(cache) applyConfiguracoes(cache);
  }catch(e){}
  if(!API_URL || !navigator.onLine) return;
  try{
    const res = await apiGet({acao:'configuracoes'});
    if(res && res.sucesso && res.configuracoes){
      localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(res.configuracoes));
      applyConfiguracoes(res.configuracoes);
    }
  }catch(e){ console.warn('Não foi possível carregar CONFIGURACOES', e); }
}

function init(){
  ensureOfflineBanner(); setOfflineState(); processSolicQueue();
  fillSelect('tipo',tiposSolicitacao); fillSelect('diretoria',diretorias); fillSelect('categoria',categorias); fillSelect('ocorrencia',ocorrencias); fillSelect('acompanhamento',acompanhamentos); carregarConfiguracoes();
  initCustomSelects();
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) { const b=$('installBtn'); if(b)b.classList.add('hidden'); }
  const input = $('botInput');
  if(input){
    input.addEventListener('focus', () => setTimeout(syncBotViewport, 60));
    input.addEventListener('blur', () => setTimeout(syncBotViewport, 160));
    input.addEventListener('input', () => setTimeout(syncBotViewport, 30));
  }
  window.addEventListener('resize', syncBotViewport);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', syncBotViewport);
    window.visualViewport.addEventListener('scroll', syncBotViewport);
  }
  renderSteps(); onTipoChange(); toggleRamal(); toggleEmpresa(); toggleColuna(); toggleSala(); carregarUltimoChamado(); renderPendingSolicitacoes(); startStatusWatcher();
  setTimeout(syncBotViewport, 120);
}
function go(id,btn){ document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); $(id).classList.add('active'); const navBtns=document.querySelectorAll('.navbtn'); if(navBtns.length){ navBtns.forEach(b=>b.classList.remove('active')); if(btn)btn.classList.add('active'); } document.body.classList.toggle('bot-view-active', id==='view-bot'); if(id!=='view-bot') document.body.classList.remove('keyboard-open'); window.scrollTo({top:0,behavior:'smooth'}); setTimeout(syncBotViewport,60); if(id==='view-form') setTimeout(focusFirstVisible,180); if(id==='view-bot') setTimeout(focusBotInput,220); if(id==='view-status') setTimeout(()=>checkStatusUpdate(true),350); }
function isMobileViewport(){ return window.matchMedia ? window.matchMedia('(max-width: 850px)').matches : window.innerWidth <= 850; }
function scrollMessagesToBottom(smooth=false){ const m=$('messages'); if(!m) return; const top = m.scrollHeight; try{ if(smooth) m.scrollTo({top, behavior:'smooth'}); else m.scrollTop = top; }catch(e){ m.scrollTop = top; } }
function syncBotViewport(){
  const botView = $('view-bot');
  const chat = document.querySelector('#view-bot .chat');
  if(!botView || !chat) return;
  const activeBot = botView.classList.contains('active');
  document.body.classList.toggle('bot-view-active', activeBot);
  const botFocused = document.activeElement === $('botInput');
  document.body.classList.toggle('keyboard-open', activeBot && botFocused);
  if(!activeBot){ chat.style.height=''; return; }
  const vv = window.visualViewport;
  const viewportH = vv ? Math.round(vv.height) : window.innerHeight;
  document.documentElement.style.setProperty('--vvh', viewportH + 'px');
  const nav = document.querySelector('.bottom-nav');
  const reserve = (nav && !document.body.classList.contains('keyboard-open') && isMobileViewport()) ? (nav.offsetHeight + 18) : 10;
  const top = Math.max(chat.getBoundingClientRect().top, 0);
  chat.style.height = Math.max(340, viewportH - top - reserve) + 'px';
  scrollMessagesToBottom();
}
function focusBotInput(){
  const input=$('botInput');
  const composer=$('chatComposer');
  if(!input) return;
  setTimeout(()=>{
    try{ input.focus({preventScroll:true}); }catch(e){ input.focus(); }
    if(composer) composer.scrollIntoView({behavior:'smooth', block:'nearest'});
    try{ input.scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){}
    syncBotViewport();
    setTimeout(()=>scrollMessagesToBottom(true), 40);
  }, 120);
}
function renderSteps(){ const names=['Tipo','Solicitante','Empresa','Local','Final']; $('stepbar').innerHTML=names.map((n,i)=>`<div class="step ${i===page?'active':i<page?'done':''}">${i+1}. ${n}</div>`).join(''); document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',Number(p.dataset.page)===page)); $('btnPrev').classList.toggle('hidden',page===0); $('btnNext').classList.toggle('hidden',page===4); $('btnSalvar').classList.toggle('hidden',page!==4); if(page===4) $('resumoFinal').innerHTML=montarResumo(); setTimeout(focusFirstVisible,80); }
function prevPage(){ if(page>0){ page--; renderSteps(); } }
function nextPage(){ if(validatePage(page)){ page++; renderSteps(); } }
function focusFirstVisible(){ const el=[...document.querySelectorAll('.page.active input,.page.active select,.page.active textarea,.page.active .select-display')].find(e=>!e.closest('.hidden')&&!e.disabled); if(el) el.focus({preventScroll:true}); }
function nextFocus(el){ setTimeout(()=>{ const inputs=[...document.querySelectorAll('.page.active input,.page.active select,.page.active textarea,.page.active .select-display')].filter(e=>!e.closest('.hidden')&&!e.disabled); const i=inputs.indexOf(el); if(i>=0&&inputs[i+1]) inputs[i+1].focus({preventScroll:false}); },80); }
function fieldValue(f){ const el=f.querySelector('input,select,textarea'); return el?String(el.value||'').trim():''; }
function validatePage(pg){ let ok=true; document.querySelectorAll(`.page[data-page="${pg}"] .field[data-required]`).forEach(f=>{ if(f.closest('.hidden')){f.classList.remove('invalid');return;} const valid=!!fieldValue(f); f.classList.toggle('invalid',!valid); if(!valid) ok=false; }); if(!ok){ const field=document.querySelector('.page.active .field.invalid'); const first=field? (field.querySelector('.select-display') || field.querySelector('input,select,textarea')) : null; if(first) first.focus(); showModal('Atenção','Preencha os campos obrigatórios destacados.','⚠️',true); } return ok; }
function onTipoChange(){ const t=$('tipo').value; ['categoriaBox','ocorrenciaBox','acompanhamentoBox'].forEach(id=>$(id).classList.add('hidden')); $('categoria').value=''; $('ocorrencia').value=''; $('acompanhamento').value=''; if(t==='Conferência') $('categoriaBox').classList.remove('hidden'); if(t==='Boletim de Ocorrência') $('ocorrenciaBox').classList.remove('hidden'); if(t==='Acompanhamento') $('acompanhamentoBox').classList.remove('hidden'); }
function toggleRamal(){ const sim=$('possuiRamal').value==='Sim'; $('ramalBox').classList.toggle('hidden',!sim); if(!sim)$('ramal').value='Não possui'; else if($('ramal').value==='Não possui')$('ramal').value=''; }
function toggleEmpresa(){ const ter=$('tipoEmpresa').value==='Terceiro'; $('terceiraBox').classList.toggle('hidden',!ter); $('diretoriaBox').classList.toggle('hidden',ter); if(ter){$('diretoria').value='';$('outraDiretoria').value='';} toggleOutraDiretoria(); }
function toggleOutraDiretoria(){ const outra=$('diretoria').value==='Outra'&&!$('diretoriaBox').classList.contains('hidden'); $('outraDiretoriaBox').classList.toggle('hidden',!outra); if(!outra)$('outraDiretoria').value=''; }
function toggleColuna(){ const sim=$('possuiColuna').value==='Sim'; $('colunaBox').classList.toggle('hidden',!sim); if(!sim)$('coluna').value='Não possui'; else if($('coluna').value==='Não possui')$('coluna').value=''; }
function toggleSala(){ const sim=$('possuiSala').value==='Sim'; $('salaBox').classList.toggle('hidden',!sim); if(!sim)$('sala').value='Não possui'; else if($('sala').value==='Não possui')$('sala').value=''; }
function formData(){ const tipo=$('tipo').value; const ter=$('tipoEmpresa').value==='Terceiro'; return {acao:'criar',tipo,prioridade:'',origem:'Solicitante',nome:$('nome').value.trim(),registro:$('registro').value.trim(),telefone:$('telefone').value.trim(),possuiRamal:$('possuiRamal').value,ramal:$('possuiRamal').value==='Sim'?$('ramal').value.trim():'Não possui',tipoEmpresa:$('tipoEmpresa').value,diretoria:ter?'':$('diretoria').value,outraDiretoria:$('diretoria').value==='Outra'?$('outraDiretoria').value.trim():'',empresa:ter?$('terceira').value.trim():'Stellantis',setor:$('setor').value.trim(),liderNome:$('liderNome').value.trim(),liderRegistro:'',galpao:$('galpao').value.trim(),possuiColuna:$('possuiColuna').value,coluna:$('possuiColuna').value==='Sim'?$('coluna').value.trim():'Não possui',possuiSala:$('possuiSala').value,sala:$('possuiSala').value==='Sim'?$('sala').value.trim():'Não possui',referencia:$('referencia').value.trim(),categoria:tipo==='Conferência'?$('categoria').value:'',ocorrencia:tipo==='Boletim de Ocorrência'?$('ocorrencia').value:'',acompanhamento:tipo==='Acompanhamento'?$('acompanhamento').value:'',descricao:$('descricao').value.trim()}; }
function montarResumo(){ const c=formData(); return `<strong>Resumo:</strong><br>Tipo: ${c.tipo||'-'}<br>Detalhe: ${c.categoria||c.ocorrencia||c.acompanhamento||'-'}<br>Solicitante: ${c.nome||'-'} / ${c.registro||'-'}<br>Empresa: ${c.empresa||'-'} ${c.diretoria?'- '+c.diretoria:''}<br>Setor: ${c.setor||'-'}<br>Local: Galpão ${c.galpao||'-'}, Coluna ${c.coluna||'-'}, Sala ${c.sala||'-'}<br>Referência: ${c.referencia||'-'}`; }
async function parseJsonResponse(r){ const txt=await r.text(); try{return JSON.parse(txt);}catch(e){ if(txt.trim().startsWith('<')) throw new Error('O Apps Script retornou uma página HTML. Verifique se a implantação está como Qualquer pessoa e se o link /exec está atualizado.'); throw new Error(txt.slice(0,180)||e.message); } }
function jsonpRequest(params){
  return new Promise((resolve,reject)=>{
    const cb='gsp_cb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');
    const url=API_URL+'?'+new URLSearchParams({...params,callback:cb,_:Date.now()}).toString();
    const timer=setTimeout(()=>{cleanup();reject(new Error('Tempo esgotado ao conectar na planilha. Atualize o Apps Script com suporte JSONP.'));},15000);
    function cleanup(){clearTimeout(timer);delete window[cb];script.remove();}
    window[cb]=(data)=>{cleanup();resolve(data);};
    script.onerror=()=>{cleanup();reject(new Error('Falha ao conectar na planilha. Verifique o link /exec e a permissão Qualquer pessoa.'));};
    script.src=url;
    document.body.appendChild(script);
  });
}
async function apiGet(params){
  try{
    return await jsonpRequest(params);
  }catch(jsonpError){
    const r=await fetch(API_URL+'?'+new URLSearchParams({...params,_:Date.now()}).toString(),{cache:'no-store',redirect:'follow'});
    return await parseJsonResponse(r);
  }
}
async function apiCriarChamado(payload){ return await apiGet({acao:'criarGet',dados:JSON.stringify(payload)}); }
function msgWhats(c){ return `*NOVA SOLICITAÇÃO GSP*

*Chamado:* ${c.id}
*Status:* ${c.status||'Recebido'}
*Tipo:* ${c.tipo}
*Detalhe:* ${c.categoria||c.ocorrencia||c.acompanhamento||'-'}
*Solicitante:* ${c.nome}
*Registro:* ${c.registro}
*Telefone:* ${c.telefone||'-'}
*Ramal:* ${c.ramal||'-'}

*Empresa:* ${c.empresa||'-'}
*Diretoria:* ${c.diretoria||'-'}
*Outra diretoria:* ${c.outraDiretoria||'-'}
*Setor/Área:* ${c.setor||'-'}
*Líder:* ${c.liderNome||'-'}

*Local:* Galpão ${c.galpao||'-'}, Coluna ${c.coluna||'-'}, Sala ${c.sala||'-'}
*Referência:* ${c.referencia||'-'}

*Descrição:* ${c.descricao}`; }
async function salvarChamado(origem){
  if(salvandoChamado) return;
  if(origem==='manual'){ for(let i=0;i<5;i++){ if(!validatePage(i)){page=i;renderSteps();return;} } }
  const c = origem==='bot' ? {...botData,acao:'criar',origem:'Bot GSP',liderRegistro:''} : formData();
  salvandoChamado=true; const btn=$('btnSalvar'); if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  if(!navigator.onLine){
    const localId=queueSolicitacao(c); setOfflineState();
    showModal('Sem internet',`Sua solicitação foi salva neste aparelho.<br>Ela será enviada automaticamente quando a conexão voltar.<br><br>Número provisório: <strong>${localId}</strong><br><br>Retornando para a tela inicial...`,'⚠️',true);
    setTimeout(()=>{ document.querySelectorAll('.modal-backdrop').forEach(m=>m.remove()); go('view-home'); }, 2600);
    salvandoChamado=false; if(btn){btn.disabled=false;btn.textContent='Registrar chamado';}
    return;
  }
  showModal('Registrando solicitação','Registrando solicitação, aguarde','⏳',false);
  try{
    const res=await apiCriarChamado(c);
    if(!res.sucesso) throw new Error(res.mensagem||'Falha ao salvar na planilha.');
    c.id=res.id||res.idChamado; c.status=res.status||'Recebido';
    if(!c.id) throw new Error('A planilha salvou, mas não retornou o número do chamado.');
    salvarUltimoChamado(c.id,c.status||'Recebido');
    showModal('Chamado registrado',`Número: <strong>${c.id}</strong><br>O número foi preenchido automaticamente na consulta de status.<br><br>Retornando para a tela inicial...`,'✅',true); setTimeout(()=>{ document.querySelectorAll('.modal-backdrop').forEach(m=>m.remove()); go('view-home'); }, 2200);
  }catch(e){
    const localId=queueSolicitacao(c);
    showModal('Salvo para sincronizar',`Não foi possível gerar o número oficial agora.<br>A solicitação ficou salva neste aparelho e será sincronizada automaticamente quando a conexão voltar.<br><br>Número provisório: <strong>${localId}</strong><br><br>Retornando para a tela inicial...`,'⚠️',true);
    setTimeout(()=>{ document.querySelectorAll('.modal-backdrop').forEach(m=>m.remove()); go('view-home'); }, 3200);
  }
  finally{ salvandoChamado=false; if(btn){btn.disabled=false;btn.textContent='Registrar chamado';} }
}
async function consultarStatus(){ const id=$('consultaId').value.trim(); if(!id) return showModal('Atenção','Informe o número do chamado.','⚠️'); $('statusResultado').innerHTML='<div class="status-box loading">Consultando...</div>'; try{ const res=await apiGet({acao:'consultar',id}); if(!res.sucesso) throw new Error(res.mensagem||'Chamado não encontrado.'); const c=res.chamado; const atualizacaoRaw=c.DATA_HORA_ATUALIZACAO||''; const atualizacao = atualizacaoRaw ? new Date(atualizacaoRaw).toLocaleString('pt-BR') : '-'; if(c.ID_CHAMADO){ localStorage.setItem('ultimoChamadoGsp',c.ID_CHAMADO); setKnownStatus(c.ID_CHAMADO,c.STATUS||'',atualizacaoRaw||new Date().toISOString()); renderStatusAlert(c.ID_CHAMADO,c.STATUS||'',atualizacaoRaw,false); } $('statusResultado').innerHTML=`<div class="status-box"><strong>${c.ID_CHAMADO}</strong><br>Status atual: <strong>${c.STATUS||'-'}</strong><br>Tipo: ${c.TIPO_SOLICITACAO||'-'}<br>Atualização: ${atualizacao}<br>${c.VIGILANTE_NOME?`Vigilante em deslocamento: <strong>${c.VIGILANTE_NOME}</strong> (${c.VIGILANTE_REGISTRO||'-'})<br>`:''}${c.OBSERVACAO_GSP?`Observação da operação: ${c.OBSERVACAO_GSP}`:''}</div>`; }catch(e){ $('statusResultado').innerHTML=`<div class="status-box">${e.message}</div>`; } }
function limparForm(){ document.querySelectorAll('#formSolicitacao input,#formSolicitacao textarea').forEach(i=>i.value=''); $('tipo').value=''; $('tipoEmpresa').value='Stellantis'; $('possuiRamal').value='Não'; $('possuiColuna').value='Sim'; $('possuiSala').value='Não'; page=0; onTipoChange(); toggleEmpresa(); toggleRamal(); toggleColuna(); toggleSala(); document.querySelectorAll('.field.invalid').forEach(f=>f.classList.remove('invalid')); initCustomSelects(); renderSteps(); }
function showModal(title,msg,icon='ℹ️',ok=true){ document.querySelectorAll('.modal-backdrop').forEach(m=>m.remove()); const d=document.createElement('div'); d.className='modal-backdrop'; d.innerHTML=`<div class="modal"><h3>${icon} ${title}</h3><p>${msg}</p>${ok?"<div class='actions'><button class='btn' onclick=\"this.closest('.modal-backdrop').remove()\">OK</button></div>":''}</div>`; document.body.appendChild(d); }
function appendBotMessage(html){
  const m = $('messages');
  const continued = lastSpeaker === 'bot';
  m.insertAdjacentHTML('beforeend', `<div class="msgrow botrow ${continued?'continuation':''}"><div class="msg-avatar"><img src="bot-avatar-real.png" alt="Bot GSP"></div><div class="msgbody"><div class="msg botmsg">${html}</div></div></div>`);
  lastSpeaker = 'bot';
  scrollMessagesToBottom();
  focusBotInput();
}
function appendUserMessage(text){
  const m=$('messages');
  m.insertAdjacentHTML('beforeend', `<div class="msgrow userrow"><div class="msgbody"><div class="msg usermsg">${text}</div></div></div>`);
  lastSpeaker='user';
  scrollMessagesToBottom();
}
function botSay(t){ appendBotMessage(t); return Promise.resolve(); }
function userSay(t){ appendUserMessage(t); }
function botAsk(t,opts,fn='botChoose'){ botSay(t); $('chips').innerHTML=opts.map(o=>`<button class="chip" onclick="${fn}('${String(o).replace(/'/g,"\'")}')">${o}</button>`).join(''); focusBotInput(); }
function startBot(){ botData={}; step=1; lastSpeaker=''; $('messages').innerHTML=''; $('chips').innerHTML=''; $('botInput').value=''; botSay('Olá! Sou o Bot GSP. Vou te ajudar a abrir sua solicitação.'); botAsk('Qual tipo de atendimento você precisa?',['Conferência','Acompanhamento','Boletim de Ocorrência']); }
function botChoose(v){ userSay(v); $('chips').innerHTML=''; if(step===1){botData.tipo=v;step=2;return botAsk('Agora selecione o detalhe correspondente.',v==='Conferência'?categorias:v==='Boletim de Ocorrência'?ocorrencias:acompanhamentos);} if(step===2){if(botData.tipo==='Conferência')botData.categoria=v;else if(botData.tipo==='Boletim de Ocorrência')botData.ocorrencia=v;else botData.acompanhamento=v;botData.prioridade='';step=4;return botSay('Informe o nome do solicitante.');} if(step===7){botData.possuiRamal=v;if(v==='Sim'){step=8;return botSay('Informe o ramal.');}botData.ramal='Não possui';step=9;return botAsk('Tipo de empresa?',['Stellantis','Terceiro']);} if(step===9){botData.tipoEmpresa=v;if(v==='Stellantis'){botData.empresa='Stellantis';step=10;return botAsk('Selecione a diretoria.',diretorias);}step=12;return botSay('Informe a empresa terceirizada.');} if(step===10){botData.diretoria=v;if(v==='Outra'){step=11;return botSay('Digite a outra diretoria.');}step=13;return botSay('Informe o setor/área.');} if(step===16){botData.possuiColuna=v;if(v==='Sim'){step=17;return botSay('Informe a coluna.');}botData.coluna='Não possui';step=18;return botAsk('Possui sala?',['Sim','Não']);} if(step===18){botData.possuiSala=v;if(v==='Sim'){step=19;return botSay('Informe a sala.');}botData.sala='Não possui';step=20;return botSay('Informe a referência/ponto de referência.');} }
function botText(){ const val=$('botInput').value.trim(); if(!val)return; $('botInput').value=''; userSay(val); if(step===4){botData.nome=val;step=5;return botSay('Informe o registro/crachá do solicitante.');} if(step===5){botData.registro=val;step=6;return botSay('Informe telefone ou contato.');} if(step===6){botData.telefone=val;step=7;return botAsk('Possui ramal?',['Sim','Não']);} if(step===8){botData.ramal=val;step=9;return botAsk('Tipo de empresa?',['Stellantis','Terceiro']);} if(step===11){botData.outraDiretoria=val;step=13;return botSay('Informe o setor/área.');} if(step===12){botData.empresa=val;botData.diretoria='';step=13;return botSay('Informe o setor/área.');} if(step===13){botData.setor=val;step=14;return botSay('Informe o nome do líder Stellantis, se houver. Se não houver, digite Não possui.');} if(step===14){botData.liderNome=val;botData.liderRegistro='';step=155;return botSay('Informe o galpão.');} if(step===155){botData.galpao=val;step=16;return botAsk('Possui coluna?',['Sim','Não']);} if(step===17){botData.coluna=val;step=18;return botAsk('Possui sala?',['Sim','Não']);} if(step===19){botData.sala=val;step=20;return botSay('Informe a referência/ponto de referência.');} if(step===20){botData.referencia=val;step=21;return botSay('Descreva a solicitação com detalhes.');} if(step===21){botData.descricao=val;return resumoBot();} }
function resumoBot(){ botSay(`<strong>Resumo:</strong><br>Tipo: ${botData.tipo}<br>Detalhe: ${botData.categoria||botData.ocorrencia||botData.acompanhamento||'-'}<br>Solicitante: ${botData.nome}<br>Registro: ${botData.registro}<br>Setor: ${botData.setor}<br>Galpão: ${botData.galpao||'-'}<br>Coluna: ${botData.coluna||'-'}<br>Sala: ${botData.sala||'-'}<br>Referência: ${botData.referencia||'-'}<br><br>Confirma o registro?`); $('chips').innerHTML="<button class='chip' onclick=\"salvarChamado('bot')\">Confirmar chamado</button><button class='chip' onclick=\"startBot()\">Corrigir / reiniciar</button>"; focusBotInput(); }
init();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
