/* NRO DS 3.0.0, gerado de brand/design-system/select.js. Não edite aqui: edite no brand e rode scripts/distribuir.mjs. */
/* Progressive select enhancement. Native value/change and form submission remain authoritative. */
(()=>{
 const controls=new Map();let active=null,seq=0,queued=false;
 const close=()=>{if(!active)return;active.list.remove();active.button.setAttribute('aria-expanded','false');active=null;};
 function position(c){const r=c.button.getBoundingClientRect();c.list.style.minWidth=Math.min(r.width,innerWidth-16)+'px';c.list.style.width='max-content';c.list.style.maxWidth=Math.min(440,innerWidth-16)+'px';const lw=c.list.offsetWidth||r.width;c.list.style.left=Math.max(8,Math.min(r.left,innerWidth-lw-8))+'px';c.list.style.top=Math.min(r.bottom+4,innerHeight-100)+'px';c.list.style.maxHeight=Math.max(80,Math.min(280,innerHeight-r.bottom-12))+'px';}
 function draw(c){
  c.list.replaceChildren();
  [...c.select.options].forEach((o,i)=>{
   const b=document.createElement('button');b.type='button';b.role='option';b.dataset.index=i;b.textContent=o.text;
   b.setAttribute('aria-selected',String(o.selected));b.disabled=o.disabled||o.parentElement.disabled;
   b.onclick=()=>{if(c.select.multiple)o.selected=!o.selected;else c.select.value=o.value;
    c.select.dispatchEvent(new Event('input',{bubbles:true}));c.select.dispatchEvent(new Event('change',{bubbles:true}));
    if(c.select.multiple){draw(c);c.list.querySelector(`[data-index="${i}"]`)?.focus();}else{close();c.button.focus();}sync(c);};
   c.list.append(b);
  });
 }
 function open(c){close();if(c.select.matches(':disabled'))return;active=c;draw(c);document.body.append(c.list);position(c);c.button.setAttribute('aria-expanded','true');(c.list.querySelector('[aria-selected="true"]:not(:disabled)')||c.list.querySelector('button:not(:disabled)'))?.focus();}
 function sync(c){
  const text=[...c.select.selectedOptions].map(x=>x.text).join(', ')||'Selecionar';if(c.button.textContent!==text)c.button.textContent=text;
  const disabled=c.select.matches(':disabled');if(c.button.disabled!==disabled)c.button.disabled=disabled;
  const label=c.select.getAttribute('aria-label')||[...c.select.labels||[]].map(x=>x.textContent.trim()).join(' ')||'Selecionar';
  if(c.button.getAttribute('aria-label')!==label)c.button.setAttribute('aria-label',label);
 }
 function enhance(){queued=false;
  for(const [s,c] of controls){if(!s.isConnected){if(active===c)close();controls.delete(s);}else sync(c);}
  document.querySelectorAll('select:not([data-nro-select])').forEach(s=>{
   if(s.hidden||s.closest('[hidden]'))return;
   /* o embrulho herda o tamanho que o CSS dava ao select (flex, largura cheia, mínimo), senão encolhe até o texto */
   const cs=getComputedStyle(s),pai=s.parentElement,cheio=pai&&s.offsetWidth>0&&s.offsetWidth>=pai.clientWidth-parseFloat(getComputedStyle(pai).paddingLeft||0)-parseFloat(getComputedStyle(pai).paddingRight||0)-2;
   const wrap=document.createElement('span');wrap.className='nro-select';
   if(cs.flexGrow!=='0')wrap.style.flex=cs.flexGrow+' '+cs.flexShrink+' '+cs.flexBasis;
   if(cs.minWidth&&cs.minWidth!=='auto'&&cs.minWidth!=='0px')wrap.style.minWidth=cs.minWidth;
   if(cheio||s.style.width==='100%')wrap.style.width='100%';else if(s.style.width)wrap.style.width=s.style.width;
   s.before(wrap);wrap.append(s);
   /* a medida: as opções empilhadas, invisíveis, dão ao botão a largura da maior, como no select nativo */
   const medida=document.createElement('span');medida.className='nro-select-medida';medida.setAttribute('aria-hidden','true');
   [...s.options].forEach(o=>{const d=document.createElement('span');d.textContent=o.text;medida.append(d);});wrap.append(medida);
   s.dataset.nroSelect='';s.tabIndex=-1;
   const button=document.createElement('button');button.type='button';button.className='nro-select-button';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
   const list=document.createElement('div');list.className='nro-select-list';list.role='listbox';list.id='nro-list-'+(++seq);button.setAttribute('aria-controls',list.id);if(s.multiple)list.setAttribute('aria-multiselectable','true');
   const c={select:s,button,list};controls.set(s,c);wrap.append(button);sync(c);
   button.onclick=()=>active===c?close():open(c);button.onkeydown=e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();open(c);}};
   s.addEventListener('change',()=>sync(c));
   list.onkeydown=e=>{const options=[...list.querySelectorAll('button:not(:disabled)')];const at=options.indexOf(document.activeElement);let next;
    if(e.key==='Escape'){e.preventDefault();close();button.focus();return;}
    if(e.key==='Tab'){close();button.focus();return;}
    if(e.key==='ArrowDown')next=(at+1)%options.length;if(e.key==='ArrowUp')next=(at-1+options.length)%options.length;
    if(e.key==='Home')next=0;if(e.key==='End')next=options.length-1;
    if(next!==undefined){e.preventDefault();options[next]?.focus();}else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey){const found=options.find((o,i)=>i>at&&o.textContent.toLocaleLowerCase().startsWith(e.key.toLocaleLowerCase()))||options.find(o=>o.textContent.toLocaleLowerCase().startsWith(e.key.toLocaleLowerCase()));found?.focus();}
   };
  });
 }
 const schedule=()=>{if(!queued){queued=true;queueMicrotask(enhance);}};
 document.addEventListener('pointerdown',e=>{if(active&&!active.list.contains(e.target)&&!active.button.contains(e.target))close();});
 document.addEventListener('click',e=>{const l=e.target.closest('label');const s=l?.control;if(s&&controls.has(s)){e.preventDefault();controls.get(s).button.focus();}});
 window.addEventListener('resize',()=>active&&position(active));document.addEventListener('scroll',()=>active&&position(active),true);
 new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','selected','hidden']});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();
