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
