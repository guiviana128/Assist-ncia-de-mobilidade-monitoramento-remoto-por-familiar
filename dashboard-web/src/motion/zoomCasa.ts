import { Flip } from './gsap';

/**
 * Passagem "cômodo da planta → Casa 3D": o Início guarda o retângulo do cômodo tocado (Flip.getState)
 * e a Casa 3D, ao abrir, faz a vista crescer a partir dele (Flip, 400 ms). Vale uma vez só.
 */
let pendente: Flip.FlipState | null = null;

export const zoomCasa = {
  guardar(el: Element | null) {
    if (!el) return;
    el.setAttribute('data-flip-id', 'zoom-casa');
    pendente = Flip.getState(el);
    el.removeAttribute('data-flip-id');
  },
  /**
   * Devolve o estado guardado. Ele vale só para esta navegação e some em 1 s
   * (o StrictMode do desenvolvimento monta os efeitos duas vezes, e a segunda é a que fica).
   */
  retirar() {
    const s = pendente;
    if (s) window.setTimeout(() => { if (pendente === s) pendente = null; }, 1000);
    return s;
  }
};
