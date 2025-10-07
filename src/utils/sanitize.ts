// DOMPurifyでのサニタイズ関係
import DOMPurify from 'dompurify';

// フック設定を一度だけ実行
let initialized = false;

export function initializeDOMPurify() {
  if (initialized) return;
  
  DOMPurify.addHook('beforeSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('target')) {
      node.setAttribute('data-temp-target', node.getAttribute('target')!);
    }
  });

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('data-temp-target')) {
      const t = node.getAttribute('data-temp-target')!;
      node.setAttribute('target', t);
      node.setAttribute('rel', 'noopener noreferrer');
      node.removeAttribute('data-temp-target');
    }
  });
  
  initialized = true;
}

export function sanitizeHtml(html: string): string {
  initializeDOMPurify();
  return DOMPurify.sanitize(html);
}