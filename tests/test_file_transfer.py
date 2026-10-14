"""
Tests for Sandboxed, Resumable File Transfer with SHA-256 verification.
"""

import os
import shutil
import hashlib
import tempfile
import pytest
from remote_agent.file_transfer import FileTransferManager

@pytest.fixture
def temp_shared_dir():
    temp_dir = tempfile.mkdtemp(prefix="lan_test_shared_")
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)

def test_path_traversal_prevention(temp_shared_dir):
    manager = FileTransferManager([temp_shared_dir])

    # Legitimate path
    safe = manager.resolve_safe_path("documents/test.txt")
    assert safe.startswith(os.path.abspath(temp_shared_dir))

    # Path traversal attempts
    with pytest.raises(PermissionError):
        manager.resolve_safe_path("../secret.txt")

    with pytest.raises(PermissionError):
        manager.resolve_safe_path("../../windows/system32/cmd.exe")

    with pytest.raises(PermissionError):
        manager.resolve_safe_path("..")

def test_chunked_upload_and_sha256_verification(temp_shared_dir):
    manager = FileTransferManager([temp_shared_dir])

    # Create test payload
    data = b"Hello, this is a test payload for chunked LAN file transfer!" * 100
    total_size = len(data)
    expected_sha256 = hashlib.sha256(data).hexdigest()

    # 1. Init upload
    init_res = manager.init_upload("payload.bin", "", total_size, expected_sha256)
    transfer_id = init_res.transfer_id
    assert init_res.status == "initialized"

    # 2. Upload in 2 chunks
    mid = total_size // 2
    chunk1 = data[:mid]
    chunk2 = data[mid:]

    manager.write_chunk(transfer_id, 0, chunk1)
    status1 = manager.get_transfer_status(transfer_id)
    assert status1.received_bytes == len(chunk1)
    assert status1.is_complete is False

    manager.write_chunk(transfer_id, mid, chunk2)
    status2 = manager.get_transfer_status(transfer_id)
    assert status2.received_bytes == total_size
    assert status2.is_complete is True

    # 3. Complete and verify
    success, actual_hash = manager.complete_upload(transfer_id, expected_sha256)
    assert success is True
    assert actual_hash == expected_sha256

    # Verify final file exists on disk and content matches
    final_path = os.path.join(temp_shared_dir, "payload.bin")
    assert os.path.exists(final_path)
    with open(final_path, "rb") as f:
        assert f.read() == data

def test_interrupted_upload_and_resumption(temp_shared_dir):
    manager = FileTransferManager([temp_shared_dir])
    data = b"Part 1 Data... Part 2 Data..."
    total_size = len(data)

    # Init transfer
    init1 = manager.init_upload("resumable.bin", "", total_size)
    transfer_id = init1.transfer_id

    # Write first half
    half = len(data) // 2
    manager.write_chunk(transfer_id, 0, data[:half])

    # Simulate network disconnect: client re-initializes same file transfer
    init2 = manager.init_upload("resumable.bin", "", total_size)
    assert init2.transfer_id == transfer_id
    assert init2.status == "resuming"
    assert init2.already_received_bytes == half

    # Write remaining half from offset
    manager.write_chunk(transfer_id, half, data[half:])
    success, _ = manager.complete_upload(transfer_id)
    assert success is True

    final_path = os.path.join(temp_shared_dir, "resumable.bin")
    with open(final_path, "rb") as f:
        assert f.read() == data
