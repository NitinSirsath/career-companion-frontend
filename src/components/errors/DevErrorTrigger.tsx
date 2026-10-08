export function DevErrorTrigger() {
  if (!import.meta.env.DEV) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('__throw') === 'render') {
    throw new Error('Development render error trigger');
  }

  return null;
}
