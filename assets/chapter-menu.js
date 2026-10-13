(() => {
  'use strict';
  document.querySelectorAll('details.chapter-menu').forEach(menu => {
    const summary = menu.querySelector('summary');
    function close(restoreFocus) {
      menu.open = false;
      if (restoreFocus) summary.focus({ preventScroll: true });
    }
    menu.addEventListener('click', event => {
      if (event.target.closest('.navlinks a')) close(true);
    });
    document.addEventListener('click', event => {
      if (menu.open && !menu.contains(event.target)) close(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) {
        close(true);
        event.preventDefault();
      }
    });
  });
})();
