"""
Remote mouse and keyboard input control using pynput.
"""

import time
from typing import Set, Union
from shared.schemas import InputEvent
from shared.protocol import (
    EVENT_MOUSE_MOVE,
    EVENT_MOUSE_DOWN,
    EVENT_MOUSE_UP,
    EVENT_MOUSE_CLICK,
    EVENT_MOUSE_DOUBLE_CLICK,
    EVENT_MOUSE_SCROLL,
    EVENT_KEY_DOWN,
    EVENT_KEY_UP,
)

try:
    from pynput.mouse import Button, Controller as MouseController
    from pynput.keyboard import Key, KeyCode, Controller as KeyboardController
    PYNPUT_AVAILABLE = True
except Exception as e:
    PYNPUT_AVAILABLE = False
    print(f"[InputControl] pynput not fully available: {e}")

# Key mapping from frontend key strings to pynput Key objects
SPECIAL_KEYS = {
    "enter": Key.enter if PYNPUT_AVAILABLE else None,
    "return": Key.enter if PYNPUT_AVAILABLE else None,
    "backspace": Key.backspace if PYNPUT_AVAILABLE else None,
    "tab": Key.tab if PYNPUT_AVAILABLE else None,
    "escape": Key.esc if PYNPUT_AVAILABLE else None,
    "esc": Key.esc if PYNPUT_AVAILABLE else None,
    "space": Key.space if PYNPUT_AVAILABLE else None,
    "shift": Key.shift if PYNPUT_AVAILABLE else None,
    "shiftleft": Key.shift_l if PYNPUT_AVAILABLE else None,
    "shiftright": Key.shift_r if PYNPUT_AVAILABLE else None,
    "control": Key.ctrl if PYNPUT_AVAILABLE else None,
    "ctrl": Key.ctrl if PYNPUT_AVAILABLE else None,
    "alt": Key.alt if PYNPUT_AVAILABLE else None,
    "meta": Key.cmd if PYNPUT_AVAILABLE else None,
    "arrowup": Key.up if PYNPUT_AVAILABLE else None,
    "up": Key.up if PYNPUT_AVAILABLE else None,
    "arrowdown": Key.down if PYNPUT_AVAILABLE else None,
    "down": Key.down if PYNPUT_AVAILABLE else None,
    "arrowleft": Key.left if PYNPUT_AVAILABLE else None,
    "left": Key.left if PYNPUT_AVAILABLE else None,
    "arrowright": Key.right if PYNPUT_AVAILABLE else None,
    "right": Key.right if PYNPUT_AVAILABLE else None,
    "delete": Key.delete if PYNPUT_AVAILABLE else None,
    "home": Key.home if PYNPUT_AVAILABLE else None,
    "end": Key.end if PYNPUT_AVAILABLE else None,
    "pageup": Key.page_up if PYNPUT_AVAILABLE else None,
    "pagedown": Key.page_down if PYNPUT_AVAILABLE else None,
    "capslock": Key.caps_lock if PYNPUT_AVAILABLE else None,
    "f1": Key.f1 if PYNPUT_AVAILABLE else None,
    "f2": Key.f2 if PYNPUT_AVAILABLE else None,
    "f3": Key.f3 if PYNPUT_AVAILABLE else None,
    "f4": Key.f4 if PYNPUT_AVAILABLE else None,
    "f5": Key.f5 if PYNPUT_AVAILABLE else None,
    "f6": Key.f6 if PYNPUT_AVAILABLE else None,
    "f7": Key.f7 if PYNPUT_AVAILABLE else None,
    "f8": Key.f8 if PYNPUT_AVAILABLE else None,
    "f9": Key.f9 if PYNPUT_AVAILABLE else None,
    "f10": Key.f10 if PYNPUT_AVAILABLE else None,
    "f11": Key.f11 if PYNPUT_AVAILABLE else None,
    "f12": Key.f12 if PYNPUT_AVAILABLE else None,
}

class InputController:
    def __init__(self, screen_capture_service):
        self.screen_capture = screen_capture_service
        self.mouse = MouseController() if PYNPUT_AVAILABLE else None
        self.keyboard = KeyboardController() if PYNPUT_AVAILABLE else None
        self.pressed_keys: Set[Union[Key, KeyCode, str]] = set()
        self.last_mouse_move_time = 0.0
        self.min_move_interval = 0.01  # Rate limit: max 100 move events / sec

    def handle_event(self, event: InputEvent, is_authorized: bool):
        if not is_authorized or not PYNPUT_AVAILABLE:
            return

        screen_w, screen_h = self.screen_capture.get_screen_dimensions()

        try:
            # Mouse Movements
            if event.event_type == EVENT_MOUSE_MOVE:
                now = time.time()
                if now - self.last_mouse_move_time < self.min_move_interval:
                    return
                self.last_mouse_move_time = now

                if event.x is not None and event.y is not None:
                    # Translate normalized (0.0 to 1.0) coordinates
                    clamped_x = max(0.0, min(1.0, event.x))
                    clamped_y = max(0.0, min(1.0, event.y))
                    abs_x = int(clamped_x * screen_w)
                    abs_y = int(clamped_y * screen_h)
                    self.mouse.position = (abs_x, abs_y)

            # Mouse Clicks and Buttons
            elif event.event_type in (EVENT_MOUSE_DOWN, EVENT_MOUSE_UP, EVENT_MOUSE_CLICK, EVENT_MOUSE_DOUBLE_CLICK):
                button = Button.left
                if event.button == "right":
                    button = Button.right
                elif event.button == "middle":
                    button = Button.middle

                if event.x is not None and event.y is not None:
                    clamped_x = max(0.0, min(1.0, event.x))
                    clamped_y = max(0.0, min(1.0, event.y))
                    self.mouse.position = (int(clamped_x * screen_w), int(clamped_y * screen_h))

                if event.event_type == EVENT_MOUSE_DOWN:
                    self.mouse.press(button)
                elif event.event_type == EVENT_MOUSE_UP:
                    self.mouse.release(button)
                elif event.event_type == EVENT_MOUSE_CLICK:
                    self.mouse.click(button, 1)
                elif event.event_type == EVENT_MOUSE_DOUBLE_CLICK:
                    self.mouse.click(button, 2)

            # Mouse Scrolling
            elif event.event_type == EVENT_MOUSE_SCROLL:
                dx = event.dx or 0
                dy = event.dy or 0
                self.mouse.scroll(dx, dy)

            # Keyboard Events
            elif event.event_type == EVENT_KEY_DOWN:
                if event.key:
                    k = self._resolve_key(event.key)
                    if k is not None:
                        self.keyboard.press(k)
                        self.pressed_keys.add(k)

            elif event.event_type == EVENT_KEY_UP:
                if event.key:
                    k = self._resolve_key(event.key)
                    if k is not None:
                        self.keyboard.release(k)
                        self.pressed_keys.discard(k)

        except Exception as e:
            print(f"[InputControl] Error handling {event.event_type}: {e}")

    def _resolve_key(self, key_str: str):
        lower = key_str.lower()
        if lower in SPECIAL_KEYS:
            return SPECIAL_KEYS[lower]
        if len(key_str) == 1:
            return key_str
        return None

    def release_all_keys(self):
        """Release any stuck pressed keys to prevent ghost inputs on disconnect."""
        if not PYNPUT_AVAILABLE or not self.keyboard:
            return
        for k in list(self.pressed_keys):
            try:
                self.keyboard.release(k)
            except Exception:
                pass
        self.pressed_keys.clear()
