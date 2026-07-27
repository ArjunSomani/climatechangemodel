// Client-only: turn an in-memory string into a downloaded file. Shared by the
// results export (RunDownload) and the scenario-config save/load
// (ConfigSaveLoad) so the object-URL lifecycle lives in exactly one place.
export function triggerDownload(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
