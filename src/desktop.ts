import { Taskbar } from './taskbar';
import { DesktopIcon } from './desktopIcon';
import { exitFullscreenAndOpen, navigateToUrl, normalizeFsPath, filesystemUrl, setFileParam } from './util';
import { WordPad } from './WordPad';
import { FileExplorer } from './fileExplorer';
import { DosBox } from './dosbox';
import { Browser } from './browser';
import { SoundPlayer } from './soundPlayer';
import { Notepad } from './notepad';

const SOUND_EXTENSIONS = new Set(['mp3', 'ogg', 'wav', 'flac', 'm4a']);

export class Desktop {
  readonly element: HTMLElement;
  private taskbar: Taskbar;
  private intervalId: number | undefined;
  private queryParamsHandled = false;

  constructor(root: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'desktop';
    this.element.setAttribute('aria-hidden', 'true');

    this.taskbar = new Taskbar();
    this.element.appendChild(this.taskbar.element);
    const creditEl = document.createElement('div');
    creditEl.className = 'desktop__credit';
    creditEl.innerHTML = `
      <span>Roman Lut AKA hax</span>
      <span>Personal Page</span>
    `;
    this.element.appendChild(creditEl);

    this.spawnIcons();

//    new FileExplorer(this.element, this.taskbar);

//    new Notepad(this.element, this.taskbar);

//    new WordPad(this.element, this.taskbar, '/filesystem/test/markdown_test.md', 'Markdown Test');

//    new Browser(this.element, this.taskbar, 'https://www.google.com/?igu=1');

/*
    new WordPad(
      this.element,
      this.taskbar,
      '/filesystem/Electronics/Opto_isolated_AVR910/Opto_isolated_AVR910.md',
      'Opto-isolated AVR910'
    );
*/    
    
/*
    new WordPad(
      this.element,
      this.taskbar,
      '/filesystem/Publications/Using_webcamera_as_virtual_graphics_tablet/Using_webcamera_as_virtual_graphics_tablet.md',
      'Using webcamera as virtual graphics tablet.md'
    );    

    new WordPad(
      this.element,
      this.taskbar,
      '/filesystem/Publications/Driving_backlight_from_midlet/Drawing_backlight_from_midlet.md',
      'Drawing_backlight_from_midlet.md '
    );    
*/

/*
    new WordPad(
      this.element,
      this.taskbar,
      '/filesystem/Publications/CNC/DIY_CNC1/DIY_CNC1.md',
      'CNC1.md '
    );    
*/

    this.taskbar.onStart(() => this.spawnNotepad());

    root.prepend(this.element);

    this.applyQueryParams();
    this.updateClock();
    this.intervalId = window.setInterval(() => this.updateClock(), 5000);
  }

  private updateClock() {
    this.taskbar.updateClock();
  }

  destroy() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.element.remove();
  }

  private applyQueryParams() {
    if (this.queryParamsHandled) return;
    this.queryParamsHandled = true;
    const params = new URLSearchParams(window.location.search);
    const folderParam = params.get('folder');
    if (folderParam) {
      this.openExplorerForFolder(folderParam);
    }
    const fileParam = params.get('file');
    if (fileParam) {
      this.openFileFromPath(fileParam);
    }
  }

  private openExplorerForFolder(path: string) {
    const clean = normalizeFsPath(path);
    if (!clean) return;
    new FileExplorer(this.element, this.taskbar, clean);
  }

  private openFileFromPath(path: string) {
    const raw = path.trim();
    if (!raw) return;
    const isExternal = this.isExternalPath(raw);
    const clean = isExternal ? raw : this.normalizeLocalFileValue(raw);
    if (!clean) return;
    const filename = this.filenameFromValue(clean, isExternal);
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const url = isExternal ? clean : filesystemUrl(clean);
    this.setFileParamForDesktop(raw);
    if (ext === 'md' && !isExternal) {
      new WordPad(this.element, this.taskbar, url, filename);
      return;
    }
    if (!isExternal && (ext === 'txt' || ext === 'js')) {
      new Notepad(this.element, this.taskbar, filename, url);
      return;
    }
    if (SOUND_EXTENSIONS.has(ext)) {
      new SoundPlayer(this.element, this.taskbar, [{ title: filename, url }]);
      return;
    }
    new WordPad(this.element, this.taskbar, url, filename);
  }

  private filenameFromValue(value: string, isExternal: boolean) {
    if (!value) return '';
    if (isExternal) {
      try {
        const parsed = new URL(value);
        const name = parsed.pathname.split('/').filter(Boolean).pop();
        return name || value;
      } catch {
        return value;
      }
    }
    const cleaned = value.replace(/^\/+|\/+$/g, '');
    return cleaned.split('/').pop() || cleaned;
  }

  private isExternalPath(value: string) {
    return /^https?:\/\//i.test(value.trim());
  }

  private normalizeLocalFileValue(value: string) {
    const trimmed = value.trim().replace(/^\/+/, '');
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    const prefix = 'filesystem/';
    if (lower.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
    return trimmed;
  }

  private setFileParamForDesktop(value: string) {
    if (!value) {
      return;
    }
    if (this.isExternalPath(value)) {
      setFileParam(value);
      return;
    }
    const normalized = this.normalizeLocalFileValue(value);
    if (normalized) {
      setFileParam(normalized);
    }
  }

  private openWordPadFromDesktop(path: string, title?: string) {
    const relative = this.normalizeLocalFileValue(path);
    if (!relative) return;
    this.setFileParamForDesktop(relative);
    const url = filesystemUrl(relative);
    new WordPad(
      this.element,
      this.taskbar,
      url,
      title || this.filenameFromValue(relative, false) || 'Document'
    );
  }

  private openSoundPlayerFromDesktop(tracks: Array<{ title: string; detail?: string; url: string }>) {
    const firstUrl = tracks[0]?.url;
    if (firstUrl) {
      this.setFileParamForDesktop(firstUrl);
    }
    new SoundPlayer(this.element, this.taskbar, tracks);
  }

  private spawnIcons() {
    //new DesktopIcon(this.element, 'notepad', 'Notepad', { x: 16, y: 136 });
    new DesktopIcon(this.element, 'word', 'About me Roman Lut', { x: 16, y: 16 }, () =>
      this.openWordPadFromDesktop('/filesystem/About_me_Roman_Lut.md', 'About me Roman Lut')
    );
    new DesktopIcon(this.element, 'word', 'Resume Roman Lut', { x: 120, y: 16 }, () =>
      this.openWordPadFromDesktop('/filesystem/Resume_Roman_Lut.md', 'Resume me Roman Lut')
    );

    new DesktopIcon(this.element, 'word', 'Competitions and Events', { x: 120 + 200, y: 16 }, () =>
      this.openWordPadFromDesktop('/filesystem/Competitions_and_Events.md', 'Competitions and Events')
    );

    new DesktopIcon(this.element, 'folder', 'Game development', { x: 16, y: 136 }, () =>
      new FileExplorer(this.element, this.taskbar, 'Game_development')
    );
    new DesktopIcon(this.element, 'folder', 'Hobby projects', { x: 136 + 120, y: 136 }, () =>
      new FileExplorer(this.element, this.taskbar, 'Hobby_projects')
    );
    new DesktopIcon(this.element, 'folder', 'Electronics', { x: 136 + 120 + 120, y: 136 }, () =>
      new FileExplorer(this.element, this.taskbar, 'Electronics')
    );
    new DesktopIcon(this.element, 'folder', 'Demoscene', { x: 136, y: 136 }, () =>
      new FileExplorer(this.element, this.taskbar, 'Demoscene')
    );
    new DesktopIcon(this.element, 'folder', 'Publications', { x: 136 + 120 + 120 + 120, y: 136 }, () =>
      new FileExplorer(this.element, this.taskbar, 'Publications')
    );

    new DesktopIcon(this.element, 'folder', 'CNC', { x: 16, y: 136 + 120 }, () =>
      new FileExplorer(this.element, this.taskbar, 'CNC')
    );

    new DesktopIcon(this.element, 'github', 'My GitHub page', { x: 16, y: 16 + 120 + 120 + 140 }, () =>
      exitFullscreenAndOpen('https://github.com/RomanLut')
    );

    new DesktopIcon(this.element, 'youtube', 'My Youtube Channel', { x: 16 +120, y: 16 + 120 + 120 + 140 }, () =>
      exitFullscreenAndOpen('https://www.youtube.com/@RomanLutHax')
    );

    new DesktopIcon(
      this.element,
      'sound',
      'Sound Player',
      { x: 16 + 120 * 2, y: 16 + 120 + 120 + 140 },
      () =>
        this.openSoundPlayerFromDesktop([
          {
            title: 'Suno AI track',
            detail: 'Streaming mp3',
            url: 'https://cdn1.suno.ai/0b88c092-f093-4486-aac8-94b035118c4d.mp3'
          },
          {
            title: 'Suno AI track',
            detail: 'Streaming m4a',
            url: 'https://cdn1.suno.ai/71e3cc03-f01b-49c9-b1bd-3dc76c1095ed.m4a'
          },
          {
            title: 'Suno AI track',
            detail: 'Streaming m4a',
            url: 'https://cdn1.suno.ai/c05f8ddf-48de-4199-876c-3acd659a8e87.m4a'
          }
        ])
    );

    // HTML5 demo: JS1k - Lost In A Cave
    new DesktopIcon(
      this.element,
      'html',
      'JS1k - Lost In A Cave',
      { x: 16 + 120*12, y: 16  },
      () => navigateToUrl(this.element, this.taskbar, '/filesystem/Demoscene/2019-03_JS1k_Lost_In_A_Cave/Lost_In_A_Cave.html')
    );

    // Test MS-DOS launcher (executable type)
    new DesktopIcon(
      this.element,
      'msdos',
      'Fields of the Nephilims',
      { x: 16  + 120* 13, y: 16 },
      () => new DosBox(this.element, this.taskbar, 'Demoscene/1997-08_Fields_of_the_Nephilims/fields.zip')
    );

    new DesktopIcon(this.element, 'youtube', 'INAV HITL', { x: 16 +120*14, y: 16 }, () =>
      navigateToUrl(this.element, this.taskbar, 'https://www.youtube.com/watch?v=krTDi1tXGX8')
    );


    new DesktopIcon(this.element, 'github', 'hx_esp_now_rc', { x: 16 +120*11, y: 16 + 120 }, () =>
      exitFullscreenAndOpen('https://github.com/RomanLut/hx_espnow_rc')
    );

    new DesktopIcon(this.element, 'github', 'hx-esp32-cam-fpv', { x: 16 +120*12, y: 16 + 120 }, () =>
      exitFullscreenAndOpen('https://github.com/RomanLut/hx-esp32-cam-fpv')
    );


    new DesktopIcon(this.element, 'github', 'INAV-X-Plane-HITL', { x: 16 +120*13, y: 16 + 120 }, () =>
      exitFullscreenAndOpen('https://github.com/RomanLut/INAV-X-Plane-HITL')
    );


    new DesktopIcon(this.element, 'github', 'Telemetry Viewer', { x: 16 +120*14, y: 16 + 120 }, () =>
      exitFullscreenAndOpen('https://github.com/RomanLut/android-taranis-smartport-telemetry')
    );


    new DesktopIcon(this.element, 'youtube', 'Venom Intro', { x: 16 +120*13, y: 16 + 120*2 }, () =>
      navigateToUrl(this.element, this.taskbar, 'https://www.youtube.com/watch?v=E1SpT1WoZ5w')
    );

    new DesktopIcon(this.element, 'youtube', 'Venom gameplay', { x: 16 +120*14, y: 16 + 120*2 }, () =>
      navigateToUrl(this.element, this.taskbar, 'https://www.youtube.com/watch?v=9dHb_a4LRM4')
    );

    new DesktopIcon(this.element, 'youtube', 'Xenus gameplay', { x: 16 +120*12, y: 16 + 120*3 }, () =>
      navigateToUrl(this.element, this.taskbar, 'https://www.youtube.com/watch?v=MBV_Fxryj3Q')
    );

    new DesktopIcon(this.element, 'youtube', 'Xenus trailer', { x: 16 +120*13, y: 16 + 120*3 }, () =>
      navigateToUrl(this.element, this.taskbar, 'https://www.youtube.com/watch?v=PJcGcuDtDY8')
    );

    new DesktopIcon(this.element, 'youtube', 'Xenus 2: White Gold', { x: 16 +120*14, y: 16 + 120*3 }, () =>
      navigateToUrl(this.element, this.taskbar, 'https://www.youtube.com/watch?v=7-iWnISp4H4')
    );

    new DesktopIcon(this.element, 'youtube', 'Precursors', { x: 16 +120*12, y: 16 + 120*4 }, () =>
      navigateToUrl(this.element, this.taskbar, 'https://www.youtube.com/watch?v=Xt-sv4_Oe1I')
    );

    new DesktopIcon(this.element, 'youtube', 'Partisans prototype', { x: 16 +120*13, y: 16 + 120*4 }, () =>
      navigateToUrl(this.element, this.taskbar, 'https://www.youtube.com/watch?v=aA4gW7wgmsM')
    );

    new DesktopIcon(this.element, 'youtube', 'Optimizing Xenus 2', { x: 16 +120*14, y: 16 + 120*4 }, () =>
      navigateToUrl(this.element, this.taskbar, 'https://www.youtube.com/watch?v=DlsWMxvlhWE')
    );


  }
}
