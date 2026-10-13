(() => {
  'use strict';
  document.querySelectorAll('.playbook-sharing').forEach(panel => {
    const url = panel.dataset.url;
    const title = panel.dataset.title;
    const status = panel.querySelector('.share-status');
    const copy = panel.querySelector('[data-copy-link]');
    const native = panel.querySelector('[data-native-share]');
    copy.hidden = false;
    copy.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard || !window.isSecureContext) {
          throw new Error('Clipboard unavailable');
        }
        await navigator.clipboard.writeText(url);
        status.textContent = 'Link copied. You can paste it into Instagram, a message, or any social post.';
      } catch (_) {
        status.textContent = 'Could not copy automatically. Copy this link: ' + url;
      }
    });
    if (typeof navigator.share === 'function') {
      native.hidden = false;
      native.addEventListener('click', async () => {
        try {
          await navigator.share({ title, text: title + ' by HubForge', url });
          status.textContent = 'Sharing options opened.';
        } catch (error) {
          if (error.name !== 'AbortError') {
            status.textContent = 'Could not open sharing options. Use a sharing link or Copy link.';
          }
        }
      });
    }
  });
})();
