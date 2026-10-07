/* Archivo (OFL), fontes locais e métricas do mesmo arquivo usado na impressão. */
(function(){
 if(window.FontesPDF)return;
 const base=new URL('fontes/',document.currentScript.src);let promessa;
 const arquivos=[['normal','400-normal'],['bold','700-normal'],['italic','400-italic'],['bolditalic','700-italic']];
 window.FontesPDF={async carregar(){return promessa ||= Promise.all(arquivos.map(async([estilo,nome])=>{const r=await fetch(new URL(`archivo-${nome}.ttf`,base));if(!r.ok)throw new Error('Fonte de impressão indisponível.');const bytes=new Uint8Array(await r.arrayBuffer());let bin='';for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));return {estilo,nome,dados:btoa(bin)};})).catch(e=>{promessa=null;throw e;});},registrar(doc,dados){for(const f of dados){doc.addFileToVFS(f.nome+'.ttf',f.dados);doc.addFont(f.nome+'.ttf','Archivo',f.estilo);}doc.setFont('Archivo','normal');}};
})();
