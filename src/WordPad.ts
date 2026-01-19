import { AppWindow } from './appWindow';
import { Taskbar } from './taskbar';
import { AppWindowMenu, type MenuItem } from './appWindowMenu';
import { AppWindowStatusBar } from './appWindowStatusBar';

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolvePath(url: string, basePath: string) {
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('/')) {
    return url;
  }
  if (!basePath) return url;
  return basePath + url.replace(/^\.\//, '');
}

function applyInline(text: string, basePath: string) {
  let t = escapeHtml(text);

  const replacements: string[] = [];
  const tokenFor = (html: string) => {
    const idx = replacements.length;
    replacements.push(html);
    return `@@INLINE_${idx}@@`;
  };

  // Protect links and images so italics/strong regexes do not modify URLs.
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) =>
    tokenFor(`<img src="${resolvePath(src, basePath)}" alt="${alt}" />`)
  );
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const resolved = resolvePath(href, basePath);
    return tokenFor(`<a href="${resolved}" target="_blank" rel="noreferrer noopener">${label}</a>`);
  });

  t = t.replace(/`([^`]+)`/g, (_m, code) => tokenFor(`<code>${code}</code>`));
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  t = t.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  t = t.replace(/_([^_]+)_/g, '<em>$1</em>');

  t = t.replace(/@@INLINE_(\d+)@@/g, (_m, idx) => replacements[Number(idx)] ?? '');
  return t;
}

function markdownToHtml(md: string, basePath: string) {
  const codeBlocks: string[] = [];
  md = md.replace(/```([\s\S]*?)```/g, (_m, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(escapeHtml(code.trim()));
    return `@@CODEBLOCK_${idx}@@`;
  });

  const lines = md.split(/\r?\n/);
  const parts: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listType) {
      parts.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }

    const hMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (hMatch) {
      closeList();
      const level = hMatch[1].length;
      parts.push(`<h${level}>${applyInline(hMatch[2], basePath)}</h${level}>`);
      continue;
    }

    const blockquote = line.match(/^>\s?(.*)$/);
    if (blockquote) {
      closeList();
      parts.push(`<blockquote>${applyInline(blockquote[1], basePath)}</blockquote>`);
      continue;
    }

    const ul = line.match(/^[*-]\s+(.*)$/);
    if (ul) {
      if (listType !== 'ul') {
        closeList();
        listType = 'ul';
        parts.push('<ul>');
      }
      parts.push(`<li>${applyInline(ul[1], basePath)}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (listType !== 'ol') {
        closeList();
        listType = 'ol';
        parts.push('<ol>');
      }
      parts.push(`<li>${applyInline(ol[1], basePath)}</li>`);
      continue;
    }

    closeList();
    parts.push(`<p>${applyInline(line, basePath)}</p>`);
  }
  closeList();

  let html = parts.join('\n');
  html = html.replace(/@@CODEBLOCK_(\d+)@@/g, (_m, idx) => `<pre><code>${codeBlocks[Number(idx)]}</code></pre>`);
  return html;
}

const WORDPAD_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <rect x="4" y="3" width="16" height="18" rx="2" fill="#ffffff" stroke="#d0d6e0" stroke-width="1"/>
  <rect x="7" y="6" width="6.8" height="2" rx="1" fill="#2d7df6"/>
  <path d="M7 10h10v1H7zm0 3h10v1H7zm0 3h7v1H7z" fill="#2d7df6"/>
  <circle cx="17.5" cy="17.5" r="4" fill="#2d7df6"/>
  <path d="M17.5 13.5v4h4a4 4 0 0 0-4-4Z" fill="#8fb7ff"/>
</svg>`;

export class WordPad extends AppWindow {
  private status: AppWindowStatusBar;
  private contentArea: HTMLElement;
  private markdownText = '';

  constructor(desktop: HTMLElement, taskbar: Taskbar, filePath: string, title?: string) {
    super(
      desktop,
      taskbar,
      title || WordPad.titleFromPath(filePath),
      WORDPAD_ICON
    );

    const container = document.createElement('div');
    container.className = 'wordpad';

    const menuItems: MenuItem[] = [{ label: 'File' }, { label: 'View' }, { label: 'Help' }];
    const menu = new AppWindowMenu(menuItems);
    menu.element.classList.add('wordpad__menu');

    this.contentArea = document.createElement('div');
    this.contentArea.className = 'wordpad__content';

    this.status = new AppWindowStatusBar('Line 1 / 1', '');
    this.status.element.classList.add('wordpad__status');

    container.appendChild(menu.element);
    container.appendChild(this.contentArea);
    container.appendChild(this.status.element);

    this.setContent(container);
    this.loadFile(filePath);
    this.contentArea.addEventListener('scroll', () => this.updateStatus());

    this.element.style.width = '880px';
    this.element.style.height = '80vh';
  }

  private static titleFromPath(path: string) {
    const clean = path.split('/').pop() || path;
    return clean;
  }

  private async loadFile(path: string) {
    try {
      const res = await fetch(path);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      this.markdownText = await res.text();
      const basePath = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      const html = markdownToHtml(this.markdownText, basePath);
      this.contentArea.innerHTML = html;
      this.updateStatus();
    } catch (err) {
      this.contentArea.innerHTML = `<div class="wordpad__error">Failed to load file: ${escapeHtml(String(err))}</div>`;
      this.status.setText('Error');
    }
  }

  private updateStatus() {
    if (!this.markdownText) {
      this.status.setText('Line 1 / 1');
      return;
    }
    const totalLines = Math.max(1, this.markdownText.split(/\r?\n/).length);
    const scrollable = this.contentArea.scrollHeight - this.contentArea.clientHeight;
    const ratio = scrollable > 0 ? this.contentArea.scrollTop / scrollable : 0;
    const currentLine = Math.max(1, Math.floor(ratio * (totalLines - 1)) + 1);
    this.status.setText(`Line ${currentLine} / ${totalLines}`);
  }
}
