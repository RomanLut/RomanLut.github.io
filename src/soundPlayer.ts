import { AppWindow } from './appWindow';
import { getIconSvg } from './desktopIcon';
import { Taskbar } from './taskbar';
import { responsiveHeight, responsiveWidth } from './util';

type SoundTrack = {
  title: string;
  url: string;
  detail?: string;
};

const SOUND_ICON = getIconSvg('sound');

export class SoundPlayer extends AppWindow {
  private audio: HTMLAudioElement;
  private listEl: HTMLElement;
  private nowEl: HTMLElement;
  private tracks: SoundTrack[];
  private activeIndex = 0;

  constructor(desktop: HTMLElement, taskbar: Taskbar, tracks?: SoundTrack[]) {
    super(desktop, taskbar, 'Sound Player', SOUND_ICON);
    this.element.style.width = '780px';
    this.element.style.height = '280px';

    this.tracks = tracks?.length ? tracks : SoundPlayer.defaultTracks();

    const container = document.createElement('div');
    container.className = 'sound';

    this.nowEl = document.createElement('div');
    this.nowEl.className = 'sound__now';
    container.appendChild(this.nowEl);

    this.audio = document.createElement('audio');
    this.audio.controls = true;
    this.audio.className = 'sound__audio';
    container.appendChild(this.audio);

    this.listEl = document.createElement('div');
    this.listEl.className = 'sound__list';
    container.appendChild(this.listEl);

    this.setContent(container);

    this.audio.addEventListener('ended', () => this.playNext());
    this.audio.addEventListener('play', () => this.updateStatus('Playing'));
    this.audio.addEventListener('pause', () => this.updateStatus('Paused'));
    this.audio.addEventListener('loadedmetadata', () => this.updateStatus('Ready'));
    this.audio.addEventListener('timeupdate', () => this.updateProgress());

    this.renderList();
    this.loadTrack(this.activeIndex, false);
  }

  private static defaultTracks(): SoundTrack[] {
    return [
      {
        title: 'DVD streaming in games — KRI 2008 (Russian)',
        detail: 'Recorded talk · Ogg Vorbis',
        url: '/filesystem/Publications/2008-06-DVD_Streaming/KRI_2008_Programming_20apr_saturn_04_Lut_Roman_Deep_Shadows.ogg'
      }
    ];
  }

  private renderList() {
    this.listEl.innerHTML = '';
    this.tracks.forEach((track, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sound__track';
      if (idx === this.activeIndex) btn.classList.add('is-active');
      btn.innerHTML = `
        <div class="sound__track-title">${track.title}</div>
        ${track.detail ? `<div class="sound__track-detail">${track.detail}</div>` : ''}
      `;
      btn.addEventListener('click', () => this.loadTrack(idx, true));
      this.listEl.appendChild(btn);
    });
  }

  private loadTrack(index: number, autoplay: boolean) {
    if (!this.tracks[index]) return;
    this.activeIndex = index;
    this.audio.src = this.tracks[index].url;
    this.audio.currentTime = 0;
    this.nowEl.textContent = `Now playing: ${this.tracks[index].title}`;
    Array.from(this.listEl.children).forEach((child, idx) =>
      child.classList.toggle('is-active', idx === index)
    );
    if (autoplay) {
      void this.audio.play().catch(() => {
        this.updateStatus('Tap play to start');
      });
    } else {
      this.updateStatus('Ready');
    }
  }

  private playNext() {
    if (this.tracks.length <= 1) {
      this.audio.currentTime = 0;
      this.audio.pause();
      this.updateStatus('Paused');
      return;
    }
    const next = (this.activeIndex + 1) % this.tracks.length;
    this.loadTrack(next, true);
  }

  private updateProgress() {
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : null;
    const time = Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0;
    const prefix = !this.audio.paused ? 'Playing' : 'Paused';
    const suffix =
      duration && duration > 0
        ? `${this.formatTime(time)} / ${this.formatTime(duration)}`
        : this.formatTime(time);
    const title = this.tracks[this.activeIndex]?.title ?? '';
    this.nowEl.textContent = `${prefix}: ${title}${suffix ? ` — ${suffix}` : ''}`;
  }

  private updateStatus(message: string) {
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : null;
    const suffix = duration && duration > 0 ? this.formatTime(duration) : '';
    const title = this.tracks[this.activeIndex]?.title ?? '';
    this.nowEl.textContent = `${message}: ${title}${suffix ? ` — ${suffix}` : ''}`;
  }

  private formatTime(value: number) {
    if (!Number.isFinite(value) || value < 0) return '0:00';
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
