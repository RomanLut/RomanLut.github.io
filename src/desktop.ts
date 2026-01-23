import { Taskbar } from './taskbar';
import { Notepad } from './notepad';
import { DesktopIcon } from './desktopIcon';
import { exitFullscreenAndOpen } from './util';
import { WordPad } from './WordPad';
import { Browser } from './browser';
import { FileExplorer } from './fileExplorer';
import { DosBox } from './dosbox';
import { Browser } from './browser';

export class Desktop {
  readonly element: HTMLElement;
  private taskbar: Taskbar;
  private intervalId: number | undefined;

  constructor(root: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'desktop';
    this.element.setAttribute('aria-hidden', 'true');

    this.taskbar = new Taskbar();
    this.element.appendChild(this.taskbar.element);

    this.spawnIcons();

    new FileExplorer(this.element, this.taskbar);

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

  private spawnIcons() {
    //new DesktopIcon(this.element, 'notepad', 'Notepad', { x: 16, y: 136 });
    new DesktopIcon(this.element, 'word', 'About me', { x: 16, y: 16 }, () =>
      new WordPad(this.element, this.taskbar, '/filesystem/About_me.md', 'About me')
    );
    new DesktopIcon(this.element, 'word', 'Resume', { x: 120, y: 16 });
    new DesktopIcon(this.element, 'word', 'Competitions', { x: 120 + 200, y: 16 });

    new DesktopIcon(this.element, 'folder', 'Game development', { x: 16, y: 136 }, () =>
      new FileExplorer(this.element, this.taskbar, 'Demoscene')
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

    // HTML5 demo: JS1k - Lost In A Cave
    new DesktopIcon(
      this.element,
      'html',
      'JS1k - Lost In A Cave',
      { x: 16 + 120*12, y: 16  },
      () => new Browser(this.element, this.taskbar, '/filesystem/Demoscene/2019-03_JS1k_Lost_In_A_Cave/Lost_In_A_Cave.html')
    );

    // Test MS-DOS launcher (executable type)
    new DesktopIcon(
      this.element,
      'msdos',
      'Fields of the Nephilims',
      { x: 16  + 120* 13, y: 16 },
      () => new DosBox(this.element, this.taskbar, 'Demoscene/1997-08_Fields_of_the_Nephilims/fields.zip')
    );
  }
}
