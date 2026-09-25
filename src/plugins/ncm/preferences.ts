export const loadLastNcmPlaylistUrl = () =>
  localStorage.getItem('toolbox_last_ncm_playlist_url') ?? 'https://music.163.com/playlist?id=784204124';

export const saveLastNcmPlaylistUrl = (url: string) =>
  localStorage.setItem('toolbox_last_ncm_playlist_url', url);
