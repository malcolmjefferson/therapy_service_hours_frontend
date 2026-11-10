/**
 * Hands `blob` to the browser as a file download named `filename`. The file is built in the page and saved from a
 * temporary object URL, so nothing is requested from any server (SEC-38).
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Some browsers start the save after the click returns, so the URL is released a moment later.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
