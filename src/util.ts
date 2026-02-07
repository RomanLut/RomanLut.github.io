import { Browser } from './browser';

type StartParam = '1' | '2' | null;

function updateQueryParam(name: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value) {
    url.searchParams.set(name, value);
  } else {
    url.searchParams.delete(name);
  }
  history.replaceState(null, '', url.toString());
}

function normalizeParamPath(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^\/+|\/+$/g, '');
}

export function setStartParam(value: StartParam) {
  updateQueryParam('start', value);
}

export function setFullscreenParam(enabled: boolean) {
  updateQueryParam('fullscreen', enabled ? '1' : null);
}

export function setMaximizedParam(enabled: boolean) {
  updateQueryParam('maximized', enabled ? '1' : null);
}

export function setFolderParam(path: string | null) {
  updateQueryParam('folder', normalizeParamPath(path));
}

export function setFileParam(path: string | null) {
  updateQueryParam('file', normalizeParamPath(path));
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

export function isIosDevice() {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

export function isMobileTouchDevice() {
  const ua = window.navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  return isIosDevice() || (isAndroid && window.navigator.maxTouchPoints > 0);
}

export function isTouchDevice() {
  return isMobileTouchDevice();
}

export async function exitFullscreenAndOpen(url: string, target: string = '_blank') {
  const openLink = () => window.open(url, target, 'noopener');
  //if (document.fullscreenElement && document.exitFullscreen) {
  if (document.exitFullscreen) {
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
  const stripPublic = (p: string) => p.replace(/^public[\\/]/i, '');

  // Normalise slashes and build a relative path against the markdown file location.
  const normalizedBase = basePath ? stripPublic(basePath).replace(/\\/g, '/') : '';
  let resolved = (normalizedBase || '') + url.replace(/^\.\//, '');
  resolved = stripPublic(resolved).replace(/\\/g, '/');

  // Serve from site root for in-app markdown files living under /public/.
  if (!resolved.startsWith('/')) {
    resolved = `/${resolved}`;
  }
  return resolved;
}

function getYouTubeEmbed(href: string): string | null {
  const match = href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (match) {
    const videoId = match[1];
    return `<iframe width="779" height="438" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  }
  return null;
}

// Use dash-delimited placeholders that won't be touched by emphasis regexes.
const INLINE_TOKEN = (idx: number) => `@@INLINE-${idx}@@`;
const RAWIMG_TOKEN = (idx: number) => `@@RAWIMG-${idx}@@`;
const INLINECODE_TOKEN = (idx: number) => `@@INLINECODE-${idx}@@`;
const CODEBLOCK_TOKEN = (idx: number) => `@@CODEBLOCK-${idx}@@`;

export function applyInline(text: string, basePath: string) {
  // Allow raw <img> tags (with resolved paths) before escaping.
  const rawImageTokens: string[] = [];
  const tokenForRawImg = (html: string) => {
    const idx = rawImageTokens.length;
    rawImageTokens.push(html);
    return RAWIMG_TOKEN(idx);
  };

  text = text.replace(/<img\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi, (match, src) => {
    const resolved = resolvePath(src, basePath);
    const alignMatch = match.match(/align\s*=\s*["']?\s*(left|right|center)\s*["']?/i);
    const align = alignMatch ? alignMatch[1].toLowerCase() : '';
    const alignClass = align ? ` align-${align}` : '';
    const wrapped = `<div class="wp-img${alignClass}">${match.replace(src, resolved)}</div>`;
    return tokenForRawImg(wrapped);
  });

  let t = escapeHtml(text);

  const replacements: string[] = [];
  const tokenFor = (html: string) => {
    const idx = replacements.length;
    replacements.push(html);
    return INLINE_TOKEN(idx);
  };

  // Protect links and images so italics/strong regexes do not modify URLs.
  // Images: allow ']' inside alt by matching up to the closing '](' sequence.
  t = t.replace(/!\[([\s\S]*?)\]\(([^)]+)\)/g, (_m, alt, src) => {
    const resolved = resolvePath(src, basePath);
    const embed = getYouTubeEmbed(resolved);
    if (embed) {
      return tokenFor(`<div class="wp-embed">${embed}</div>`);
    }
    return tokenFor(`<div class="wp-img"><img src="${resolved}" alt="${alt}" /></div>`);
  });
  // Links: same idea—stop at the closing '](' sequence to allow ']' inside label.
  t = t.replace(/\[([^\[]*)\]\(([^)]+)\)/g, (_m, label, href) => {
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
  // Safari iOS 15 does not support RegExp lookbehind; keep emphasis parsing without it.
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  t = t.replace(/_([^_]+)_/g, '<em>$1</em>');

  t = t.replace(/@@INLINE-(\d+)@@/g, (_m, idx) => replacements[Number(idx)] ?? '');
  t = t.replace(/@@RAWIMG-(\d+)@@/g, (_m, idx) => rawImageTokens[Number(idx)] ?? '');
  return t;
}

// Table parsing helpers
function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|');
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
  const cells = trimmed.slice(1, -1).split('|');
  return cells.every(cell => /^[\s:-]+$/.test(cell) && cell.includes('-'));
}

function parseTableRow(row: string): string[] {
  const trimmed = row.trim();
  return trimmed.slice(1, -1).split('|').map(cell => cell.trim());
}

function parseTable(headerRow: string, separatorRow: string, bodyRows: string[], basePath: string): string {
  const headerCells = parseTableRow(headerRow);
  const separatorCells = parseTableRow(separatorRow);

  // Determine alignment from separator
  const alignments = separatorCells.map(cell => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });

  let html = '<table><thead><tr>';
  headerCells.forEach((cell, i) => {
    const align = alignments[i] || 'left';
    html += `<th style="text-align:${align}">${applyInline(cell, basePath)}</th>`;
  });
  html += '</tr></thead><tbody>';

  for (const row of bodyRows) {
    const cells = parseTableRow(row);
    html += '<tr>';
    cells.forEach((cell, i) => {
      const align = alignments[i] || 'left';
      html += `<td style="text-align:${align}">${applyInline(cell, basePath)}</td>`;
    });
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

export function markdownToHtml(md: string, basePath: string) {
  const inlineCodes: string[] = [];
  // Handle triple-backtick inline snippets on the same line (no newlines) as inline code.
  md = md.replace(/```([^\n`]+)```/g, (_m, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(escapeHtml(code));
    return INLINECODE_TOKEN(idx);
  });

  const codeBlocks: string[] = [];
  md = md.replace(/```([\s\S]*?)```/g, (_m, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(escapeHtml(code.trim()));
    return CODEBLOCK_TOKEN(idx);
  });

  const lines = md.split(/\r?\n/);
  const parts: string[] = [];
  let listType: 'ul' | null = null;
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

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      closeList();
      closeBlockQuote();
      i++;
      continue;
    }

    // Check for table: current line is a table row and next line is a separator
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      closeList();
      closeBlockQuote();
      const headerRow = line;
      const separatorRow = lines[i + 1];
      const bodyRows: string[] = [];
      i += 2; // Skip header and separator
      // Collect body rows
      while (i < lines.length && isTableRow(lines[i])) {
        bodyRows.push(lines[i]);
        i++;
      }
      parts.push(parseTable(headerRow, separatorRow, bodyRows, basePath));
      continue;
    }

    const hMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (hMatch) {
      closeList();
      closeBlockQuote();
      const level = hMatch[1].length;
      parts.push(`<h${level}>${applyInline(hMatch[2], basePath)}</h${level}>`);
      i++;
      continue;
    }

    const blockquote = line.match(/^>\s?(.*)$/);
    if (blockquote) {
      closeList();
      blockQuoteActive = true;
      blockQuoteLines.push(applyInline(blockquote[1], basePath));
      i++;
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
      i++;
      continue;
    }

    closeList();
    closeBlockQuote();
    parts.push(`<p>${applyInline(line, basePath)}</p>`);
    i++;
  }
  closeList();
  closeBlockQuote();

  let html = parts.join('\n');
  html = html.replace(/@@CODEBLOCK-(\d+)@@/g, (_m, idx) => `<pre><code>${codeBlocks[Number(idx)]}</code></pre>`);
  html = html.replace(/@@INLINECODE-(\d+)@@/g, (_m, idx) => `<code>${inlineCodes[Number(idx)]}</code>`);
  // Safety net: if any inline placeholders survive (shouldn't), drop them so users don't see tokens.
  html = html.replace(/@@INLINE-(\d+)@@/g, '');
  html = html.replace(/@@RAWIMG-(\d+)@@/g, '');
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
export type FsItemType =
  | 'folder'
  | 'wordpad'
  | 'notepad'
  | 'archive'
  | 'executable'
  | 'html'
  | 'sound'
  | 'image'
  | 'github'
  | 'youtube';

export interface FsItem {
  type: FsItemType;
  name: string;
  path: string;
  url?: string;
  image?: string;
  desc?: string;
  items?: FsItem[];
  size?: number;
  reference?: string;
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
  const rounded = Math.round(kb * 10) / 10;
  const normalized = rounded > 0 ? rounded : 0.1;
  return `${normalized.toFixed(1)} KB`;
}

export function responsiveWidth(base: number, ratio = 0.45, viewportWidth: number = window.innerWidth): number {
  return Math.max(base, Math.floor(viewportWidth * ratio));
}

export function responsiveHeight(
  basePx: number,
  taskbarHeight: number,
  spawnY = 80,
  ratio = 0.9,
  viewportHeight: number = window.innerHeight
): number {
  const available = Math.floor(viewportHeight * ratio - taskbarHeight - spawnY);
  return Math.max(basePx, available);
}

export function isDownloadUrl(url: string): boolean {
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    return ['zip', 'exe', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rar', '7z', 'tar', 'gz', 'mp4', 'avi', 'mov', 'jpg', 'png', 'gif', 'txt', 'css', 'js'].includes(ext || '');
  } catch {
    return false;
  }
}

export function findFolder(root: FsRoot, path: string): FsItem | null {
  const clean = normalizeFsPath(path);
  if (!clean) return { type: 'folder', name: '', path: '', items: root.items };
  const segments = clean.split('/');
  let current: FsItem | null = { type: 'folder', name: '', path: '', items: root.items };
  for (const segment of segments) {
    const next: FsItem | undefined = current?.items?.find(
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

export async function navigateToUrl(desktop: HTMLElement, taskbar: any, url: string) {
  const isYouTubeWatchUrl = (candidate: URL) =>
    candidate.hostname.includes('youtube.com') && candidate.pathname === '/watch' && candidate.searchParams.has('v');
  const isYouTubeUrl = (candidate: URL) =>
    candidate.hostname.includes('youtube.com') || candidate.hostname.includes('youtu.be');

  try {
    const parsed = new URL(url, window.location.href);
    if (
      parsed.origin === window.location.origin &&
      (parsed.pathname === '/' || parsed.pathname === '') &&
      parsed.searchParams.has('folder')
    ) {
      const folder = parsed.searchParams.get('folder')?.trim();
      if (folder) {
        const { FileExplorer } = await import('./fileExplorer');
        new FileExplorer(desktop, taskbar, folder);
        return;
      }
    }

    if (isYouTubeUrl(parsed) && !isYouTubeWatchUrl(parsed)) {
      await exitFullscreenAndOpen(url);
      return;
    }
  } catch {
    // ignore malformed URLs
  }
  if (url.includes('dangerousprototypes.com') || url.includes('sparkfun.com') || url.includes('cxem.net')
      || url.includes('adafruit.com') || url.includes('github.com') || url.includes('steampowered') 
      || url.includes('hwp.ru') || url.includes('finconpro')) {
    await exitFullscreenAndOpen(url);
    return;
  }
  new Browser(desktop, taskbar, url);
}
