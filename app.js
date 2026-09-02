const $ = id => document.getElementById(id);
const API_URL = window.GSP_CONFIG?.SCRIPT_URL || '';
const diretorias = ['Brand Marketing','Commercial Fiat','Comercial Jeep','Compras','Comunicação Corporativa','Customer Care','Customer Jeep','Customer Experience','Desenvolvimento de Rede','Design','Engenharia','Fiat Brand','Finance','HR & Transformation','ICT','Industrial','Jeep Brand','Jurídico','Manufatura','Mopar','Parts e Services','Portfolio','Presidência','Produto','Qualidade','Recursos Humanos','Supply Chain','Outra'];
const categorias = ['Equipamento','Material de construção (entulho)','Material diversos','Protótipo','Vasilhames','Outros'];
const ocorrencias = ['Acidente','Agressão física','Avaria em peças / vasilhames','Dano material','Danos às instalações industriais','Demissão','Desaparecimento','Emergência','Entrada com danos','Erro operacional','Furto em área externa','Furto em área interna','Incêndio','Irregularidade','Roubo ou furto','Sintomas de embriaguez','Trânsito','Outros'];
const acompanhamentos = ['Apoio operacional','Acompanhamento de terceiros','Acompanhamento de veículo','Acompanhamento de material','Acompanhamento em área interna','Acompanhamento em área externa','Outros'];
let page = 0;
let botData = {};
let step = 0;
let salvandoChamado = false;
let deferredInstallPrompt = null;

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
  showModal('Instalar aplicativo', 'No Chrome, toque no menu ⋮ e escolha <strong>Instalar app</strong>. Se aparecer apenas “Adicionar à tela inicial”, atualize a página e tente novamente após alguns segundos.', '⬇️', true);
}
function fillSelect(id,arr){ const el=$(id); if(el) el.innerHTML='<option value="">Selecione</option>'+arr.map(x=>`<option>${x}</option>`).join(''); }
function init(){
  fillSelect('diretoria',diretorias); fillSelect('categoria',categorias); fillSelect('ocorrencia',ocorrencias); fillSelect('acompanhamento',acompanhamentos);
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) { const b=$('installBtn'); if(b)b.classList.add('hidden'); }
  renderSteps(); onTipoChange(); toggleRamal(); toggleEmpresa(); toggleColuna(); toggleSala();
}
function go(id,btn){ document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); $(id).classList.add('active'); document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active')); if(btn)btn.classList.add('active'); window.scrollTo({top:0,behavior:'smooth'}); if(id==='view-form') setTimeout(focusFirstVisible,180); }
function renderSteps(){ const names=['Tipo','Solicitante','Empresa','Local','Final']; $('stepbar').innerHTML=names.map((n,i)=>`<div class="step ${i===page?'active':i<page?'done':''}">${i+1}. ${n}</div>`).join(''); document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',Number(p.dataset.page)===page)); $('btnPrev').classList.toggle('hidden',page===0); $('btnNext').classList.toggle('hidden',page===4); $('btnSalvar').classList.toggle('hidden',page!==4); if(page===4) $('resumoFinal').innerHTML=montarResumo(); setTimeout(focusFirstVisible,80); }
function prevPage(){ if(page>0){ page--; renderSteps(); } }
function nextPage(){ if(validatePage(page)){ page++; renderSteps(); } }
function focusFirstVisible(){ const el=[...document.querySelectorAll('.page.active input,.page.active select,.page.active textarea')].find(e=>!e.closest('.hidden')&&!e.disabled); if(el) el.focus({preventScroll:true}); }
function nextFocus(el){ setTimeout(()=>{ const inputs=[...document.querySelectorAll('.page.active input,.page.active select,.page.active textarea')].filter(e=>!e.closest('.hidden')&&!e.disabled); const i=inputs.indexOf(el); if(i>=0&&inputs[i+1]) inputs[i+1].focus({preventScroll:false}); },80); }
function fieldValue(f){ const el=f.querySelector('input,select,textarea'); return el?String(el.value||'').trim():''; }
function validatePage(pg){ let ok=true; document.querySelectorAll(`.page[data-page="${pg}"] .field[data-required]`).forEach(f=>{ if(f.closest('.hidden')){f.classList.remove('invalid');return;} const valid=!!fieldValue(f); f.classList.toggle('invalid',!valid); if(!valid) ok=false; }); if(!ok){ const first=document.querySelector('.page.active .field.invalid input,.page.active .field.invalid select,.page.active .field.invalid textarea'); if(first) first.focus(); showModal('Atenção','Preencha os campos obrigatórios destacados.','⚠️',true); } return ok; }
function onTipoChange(){ const t=$('tipo').value; ['categoriaBox','ocorrenciaBox','acompanhamentoBox'].forEach(id=>$(id).classList.add('hidden')); $('categoria').value=''; $('ocorrencia').value=''; $('acompanhamento').value=''; if(t==='Conferência') $('categoriaBox').classList.remove('hidden'); if(t==='Boletim de Ocorrência') $('ocorrenciaBox').classList.remove('hidden'); if(t==='Acompanhamento') $('acompanhamentoBox').classList.remove('hidden'); }
function toggleRamal(){ const sim=$('possuiRamal').value==='Sim'; $('ramalBox').classList.toggle('hidden',!sim); if(!sim)$('ramal').value='Não possui'; else if($('ramal').value==='Não possui')$('ramal').value=''; }
function toggleEmpresa(){ const ter=$('tipoEmpresa').value==='Terceiro'; $('terceiraBox').classList.toggle('hidden',!ter); $('diretoriaBox').classList.toggle('hidden',ter); if(ter){$('diretoria').value='';$('outraDiretoria').value='';} toggleOutraDiretoria(); }
function toggleOutraDiretoria(){ const outra=$('diretoria').value==='Outra'&&!$('diretoriaBox').classList.contains('hidden'); $('outraDiretoriaBox').classList.toggle('hidden',!outra); if(!outra)$('outraDiretoria').value=''; }
function toggleColuna(){ const sim=$('possuiColuna').value==='Sim'; $('colunaBox').classList.toggle('hidden',!sim); if(!sim)$('coluna').value='Não possui'; else if($('coluna').value==='Não possui')$('coluna').value=''; }
function toggleSala(){ const sim=$('possuiSala').value==='Sim'; $('salaBox').classList.toggle('hidden',!sim); if(!sim)$('sala').value='Não possui'; else if($('sala').value==='Não possui')$('sala').value=''; }
function formData(){ const tipo=$('tipo').value; const ter=$('tipoEmpresa').value==='Terceiro'; return {acao:'criar',tipo,prioridade:$('prioridade').value,origem:'Solicitante',nome:$('nome').value.trim(),registro:$('registro').value.trim(),telefone:$('telefone').value.trim(),possuiRamal:$('possuiRamal').value,ramal:$('possuiRamal').value==='Sim'?$('ramal').value.trim():'Não possui',tipoEmpresa:$('tipoEmpresa').value,diretoria:ter?'':$('diretoria').value,outraDiretoria:$('diretoria').value==='Outra'?$('outraDiretoria').value.trim():'',empresa:ter?$('terceira').value.trim():'Stellantis',setor:$('setor').value.trim(),liderNome:$('liderNome').value.trim(),liderRegistro:$('liderRegistro').value.trim(),galpao:$('galpao').value.trim(),possuiColuna:$('possuiColuna').value,coluna:$('possuiColuna').value==='Sim'?$('coluna').value.trim():'Não possui',possuiSala:$('possuiSala').value,sala:$('possuiSala').value==='Sim'?$('sala').value.trim():'Não possui',referencia:$('referencia').value.trim(),categoria:tipo==='Conferência'?$('categoria').value:'',ocorrencia:tipo==='Boletim de Ocorrência'?$('ocorrencia').value:'',acompanhamento:tipo==='Acompanhamento'?$('acompanhamento').value:'',descricao:$('descricao').value.trim()}; }
function montarResumo(){ const c=formData(); return `<strong>Resumo:</strong><br>Tipo: ${c.tipo||'-'}<br>Detalhe: ${c.categoria||c.ocorrencia||c.acompanhamento||'-'}<br>Solicitante: ${c.nome||'-'} / ${c.registro||'-'}<br>Empresa: ${c.empresa||'-'} ${c.diretoria?'- '+c.diretoria:''}<br>Setor: ${c.setor||'-'}<br>Local: Galpão ${c.galpao||'-'}, Coluna ${c.coluna||'-'}, Sala ${c.sala||'-'}<br>Referência: ${c.referencia||'-'}`; }
async function parseJsonResponse(r){ const txt=await r.text(); try{return JSON.parse(txt);}catch(e){ if(txt.trim().startsWith('<')) throw new Error('O Apps Script retornou uma página HTML. Verifique se a implantação está como Qualquer pessoa e se o link /exec está atualizado.'); throw new Error(txt.slice(0,180)||e.message); } }
async function apiCriarChamado(payload){ const url=API_URL+'?acao=criarGet&_='+Date.now()+'&dados='+encodeURIComponent(JSON.stringify(payload)); const r=await fetch(url,{method:'GET',cache:'no-store'}); return await parseJsonResponse(r); }
function msgWhats(c){ return `*NOVA SOLICITAÇÃO GSP*\n\n*Chamado:* ${c.id}\n*Status:* ${c.status||'Recebido'}\n*Tipo:* ${c.tipo}\n*Detalhe:* ${c.categoria||c.ocorrencia||c.acompanhamento||'-'}\n*Prioridade:* ${c.prioridade}\n\n*Solicitante:* ${c.nome}\n*Registro:* ${c.registro}\n*Telefone:* ${c.telefone||'-'}\n*Ramal:* ${c.ramal||'-'}\n\n*Empresa:* ${c.empresa||'-'}\n*Diretoria:* ${c.diretoria||'-'}\n*Outra diretoria:* ${c.outraDiretoria||'-'}\n*Setor/Área:* ${c.setor||'-'}\n*Líder:* ${c.liderNome||'-'} / ${c.liderRegistro||'-'}\n\n*Local:* Galpão ${c.galpao||'-'}, Coluna ${c.coluna||'-'}, Sala ${c.sala||'-'}\n*Referência:* ${c.referencia||'-'}\n\n*Descrição:* ${c.descricao}`; }
async function salvarChamado(origem){
  if(salvandoChamado) return;
  if(origem==='manual'){ for(let i=0;i<5;i++){ if(!validatePage(i)){page=i;renderSteps();return;} } }
  const c = origem==='bot' ? {...botData,acao:'criar',origem:'Bot GSP'} : formData();
  salvandoChamado=true; const btn=$('btnSalvar'); if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  let janela=null; try{janela=window.open('about:blank','_blank');}catch(e){}
  showModal('Registrando chamado','Aguarde, salvando na planilha Google...','⏳',false);
  try{
    const res=await apiCriarChamado(c);
    if(!res.sucesso) throw new Error(res.mensagem||'Falha ao salvar na planilha.');
    c.id=res.id||res.idChamado; c.status=res.status||'Recebido';
    if(!c.id) throw new Error('A planilha salvou, mas não retornou o número do chamado.');
    localStorage.setItem('ultimoChamadoGsp',c.id);
    showModal('Chamado registrado',`Número: <strong>${c.id}</strong><br>Aguarde, abrindo WhatsApp...`,'✅',true);
    const url='whatsapp://send?text='+encodeURIComponent(msgWhats(c)); if(janela) janela.location.href=url; else window.location.href=url;
  }catch(e){ if(janela)janela.close(); showModal('Erro ao salvar',String(e.message||e),'❌',true); }
  finally{ salvandoChamado=false; if(btn){btn.disabled=false;btn.textContent='Registrar chamado';} }
}
async function consultarStatus(){ const id=$('consultaId').value.trim(); if(!id) return showModal('Atenção','Informe o número do chamado.','⚠️'); $('statusResultado').innerHTML='<div class="status-box loading">Consultando...</div>'; try{ const r=await fetch(API_URL+'?acao=consultar&id='+encodeURIComponent(id)+'&_='+Date.now(),{cache:'no-store'}); const res=await parseJsonResponse(r); if(!res.sucesso) throw new Error(res.mensagem||'Chamado não encontrado.'); const c=res.chamado; $('statusResultado').innerHTML=`<div class="status-box"><strong>${c.ID_CHAMADO}</strong><br>Status: <strong>${c.STATUS||'-'}</strong><br>Tipo: ${c.TIPO_SOLICITACAO||'-'}<br>Atualização: ${new Date(c.DATA_HORA_ATUALIZACAO).toLocaleString('pt-BR')}</div>`; }catch(e){ $('statusResultado').innerHTML=`<div class="status-box">${e.message}</div>`; } }
function limparForm(){ document.querySelectorAll('#formSolicitacao input,#formSolicitacao textarea').forEach(i=>i.value=''); $('tipo').value=''; $('tipoEmpresa').value='Stellantis'; $('possuiRamal').value='Não'; $('possuiColuna').value='Sim'; $('possuiSala').value='Não'; page=0; onTipoChange(); toggleEmpresa(); toggleRamal(); toggleColuna(); toggleSala(); document.querySelectorAll('.field.invalid').forEach(f=>f.classList.remove('invalid')); renderSteps(); }
function showModal(title,msg,icon='ℹ️',ok=true){ document.querySelectorAll('.modal-backdrop').forEach(m=>m.remove()); const d=document.createElement('div'); d.className='modal-backdrop'; d.innerHTML=`<div class="modal"><h3>${icon} ${title}</h3><p>${msg}</p>${ok?'<div class="actions"><button class="btn" onclick="this.closest(\'.modal-backdrop\').remove()">OK</button></div>':''}</div>`; document.body.appendChild(d); }
function botSay(t){ const m=$('messages'); m.insertAdjacentHTML('beforeend',`<div class="msg botmsg">${t}</div>`); m.scrollTop=m.scrollHeight; return Promise.resolve(); }
function userSay(t){ const m=$('messages'); m.insertAdjacentHTML('beforeend',`<div class="msg usermsg">${t}</div>`); m.scrollTop=m.scrollHeight; }
function botAsk(t,opts,fn='botChoose'){ botSay(t); $('chips').innerHTML=opts.map(o=>`<button class="chip" onclick="${fn}('${String(o).replace(/'/g,"\\'")}')">${o}</button>`).join(''); }
function startBot(){ botData={}; step=1; $('messages').innerHTML=''; $('botInput').value=''; botAsk('Qual tipo de solicitação?',['Conferência','Acompanhamento','Boletim de Ocorrência']); }
function botChoose(v){ userSay(v); $('chips').innerHTML=''; if(step===1){botData.tipo=v;step=2;return botAsk('Agora selecione o detalhe correspondente.',v==='Conferência'?categorias:v==='Boletim de Ocorrência'?ocorrencias:acompanhamentos);} if(step===2){if(botData.tipo==='Conferência')botData.categoria=v;else if(botData.tipo==='Boletim de Ocorrência')botData.ocorrencia=v;else botData.acompanhamento=v;step=3;return botAsk('Qual a prioridade?',['Normal','Urgente','Emergencial']);} if(step===3){botData.prioridade=v;step=4;return botSay('Informe o nome do solicitante.');} if(step===7){botData.possuiRamal=v;if(v==='Sim'){step=8;return botSay('Informe o ramal.');}botData.ramal='Não possui';step=9;return botAsk('Tipo de empresa?',['Stellantis','Terceiro']);} if(step===9){botData.tipoEmpresa=v;if(v==='Stellantis'){botData.empresa='Stellantis';step=10;return botAsk('Selecione a diretoria.',diretorias);}step=12;return botSay('Informe a empresa terceirizada.');} if(step===10){botData.diretoria=v;if(v==='Outra'){step=11;return botSay('Digite a outra diretoria.');}step=13;return botSay('Informe o setor/área.');} if(step===16){botData.possuiColuna=v;if(v==='Sim'){step=17;return botSay('Informe a coluna.');}botData.coluna='Não possui';step=18;return botAsk('Possui sala?',['Sim','Não']);} if(step===18){botData.possuiSala=v;if(v==='Sim'){step=19;return botSay('Informe a sala.');}botData.sala='Não possui';step=20;return botSay('Informe a referência/ponto de referência.');} }
function botText(){ const val=$('botInput').value.trim(); if(!val)return; $('botInput').value=''; userSay(val); if(step===4){botData.nome=val;step=5;return botSay('Informe o registro/crachá do solicitante.');} if(step===5){botData.registro=val;step=6;return botSay('Informe telefone ou contato.');} if(step===6){botData.telefone=val;step=7;return botAsk('Possui ramal?',['Sim','Não']);} if(step===8){botData.ramal=val;step=9;return botAsk('Tipo de empresa?',['Stellantis','Terceiro']);} if(step===11){botData.outraDiretoria=val;step=13;return botSay('Informe o setor/área.');} if(step===12){botData.empresa=val;botData.diretoria='';step=13;return botSay('Informe o setor/área.');} if(step===13){botData.setor=val;step=14;return botSay('Informe o nome do líder Stellantis, se houver. Se não houver, digite Não possui.');} if(step===14){botData.liderNome=val;step=15;return botSay('Informe o registro do líder Stellantis. Se não houver, digite Não possui.');} if(step===15){botData.liderRegistro=val;step=155;return botSay('Informe o galpão.');} if(step===155){botData.galpao=val;step=16;return botAsk('Possui coluna?',['Sim','Não']);} if(step===17){botData.coluna=val;step=18;return botAsk('Possui sala?',['Sim','Não']);} if(step===19){botData.sala=val;step=20;return botSay('Informe a referência/ponto de referência.');} if(step===20){botData.referencia=val;step=21;return botSay('Descreva a solicitação com detalhes.');} if(step===21){botData.descricao=val;return resumoBot();} }
function resumoBot(){ botSay(`<strong>Resumo:</strong><br>Tipo: ${botData.tipo}<br>Detalhe: ${botData.categoria||botData.ocorrencia||botData.acompanhamento||'-'}<br>Solicitante: ${botData.nome}<br>Registro: ${botData.registro}<br>Setor: ${botData.setor}<br>Galpão: ${botData.galpao||'-'}<br>Coluna: ${botData.coluna||'-'}<br>Sala: ${botData.sala||'-'}<br>Referência: ${botData.referencia||'-'}<br><br>Confirma o registro?`); $('chips').innerHTML='<button class="chip" onclick="salvarChamado(\'bot\')">Confirmar chamado</button><button class="chip" onclick="startBot()">Corrigir / reiniciar</button>'; }
init();
