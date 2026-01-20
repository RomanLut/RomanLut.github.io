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
  escapeHtml
} from './util';
import { WordPad } from './WordPad';

const FILE_EXPLORER_ICON = getIconSvg('folder');

export class FileExplorer extends AppWindow {
  private desktopRef: HTMLElement;
  private taskbarRef: Taskbar;
  private toolbar: HTMLElement;
  private breadcrumb: HTMLElement;
  private content: HTMLElement;
  private meta: HTMLElement;
  private list: HTMLElement;
  private statusBar: AppWindowStatusBar;
  private tree: FsRoot | null = null;
  private currentPath = '';
  private upBtn: HTMLButtonElement | null = null;

  constructor(desktop: HTMLElement, taskbar: Taskbar) {
    super(desktop, taskbar, 'File Exporer', FILE_EXPLORER_ICON);
    this.desktopRef = desktop;
    this.taskbarRef = taskbar;

    this.element.style.width = '898px';
    this.element.style.height = '80vh';

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

    this.list = document.createElement('div');
    this.list.className = 'fileexplorer__list';

    this.statusBar = new AppWindowStatusBar('', '');
    this.statusBar.element.classList.add('fileexplorer__status');

    this.buildToolbar();
    this.content.appendChild(this.meta);
    this.content.appendChild(this.list);
    container.append(this.toolbar, this.content, this.statusBar.element);
    this.setContent(container);

    void this.loadTree();
  }

  private buildToolbar() {
    const backBtn = this.makeButton('←', 'Back (disabled)', true);
    const fwdBtn = this.makeButton('→', 'Forward (disabled)', true);

    this.upBtn = this.makeButton('↑', 'Up folder');
    this.upBtn.addEventListener('click', () => this.navigateUp());

    const crumbsWrapper = document.createElement('div');
    crumbsWrapper.className = 'fileexplorer__crumbs-wrapper';
    crumbsWrapper.appendChild(this.breadcrumb);

    this.toolbar.append(backBtn, fwdBtn, this.upBtn, crumbsWrapper);
  }

  private makeButton(label: string, title: string, disabled = false) {
    const btn = document.createElement('button');
    btn.className = 'fileexplorer__btn';
    btn.textContent = label;
    btn.title = title;
    btn.disabled = disabled;
    if (disabled) btn.classList.add('is-disabled');
    return btn;
  }

  private async loadTree() {
    try {
      this.statusBar.setText('Loading...');
      this.tree = await loadFilesystem();
      this.setFolder('');
    } catch (err) {
      this.statusBar.setText('Failed to load filesystem');
      this.list.innerHTML = `<div class="fileexplorer__error">${(err as Error).message}</div>`;
    }
  }

  private setFolder(path: string) {
    if (!this.tree) return;
    const folder = findFolder(this.tree, path);
    if (!folder || !folder.items) {
      this.statusBar.setText('Folder not found');
      return;
    }
    this.currentPath = normalizeFsPath(path);
    this.renderBreadcrumb();
    this.renderMeta(folder);
    this.renderItems(folder.items);
    this.statusBar.setText(formatItemCount(folder.items.length));
    this.updateUpButtonState();
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
      const paragraphs = folder.desc
        .replace(/\r\n/g, '\n')
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join('');
      descWrap.innerHTML = paragraphs || `<p>${escapeHtml(folder.desc)}</p>`;
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
      const iconType: IconType = item.type === 'folder' ? 'folder' : 'wordpad';
      iconHolder.innerHTML = getIconSvg(iconType);

      const label = document.createElement('div');
      label.className = 'fileexplorer__item-name';
      label.textContent = item.name;

      row.append(iconHolder, label);
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
    new WordPad(this.desktopRef, this.taskbarRef, url, item.name);
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
}
