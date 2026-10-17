// Expiring a notice must not rebuild or cancel an in-flight diary editor.
export function createToast(document, render, timers = globalThis) {
  let text = '', timer;
  return {
    get text() { return text; },
    show(message) {
      timers.clearTimeout(timer);
      text = message;
      render();
      timer = timers.setTimeout(() => {
        text = '';
        document.querySelector('.toast')?.remove();
      }, 4500);
    },
  };
}
