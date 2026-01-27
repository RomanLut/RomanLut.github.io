import { AppWindow } from './appWindow';
import { Taskbar } from './taskbar';
import { AppWindowStatusBar } from './appWindowStatusBar';
import { getIconSvg, type IconType } from './desktopIcon';
import {
  type FsItem,
  type FsRoot,
  findFolder,
  formatItemCount,
  filesystemUrl,
  loadFilesystem,
  normalizeFsPath,
  applyInline,
  formatSize,
  responsiveWidth,
  responsiveHeight
} from './util';
import { WordPad } from './WordPad';
import { Notepad } from './notepad';
import { DosBox } from './dosbox';
import { Browser } from './browser';
import { SoundPlayer } from './soundPlayer';

const FILE_EXPLORER_ICON = getIconSvg('folder');

export class FileExplorer extends AppWindow {
  private desktopRef: HTMLElement;
  private taskbarRef: Taskbar;
  private toolbar: HTMLElement;
  private breadcrumb: HTMLElement;
  private content: HTMLElement;
  private meta: HTMLElement;
  private list: HTMLElement;
  private listHeader: HTMLElement;
  private sizeHeader: HTMLElement;
  private backBtn: HTMLButtonElement;
  private fwdBtn: HTMLButtonElement;
  private statusBar: AppWindowStatusBar;
  private tree: FsRoot | null = null;
  private currentPath = '';
  private upBtn: HTMLButtonElement | null = null;
  private history: string[] = [''];
  private historyIndex = 0;

  constructor(desktop: HTMLElement, taskbar: Taskbar, startPath = '') {
    super(desktop, taskbar, 'File Exporer', FILE_EXPLORER_ICON);
    this.desktopRef = desktop;
    this.taskbarRef = taskbar;

    const baseWidth = 898;
    this.element.style.width = `${responsiveWidth(baseWidth)}px`;
    const taskbarHeight = this.taskbarRef.element.getBoundingClientRect().height || 0;
    const baseHeight = Math.floor(window.innerHeight * 0.7);
    this.element.style.height = `${responsiveHeight(baseHeight, taskbarHeight)}px`;

    const container = document.createElement('div');
    container.className = 'fileexplorer';

    this.toolbar = document.createElement('div');
    this.toolbar.className = 'fileexplorer__toolbar';

    this.breadcrumb = document.createElement('div');
    this.breadcrumb.className = 'fileexplorer__crumbs';

    this.content = document.createElement('div');
    this.content.className = 'fileexplorer__content';

    this.meta = document.createElement('div');
    this.meta.className = 'fileexplorer__meta';

    this.listHeader = document.createElement('div');
    this.listHeader.className = 'fileexplorer__list-header';
    const nameHeader = document.createElement('div');
    nameHeader.className = 'fileexplorer__list-col fileexplorer__list-col--name';
    nameHeader.textContent = 'Name';

    this.sizeHeader = document.createElement('div');
    this.sizeHeader.className = 'fileexplorer__list-col fileexplorer__list-col--size';
    this.sizeHeader.textContent = 'Size';

    this.listHeader.append(nameHeader, this.sizeHeader);

    this.list = document.createElement('div');
    this.list.className = 'fileexplorer__list';

    this.statusBar = new AppWindowStatusBar('', '');
    this.statusBar.element.classList.add('fileexplorer__status');

    this.buildToolbar();
    this.content.appendChild(this.meta);
    this.content.appendChild(this.listHeader);
    this.content.appendChild(this.list);
    container.append(this.toolbar, this.content, this.statusBar.element);
    this.setContent(container);

    void this.loadTree(startPath);
  }

  private buildToolbar() {
    this.backBtn = this.makeButton('←', 'Back', true);
    this.fwdBtn = this.makeButton('→', 'Forward', true);
    this.backBtn.addEventListener('click', () => this.goBack());
    this.fwdBtn.addEventListener('click', () => this.goForward());

    this.upBtn = this.makeButton('↑', 'Up folder');
    this.upBtn.addEventListener('click', () => this.navigateUp());

    const crumbsWrapper = document.createElement('div');
    crumbsWrapper.className = 'fileexplorer__crumbs-wrapper';
    crumbsWrapper.appendChild(this.breadcrumb);

    this.toolbar.append(this.backBtn, this.fwdBtn, this.upBtn, crumbsWrapper);
  }

  private makeButton(label: string, title: string, disabled = false) {
    const btn = document.createElement('button');
    btn.className = 'fileexplorer__btn';
    if (label === '↑') {
      btn.classList.add('up');
    }
    const span = document.createElement('span');
    span.textContent = label;
    btn.appendChild(span);
    btn.title = title;
    btn.disabled = disabled;
    if (disabled) btn.classList.add('is-disabled');
    return btn;
  }

  private async loadTree(startPath: string) {
    try {
      this.statusBar.setText('Loading...');
      this.tree = await loadFilesystem();
      const initial = normalizeFsPath(startPath);
      this.history = [initial];
      this.historyIndex = 0;
      if (!this.setFolder(initial, false)) {
        this.history = [''];
        this.historyIndex = 0;
        this.setFolder('', false);
      }
    } catch (err) {
      this.statusBar.setText('Failed to load filesystem');
      this.list.innerHTML = `<div class="fileexplorer__error">${(err as Error).message}</div>`;
    }
  }

  private setFolder(path: string, pushHistory = true) {
    if (!this.tree) return false;
    const folder = findFolder(this.tree, path);
    if (!folder || !folder.items) {
      this.statusBar.setText('Folder not found');
      return false;
    }
    const clean = normalizeFsPath(path);
    if (pushHistory) {
      if (clean === this.currentPath) {
        return true;
      }
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(clean);
      this.historyIndex = this.history.length - 1;
    }
    this.currentPath = clean;
    this.renderBreadcrumb();
    this.renderMeta(folder);
    this.renderItems(folder.items);
    this.statusBar.setText(formatItemCount(folder.items.length));
    this.updateUpButtonState();
    this.updateNavButtons();
    return true;
  }

  private renderBreadcrumb() {
    this.breadcrumb.innerHTML = '';
    const segments = this.currentPath ? this.currentPath.split('/') : [];
    const addSeparator = () => {
      const sep = document.createElement('span');
      sep.className = 'fileexplorer__crumb-sep';
      sep.textContent = '>';
      this.breadcrumb.appendChild(sep);
    };
    addSeparator();
    segments.forEach((seg, idx) => {
      const btn = document.createElement('button');
      btn.className = 'fileexplorer__crumb';
      btn.textContent = seg.replace(/_/g, ' ');
      btn.addEventListener('click', () => {
        const newPath = segments.slice(0, idx).join('/');
        this.setFolder(newPath);
      });
      this.breadcrumb.appendChild(btn);
      if (idx < segments.length - 1) addSeparator();
    });
  }

  private renderMeta(folder: FsItem) {
    this.meta.innerHTML = '';
    const hasImage = !!folder.image;
    const hasDesc = !!folder.desc;
    this.meta.classList.toggle('is-visible', hasImage || hasDesc);
    if (!hasImage && !hasDesc) return;

    if (hasImage) {
      const imgWrap = document.createElement('div');
      imgWrap.className = 'fileexplorer__meta-image';
      const img = document.createElement('img');
      img.src = filesystemUrl(`${folder.path}/${folder.image}`);
      img.alt = folder.name;
      imgWrap.appendChild(img);
      this.meta.appendChild(imgWrap);
    }

    if (hasDesc) {
      const descWrap = document.createElement('div');
      descWrap.className = 'fileexplorer__meta-desc';
      const lines = folder.desc.replace(/\r\n/g, '\n').split('\n');
      let html = '';
      let first = true;
      let prevBlank = false;
      for (const line of lines) {
        const isBlank = !line.trim();
        if (isBlank) {
          if (prevBlank) continue; // collapse multiple blank lines
          html += '<br/>';
          prevBlank = true;
          continue;
        }
        if (!first) html += '<br/>';
        html += applyInline(line, '');
        first = false;
        prevBlank = false;
      }
      descWrap.innerHTML = html;
      // Open description links inside the Browser app instead of the same tab.
      descWrap.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        const link = target?.closest('a') as HTMLAnchorElement | null;
        if (!link) return;
        const hrefAttr = link.getAttribute('href') || '';
        if (hrefAttr.startsWith('#')) return; // allow in-page anchors
        e.preventDefault();
        e.stopPropagation();
        const url = hrefAttr || link.href;
        new Browser(this.desktopRef, this.taskbarRef, url);
      });
      this.meta.appendChild(descWrap);
    }
  }

  private renderItems(items: FsItem[]) {
    this.list.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'fileexplorer__empty';
      empty.textContent = 'Empty folder';
      this.list.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'fileexplorer__item';
      const iconHolder = document.createElement('div');
      iconHolder.className = 'fileexplorer__item-icon';
      const iconType: IconType =
        item.type === 'folder'
          ? 'folder'
          : item.type === 'notepad'
          ? 'notepad'
          : item.type === 'archive'
          ? 'archive'
          : item.type === 'executable'
          ? 'msdos'
          : item.type === 'html'
          ? 'html'
          : item.type === 'sound'
          ? 'sound'
          : 'wordpad';
      iconHolder.innerHTML = getIconSvg(iconType);

      const label = document.createElement('div');
      label.className = 'fileexplorer__item-name';
      label.textContent = item.name;

      const sizeEl = document.createElement('div');
      sizeEl.className = 'fileexplorer__item-size';
      sizeEl.textContent = typeof (item as any).size === 'number' ? formatSize((item as any).size) : '';

      row.append(iconHolder, label, sizeEl);
      row.addEventListener('dblclick', () => this.handleItemClick(item));
      this.list.appendChild(row);
    });
  }

  private handleItemClick(item: FsItem) {
    if (item.type === 'folder') {
      this.setFolder(item.path);
      return;
    }
    const url = filesystemUrl(item.path);
    switch (item.type) {
      case 'notepad':
        new Notepad(this.desktopRef, this.taskbarRef, item.name, url);
        return;
      case 'archive': {
        // Archives are download-only; even ZIPs should trigger save dialog.
        this.downloadFile(url, item.path);
        return;
      }
      case 'executable': {
        const exeName = DosBox.guessExeName(item.path);
        new DosBox(this.desktopRef, this.taskbarRef, item.path, exeName);
        return;
      }
      case 'html': {
        new Browser(this.desktopRef, this.taskbarRef, url);
        return;
      }
      case 'sound': {
        new SoundPlayer(this.desktopRef, this.taskbarRef, [{ title: item.name, url }]);
        return;
      }
      default:
        new WordPad(this.desktopRef, this.taskbarRef, url, item.name);
        return;
    }
  }

  private downloadFile(url: string, path: string) {
    const filename = path.split('/').pop() || 'download';
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  private navigateUp() {
    if (!this.currentPath) return;
    const segments = this.currentPath.split('/');
    segments.pop();
    this.setFolder(segments.join('/'));
  }

  private updateUpButtonState() {
    const upBtn = this.upBtn;
    if (!upBtn) return;
    const disabled = !this.currentPath;
    upBtn.disabled = disabled;
    upBtn.classList.toggle('is-disabled', disabled);
  }

  private goBack() {
    if (this.historyIndex <= 0) return;
    this.historyIndex -= 1;
    const target = this.history[this.historyIndex];
    this.setFolder(target, false);
    this.updateNavButtons();
  }

  private goForward() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex += 1;
    const target = this.history[this.historyIndex];
    this.setFolder(target, false);
    this.updateNavButtons();
  }

  private updateNavButtons() {
    const canBack = this.historyIndex > 0;
    const canFwd = this.historyIndex < this.history.length - 1;
    this.backBtn.disabled = !canBack;
    this.fwdBtn.disabled = !canFwd;
    this.backBtn.classList.toggle('is-disabled', !canBack);
    this.fwdBtn.classList.toggle('is-disabled', !canFwd);
  }
}
