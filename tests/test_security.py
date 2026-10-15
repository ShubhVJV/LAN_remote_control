"""
Tests for Security, Allowlist Enforcement, and Input Control.
"""

import pytest
from remote_agent.app_launcher import AppLauncher
from remote_agent.input_control import InputController
from shared.schemas import InputEvent
from shared.protocol import EVENT_MOUSE_MOVE, EVENT_KEY_DOWN

class MockScreenCapture:
    def get_screen_dimensions(self):
        return 1920, 1080

def test_app_launcher_allowlist_enforcement():
    allowlist = [
        {
            "id": "notepad",
            "name": "Notepad",
            "executable": "notepad.exe",
            "args": []
        }
    ]
    launcher = AppLauncher(allowlist)
    apps = launcher.get_allowed_apps()
    assert len(apps) == 1
    assert apps[0].id == "notepad"

    # Reject unapproved application
    res_unapproved = launcher.launch_app("unapproved_hack.exe", "Controller-Attacker")
    assert res_unapproved.success is False
    assert "not in the approved allowlist" in res_unapproved.message

    # Verify audit history
    history = launcher.get_history()
    assert len(history) == 1
    assert history[0]["app_id"] == "unapproved_hack.exe"
    assert history[0]["success"] is False

def test_input_control_unauthorized_drop():
    screen = MockScreenCapture()
    controller = InputController(screen)

    # When is_authorized is False (e.g. view-only mode or unauthenticated)
    event = InputEvent(event_type=EVENT_MOUSE_MOVE, x=0.5, y=0.5)
    controller.handle_event(event, is_authorized=False)
    # No exception and input is dropped

def test_key_cleanup_on_revoke():
    screen = MockScreenCapture()
    controller = InputController(screen)

    # Simulate pressing a key
    if controller.keyboard:
        controller.pressed_keys.add("a")
        assert len(controller.pressed_keys) == 1
        controller.release_all_keys()
        assert len(controller.pressed_keys) == 0

def test_type_text_and_hotkey_handling():
    screen = MockScreenCapture()
    controller = InputController(screen)
    
    # Text typing event
    text_event = InputEvent(event_type="type_text", text="Hello Remote LAN!")
    controller.handle_event(text_event, is_authorized=True)
    
    # Hotkey event
    hotkey_event = InputEvent(event_type="hotkey", hotkey="ctrl+c")
    controller.handle_event(hotkey_event, is_authorized=True)
    
    # Drop unauthorized
    controller.handle_event(text_event, is_authorized=False)
