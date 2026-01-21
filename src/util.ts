type StartParam = '1' | '2' | null;

export function setStartParam(value: StartParam) {
  const url = new URL(window.location.href);
  if (value) {
    url.searchParams.set('start', value);
  } else {
    url.searchParams.delete('start');
  }
  history.replaceState(null, '', url.toString());
}

export function setFullscreenParam(enabled: boolean) {
  const url = new URL(window.location.href);
  if (enabled) {
    url.searchParams.set('fullscreen', '1');
  } else {
    url.searchParams.delete('fullscreen');
  }
  history.replaceState(null, '', url.toString());
}

export function formatTime(now: Date = new Date()): string {
  const hh = String(now.getHours());
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDateLong(now: Date = new Date()): string {
  const weekday = now.toLocaleString('en-US', { weekday: 'long' });
  const month = now.toLocaleString('en-US', { month: 'long' });
  const day = now.getDate();
  return `${weekday}, ${month} ${day}`;
}

export function formatDateShort(now: Date = new Date()): string {
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}.${month}.${year}`;
}

export async function exitFullscreenAndOpen(url: string, target: string = '_blank') {
  const openLink = () => window.open(url, target, 'noopener');
  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch {
      // ignore failures to exit fullscreen
    }
  }
  openLink();
}

export function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function closeMenus(menuElement: HTMLElement | null | undefined) {
  if (!menuElement) return;
  menuElement.querySelectorAll('.is-open').forEach((el) => el.classList.remove('is-open'));
}

export function resolvePath(url: string, basePath: string) {
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('/')) {
    return url;
  }
  if (!basePath) return url;
  return basePath + url.replace(/^\.\//, '');
}

function getYouTubeEmbed(href: string): string | null {
  const match = href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (match) {
    const videoId = match[1];
    return `<iframe width="779" height="438" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  }
  return null;
}

export function applyInline(text: string, basePath: string) {
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
    const embed = getYouTubeEmbed(resolved);
    if (embed) {
      return tokenFor(embed);
    } else {
      return tokenFor(`<a href="${resolved}" target="_blank" rel="noreferrer noopener">${label}</a>`);
    }
  });

  t = t.replace(/`([^`]+)`/g, (_m, code) => tokenFor(`<code>${code}</code>`));
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  t = t.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  t = t.replace(/_([^_]+)_/g, '<em>$1</em>');

  t = t.replace(/@@INLINE_(\d+)@@/g, (_m, idx) => replacements[Number(idx)] ?? '');
  return t;
}

export function markdownToHtml(md: string, basePath: string) {
  const inlineCodes: string[] = [];
  // Handle triple-backtick inline snippets on the same line (no newlines) as inline code.
  md = md.replace(/```([^\n`]+)```/g, (_m, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(escapeHtml(code));
    return `@@INLINECODE_${idx}@@`;
  });

  const codeBlocks: string[] = [];
  md = md.replace(/```([\s\S]*?)```/g, (_m, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(escapeHtml(code.trim()));
    return `@@CODEBLOCK_${idx}@@`;
  });

  const lines = md.split(/\r?\n/);
  const parts: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let blockQuoteActive = false;
  let blockQuoteLines: string[] = [];

  const closeList = () => {
    if (listType) {
      parts.push(`</${listType}>`);
      listType = null;
    }
  };

  const closeBlockQuote = () => {
    if (blockQuoteActive) {
      parts.push(`<blockquote>${blockQuoteLines.join('<br/>')}</blockquote>`);
      blockQuoteActive = false;
      blockQuoteLines = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeList();
      closeBlockQuote();
      continue;
    }

    const hMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (hMatch) {
      closeList();
      closeBlockQuote();
      const level = hMatch[1].length;
      parts.push(`<h${level}>${applyInline(hMatch[2], basePath)}</h${level}>`);
      continue;
    }

    const blockquote = line.match(/^>\s?(.*)$/);
    if (blockquote) {
      closeList();
      blockQuoteActive = true;
      blockQuoteLines.push(applyInline(blockquote[1], basePath));
      continue;
    }

    const ul = line.match(/^[*-]\s+(.*)$/);
    if (ul) {
      if (listType !== 'ul') {
        closeList();
        closeBlockQuote();
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
        closeBlockQuote();
        listType = 'ol';
        parts.push('<ol>');
      }
      parts.push(`<li>${applyInline(ol[1], basePath)}</li>`);
      continue;
    }

    closeList();
    closeBlockQuote();
    parts.push(`<p>${applyInline(line, basePath)}</p>`);
  }
  closeList();
  closeBlockQuote();

  let html = parts.join('\n');
  html = html.replace(/@@CODEBLOCK_(\d+)@@/g, (_m, idx) => `<pre><code>${codeBlocks[Number(idx)]}</code></pre>`);
  html = html.replace(/@@INLINECODE_(\d+)@@/g, (_m, idx) => `<code>${inlineCodes[Number(idx)]}</code>`);
  return html;
}

export async function inlineImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;
      try {
        const res = await fetch(src);
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        img.setAttribute('src', dataUrl);
      } catch {
        /* ignore */
      }
    })
  );
}

// Filesystem helpers
export type FsItemType = 'folder' | 'wordpad';

export interface FsItem {
  type: FsItemType;
  name: string;
  path: string;
  image?: string;
  desc?: string;
  items?: FsItem[];
}

export interface FsRoot {
  items: FsItem[];
}

export function normalizeFsPath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '');
}

export function filesystemUrl(path: string): string {
  const clean = normalizeFsPath(path);
  return `/filesystem/${clean}`;
}

export function formatItemCount(count: number): string {
  return `${count} item(s)`;
}

export function formatSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 10) {
    return `${Math.round(kb)} KB`;
  }
  return `${Math.round(kb * 10) / 10} KB`;
}

export function responsiveWidth(base: number, ratio = 0.45): number {
  return Math.max(base, Math.floor(window.innerWidth * ratio));
}

export function findFolder(root: FsRoot, path: string): FsItem | null {
  const clean = normalizeFsPath(path);
  if (!clean) return { type: 'folder', name: '', path: '', items: root.items };
  const segments = clean.split('/');
  let current: FsItem | null = { type: 'folder', name: '', path: '', items: root.items };
  for (const segment of segments) {
    const next = current?.items?.find(
      (child) => child.type === 'folder' && normalizeFsPath(child.path).split('/').pop() === segment
    );
    if (!next) return null;
    current = next;
  }
  return current;
}

export async function loadFilesystem(url = '/filesystem/filesystem.json'): Promise<FsRoot> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load filesystem: HTTP ${res.status}`);
  }
  return (await res.json()) as FsRoot;
}
