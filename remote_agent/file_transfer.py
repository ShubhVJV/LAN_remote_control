"""
Sandboxed, resumable file transfer service with SHA-256 verification.
"""

import os
import json
import uuid
import hashlib
from typing import List, Optional, Tuple
from shared.schemas import FileItem, DirectoryListing, FileUploadInitResponse, FileUploadStatusResponse

CHUNK_SIZE = 512 * 1024  # 512 KB chunks

class FileTransferManager:
    def __init__(self, shared_dirs: List[str]):
        self.shared_dirs = [os.path.abspath(d) for d in shared_dirs]
        for d in self.shared_dirs:
            os.makedirs(d, exist_ok=True)
            os.makedirs(os.path.join(d, ".transfers"), exist_ok=True)
        self.primary_dir = self.shared_dirs[0]

    def _get_transfers_dir(self) -> str:
        t_dir = os.path.join(self.primary_dir, ".transfers")
        os.makedirs(t_dir, exist_ok=True)
        return t_dir

    def resolve_safe_path(self, rel_path: str = "") -> str:
        """
        Resolve relative path against primary shared directory.
        Strictly prevents path traversal attacks outside sandboxed shared roots.
        """
        # Clean relative path
        cleaned = rel_path.strip().replace("\\", "/").lstrip("/")
        target = os.path.abspath(os.path.join(self.primary_dir, cleaned))

        # Check if target is inside primary_dir
        if not target.startswith(self.primary_dir):
            raise PermissionError("Access denied: Path is outside permitted shared directories.")

        return target

    def list_directory(self, rel_path: str = "") -> DirectoryListing:
        target_dir = self.resolve_safe_path(rel_path)
        if not os.path.exists(target_dir):
            raise FileNotFoundError(f"Directory not found: {rel_path}")
        if not os.path.isdir(target_dir):
            raise NotADirectoryError(f"Path is not a directory: {rel_path}")

        items: List[FileItem] = []
        for entry in os.scandir(target_dir):
            # Hide the internal .transfers folder
            if entry.name == ".transfers":
                continue
            try:
                stat = entry.stat()
                items.append(
                    FileItem(
                        name=entry.name,
                        path=os.path.relpath(entry.path, self.primary_dir).replace("\\", "/"),
                        is_dir=entry.is_dir(),
                        size=stat.st_size if entry.is_file() else 0,
                        modified=stat.st_mtime,
                    )
                )
            except OSError:
                continue

        # Sort: directories first, then alphabetically
        items.sort(key=lambda x: (not x.is_dir, x.name.lower()))
        current_rel = os.path.relpath(target_dir, self.primary_dir).replace("\\", "/")
        if current_rel == ".":
            current_rel = ""

        return DirectoryListing(current_path=current_rel, items=items)

    def init_upload(self, filename: str, rel_path: str, total_size: int, sha256: Optional[str] = None) -> FileUploadInitResponse:
        clean_filename = os.path.basename(filename)
        dest_dir = self.resolve_safe_path(rel_path)
        if not os.path.isdir(dest_dir):
            os.makedirs(dest_dir, exist_ok=True)

        target_file_path = os.path.join(dest_dir, clean_filename)

        # Check if there is an existing incomplete transfer for resumption
        transfers_dir = self._get_transfers_dir()
        existing_id = None
        already_received = 0

        for f in os.listdir(transfers_dir):
            if f.endswith(".json"):
                meta_path = os.path.join(transfers_dir, f)
                try:
                    with open(meta_path, "r", encoding="utf-8") as mf:
                        meta = json.load(mf)
                    if meta.get("target_path") == target_file_path and meta.get("total_size") == total_size:
                        tmp_file = os.path.join(transfers_dir, f"{meta['transfer_id']}.tmp")
                        if os.path.exists(tmp_file):
                            existing_id = meta["transfer_id"]
                            already_received = os.path.getsize(tmp_file)
                            break
                except Exception:
                    continue

        if existing_id:
            return FileUploadInitResponse(
                transfer_id=existing_id,
                chunk_size=CHUNK_SIZE,
                already_received_bytes=already_received,
                status="resuming"
            )

        transfer_id = str(uuid.uuid4())
        meta = {
            "transfer_id": transfer_id,
            "filename": clean_filename,
            "target_path": target_file_path,
            "total_size": total_size,
            "received_bytes": 0,
            "expected_sha256": sha256,
            "status": "in_progress",
        }

        meta_path = os.path.join(transfers_dir, f"{transfer_id}.json")
        with open(meta_path, "w", encoding="utf-8") as mf:
            json.dump(meta, mf)

        tmp_file = os.path.join(transfers_dir, f"{transfer_id}.tmp")
        # Touch empty file
        with open(tmp_file, "wb") as tf:
            pass

        return FileUploadInitResponse(
            transfer_id=transfer_id,
            chunk_size=CHUNK_SIZE,
            already_received_bytes=0,
            status="initialized"
        )

    def write_chunk(self, transfer_id: str, chunk_offset: int, data: bytes) -> int:
        transfers_dir = self._get_transfers_dir()
        meta_path = os.path.join(transfers_dir, f"{transfer_id}.json")
        tmp_file = os.path.join(transfers_dir, f"{transfer_id}.tmp")

        if not os.path.exists(meta_path) or not os.path.exists(tmp_file):
            raise FileNotFoundError(f"Transfer {transfer_id} not found.")

        with open(tmp_file, "r+b") as f:
            f.seek(chunk_offset)
            f.write(data)
            f.flush()

        current_size = os.path.getsize(tmp_file)
        with open(meta_path, "r", encoding="utf-8") as mf:
            meta = json.load(mf)

        meta["received_bytes"] = current_size
        with open(meta_path, "w", encoding="utf-8") as mf:
            json.dump(meta, mf)

        return current_size

    def get_transfer_status(self, transfer_id: str) -> FileUploadStatusResponse:
        transfers_dir = self._get_transfers_dir()
        meta_path = os.path.join(transfers_dir, f"{transfer_id}.json")
        tmp_file = os.path.join(transfers_dir, f"{transfer_id}.tmp")

        if not os.path.exists(meta_path):
            raise FileNotFoundError(f"Transfer {transfer_id} not found.")

        with open(meta_path, "r", encoding="utf-8") as mf:
            meta = json.load(mf)

        received = os.path.getsize(tmp_file) if os.path.exists(tmp_file) else 0
        total = meta.get("total_size", 0)

        return FileUploadStatusResponse(
            transfer_id=transfer_id,
            filename=meta.get("filename", ""),
            total_size=total,
            received_bytes=received,
            is_complete=(received >= total and total > 0),
            status=meta.get("status", "in_progress")
        )

    def complete_upload(self, transfer_id: str, expected_sha256: Optional[str] = None) -> Tuple[bool, str]:
        transfers_dir = self._get_transfers_dir()
        meta_path = os.path.join(transfers_dir, f"{transfer_id}.json")
        tmp_file = os.path.join(transfers_dir, f"{transfer_id}.tmp")

        if not os.path.exists(meta_path) or not os.path.exists(tmp_file):
            return False, "Transfer session does not exist."

        with open(meta_path, "r", encoding="utf-8") as mf:
            meta = json.load(mf)

        target_path = meta["target_path"]
        total_size = meta["total_size"]
        expected_hash = expected_sha256 or meta.get("expected_sha256")

        actual_size = os.path.getsize(tmp_file)
        if actual_size != total_size:
            return False, f"Size mismatch: expected {total_size} bytes, got {actual_size} bytes."

        # Compute SHA-256
        hasher = hashlib.sha256()
        with open(tmp_file, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        actual_hash = hasher.hexdigest()

        if expected_hash and actual_hash.lower() != expected_hash.lower():
            return False, f"Checksum mismatch: expected {expected_hash}, calculated {actual_hash}."

        # Atomically replace target
        if os.path.exists(target_path):
            try:
                os.remove(target_path)
            except Exception as e:
                return False, f"Failed to overwrite destination file: {e}"

        os.rename(tmp_file, target_path)

        # Cleanup metadata
        try:
            os.remove(meta_path)
        except Exception:
            pass

        return True, actual_hash

    def cancel_upload(self, transfer_id: str):
        transfers_dir = self._get_transfers_dir()
        meta_path = os.path.join(transfers_dir, f"{transfer_id}.json")
        tmp_file = os.path.join(transfers_dir, f"{transfer_id}.tmp")
        for p in (meta_path, tmp_file):
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

    def delete_file(self, rel_path: str):
        target = self.resolve_safe_path(rel_path)
        if not os.path.exists(target):
            raise FileNotFoundError(f"File not found: {rel_path}")
        if os.path.isdir(target):
            os.rmdir(target)
        else:
            os.remove(target)
