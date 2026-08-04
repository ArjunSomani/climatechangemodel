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
  // Revoke on a later task, not synchronously. Chrome tolerates an immediate
  // revoke; Firefox and Safari may not have started reading the blob yet when
  // the synthetic click returns, and revoking first cancels the download with no
  // error anywhere. The URL is still released -- one tick later.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
