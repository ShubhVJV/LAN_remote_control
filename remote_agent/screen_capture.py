"""
Screen capture service using mss and Pillow.
"""

import io
import time
import threading
from typing import Optional, Tuple
from PIL import Image

try:
    from mss import MSS
    def get_sct():
        return MSS()
except (ImportError, AttributeError):
    import mss
    def get_sct():
        return mss.mss()

class ScreenCaptureService:
    def __init__(self, fps: int = 15, quality: int = 70, scale: float = 0.75):
        self.fps = fps
        self.quality = quality
        self.scale = scale
        self.running = False
        self.thread: Optional[threading.Thread] = None

        self._lock = threading.Lock()
        self._latest_jpeg: Optional[bytes] = None
        self._latest_time: float = 0
        self._screen_width: int = 1920
        self._screen_height: int = 1080
        self._actual_fps: float = 0.0

        self._subscriber_count = 0

    def start_streaming(self):
        with self._lock:
            self._subscriber_count += 1
            if not self.running:
                self.running = True
                self.thread = threading.Thread(target=self._capture_loop, daemon=True)
                self.thread.start()

    def stop_streaming(self):
        with self._lock:
            self._subscriber_count = max(0, self._subscriber_count - 1)
            if self._subscriber_count == 0 and self.running:
                self.running = False

    def get_screen_dimensions(self) -> Tuple[int, int]:
        return self._screen_width, self._screen_height

    def get_latest_frame(self) -> Tuple[Optional[bytes], float, int, int, float]:
        """Returns (jpeg_bytes, timestamp, width, height, actual_fps)."""
        with self._lock:
            return self._latest_jpeg, self._latest_time, self._screen_width, self._screen_height, self._actual_fps

    def _capture_loop(self):
        print(f"[ScreenCapture] Capture loop started at target {self.fps} FPS")
        frame_interval = 1.0 / max(1, self.fps)
        sct = None
        frame_count = 0
        fps_calc_time = time.time()

        try:
            sct = get_sct()
            # Primary monitor is index 1 if multiple, otherwise index 0
            monitor = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
            self._screen_width = monitor["width"]
            self._screen_height = monitor["height"]

            target_width = max(320, int(self._screen_width * self.scale))
            target_height = max(240, int(self._screen_height * self.scale))

            while self.running:
                start_time = time.time()

                try:
                    sct_img = sct.grab(monitor)
                    # Convert BGRA to RGB
                    img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")

                    if self.scale != 1.0:
                        img = img.resize((target_width, target_height), Image.Resampling.BILINEAR)

                    buf = io.BytesIO()
                    img.save(buf, format="JPEG", quality=self.quality, optimize=False)
                    jpeg_data = buf.getvalue()

                    now = time.time()
                    with self._lock:
                        self._latest_jpeg = jpeg_data
                        self._latest_time = now

                    frame_count += 1
                    if now - fps_calc_time >= 1.0:
                        with self._lock:
                            self._actual_fps = round(frame_count / (now - fps_calc_time), 1)
                        frame_count = 0
                        fps_calc_time = now

                except Exception as e:
                    print(f"[ScreenCapture] Capture error: {e}")
                    time.sleep(0.5)

                elapsed = time.time() - start_time
                sleep_time = max(0.001, frame_interval - elapsed)
                time.sleep(sleep_time)

        finally:
            if sct:
                try:
                    sct.close()
                except Exception:
                    pass
            print("[ScreenCapture] Capture loop stopped")
