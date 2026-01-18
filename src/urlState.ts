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
