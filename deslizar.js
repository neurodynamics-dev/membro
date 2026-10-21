/* "Arraste para liberar" (2.19.2): o mesmo controle no tablet da sala e no celular.
   Soltar a sala pede um gesto inteiro, do começo ao fim do trilho: o toque sem querer não libera.
   Pelo teclado: as setas avançam o botão; Home e End vão às pontas; chegar ao fim confirma.
     deslizar(lugar, { rotulo:'Arraste para liberar', aoConfirmar: async () => {...} })
   devolve { reiniciar() }. */
(function(){
  function deslizar(lugar, op){
    const rot = op.rotulo || 'Arraste para liberar';
    lugar.innerHTML = `<div class="deslizar" data-deslizar>
      <span class="deslizar-rot">${rot}</span>
      <span class="deslizar-trilho" aria-hidden="true"></span>
      <button type="button" class="deslizar-bt" role="slider" aria-label="${rot}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button></div>`;
    const caixa = lugar.firstElementChild, bt = caixa.querySelector('.deslizar-bt'), trilho = caixa.querySelector('.deslizar-trilho');
    let x0 = 0, p = 0, arrastando = false, feito = false;
    const max = () => caixa.clientWidth - bt.offsetWidth - 8;
    const por = v => {
      p = Math.max(0, Math.min(1, v));
      bt.style.transform = `translateX(${Math.round(p * max())}px)`;
      trilho.style.width = `${Math.round(p * max()) + bt.offsetWidth / 2 + 4}px`;
      caixa.style.setProperty('--p', p);
      bt.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    };
    const voltar = () => { caixa.classList.add('volta'); por(0); setTimeout(() => caixa.classList.remove('volta'), 260); };
    async function confirmar(){
      if (feito) return; feito = true; por(1); caixa.classList.add('feito');
      try { await op.aoConfirmar(); }
      finally { feito = false; caixa.classList.remove('feito'); voltar(); }
    }
    bt.addEventListener('pointerdown', e => {
      if (feito) return; arrastando = true; x0 = e.clientX - p * max(); bt.setPointerCapture(e.pointerId); caixa.classList.add('ativo');
    });
    bt.addEventListener('pointermove', e => { if (arrastando) por((e.clientX - x0) / max()); });
    const fim = () => { if (!arrastando) return; arrastando = false; caixa.classList.remove('ativo'); p >= .88 ? confirmar() : voltar(); };
    bt.addEventListener('pointerup', fim); bt.addEventListener('pointercancel', fim);
    bt.addEventListener('keydown', e => {
      const passo = { ArrowRight:.25, ArrowUp:.25, ArrowLeft:-.25, ArrowDown:-.25 }[e.key];
      if (passo != null){ e.preventDefault(); por(p + passo); if (p >= 1) confirmar(); }
      else if (e.key === 'End'){ e.preventDefault(); confirmar(); }
      else if (e.key === 'Home'){ e.preventDefault(); voltar(); }
    });
    por(0);
    return { reiniciar: voltar };
  }
  window.deslizar = deslizar;
})();
