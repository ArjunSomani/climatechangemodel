"""Upload JSON payloads to Vercel Blob via its REST API.

Used by both generate_library.py (offline library builds) and
run_worker.py (on-demand custom runs) so upload logic lives in one place
instead of being duplicated. Talks to Blob's REST API directly rather
than shelling out to the `vercel` CLI, since the worker needs to run on
a non-Vercel host (Render) where that CLI isn't available.
"""
import json

import requests

BLOB_API_URL = 'https://blob.vercel-storage.com'


def upload_json_blob(pathname: str, payload: object, rw_token: str) -> str:
    """Upload `payload` as a private JSON blob at `pathname`, returning its URL."""
    body = json.dumps(payload).encode('utf-8')
    resp = requests.put(
        f'{BLOB_API_URL}/{pathname}',
        data=body,
        headers={
            'authorization': f'Bearer {rw_token}',
            'x-api-version': '7',
            'x-content-type': 'application/json',
            'x-add-random-suffix': '0',
            'x-vercel-blob-access': 'private',
        },
        timeout=60,
    )
    if resp.status_code != 200:
        raise RuntimeError(f'Vercel Blob upload failed for {pathname}: {resp.status_code} {resp.text}')

    return resp.json()['url']


def delete_blobs(urls: list[str], rw_token: str) -> None:
    """Delete blobs by URL. Used by the mortality-library cleanup (rollback).

    No-op for an empty list. Raises on a non-2xx so callers can decide whether
    to treat orphaned blobs as fatal (usually they aren't -- a private blob with
    no catalog row pointing at it is invisible to the site)."""
    urls = [u for u in urls if u]
    if not urls:
        return
    resp = requests.post(
        f'{BLOB_API_URL}/delete',
        json={'urls': urls},
        headers={'authorization': f'Bearer {rw_token}', 'x-api-version': '7'},
        timeout=60,
    )
    if resp.status_code not in (200, 204):
        raise RuntimeError(f'Vercel Blob delete failed: {resp.status_code} {resp.text}')
