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
