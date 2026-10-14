"""
Local approval dialog and active session banner for Remote Agent.
"""

import sys
import time
import threading
from typing import Optional, Callable

class ApprovalUI:
    def __init__(self):
        self.active_banner = None
        self.banner_thread = None

    def prompt_approval(
        self,
        controller_name: str,
        controller_ip: str,
        mode: str,
        timeout_seconds: int = 30
    ) -> bool:
        """
        Display an interactive prompt on Computer B to allow or reject the session.
        Returns True if accepted, False if rejected or timed out.
        """
        result = [False]
        event = threading.Event()

        def run_gui():
            try:
                import tkinter as tk
                from tkinter import font

                root = tk.Tk()
                root.title("LAN Remote Control - Access Request")
                root.geometry("450x260")
                root.resizable(False, False)
                root.attributes("-topmost", True)
                root.configure(bg="#1e1e2e")

                # Center the window
                root.update_idletasks()
                width = root.winfo_width()
                height = root.winfo_height()
                x = (root.winfo_screenwidth() // 2) - (width // 2)
                y = (root.winfo_screenheight() // 2) - (height // 2)
                root.geometry(f"{width}x{height}+{x}+{y}")

                # Title
                title_font = font.Font(family="Segoe UI", size=13, weight="bold")
                body_font = font.Font(family="Segoe UI", size=10)
                small_font = font.Font(family="Segoe UI", size=9)

                header = tk.Label(
                    root,
                    text="Remote Session Request",
                    font=title_font,
                    fg="#f38ba8" if mode == "interactive" else "#89b4fa",
                    bg="#1e1e2e",
                    pady=10
                )
                header.pack()

                info_text = (
                    f"Controller: {controller_name}\n"
                    f"IP Address: {controller_ip}\n"
                    f"Mode: {'Full Interactive Control' if mode == 'interactive' else 'View Only'}"
                )
                info_label = tk.Label(
                    root,
                    text=info_text,
                    font=body_font,
                    fg="#cdd6f4",
                    bg="#313244",
                    padx=15,
                    pady=10,
                    justify="left",
                    relief="flat"
                )
                info_label.pack(fill="x", padx=20, pady=5)

                countdown_var = tk.StringVar()
                countdown_label = tk.Label(
                    root,
                    textvariable=countdown_var,
                    font=small_font,
                    fg="#a6adc8",
                    bg="#1e1e2e"
                )
                countdown_label.pack(pady=4)

                btn_frame = tk.Frame(root, bg="#1e1e2e")
                btn_frame.pack(pady=10)

                def on_accept():
                    result[0] = True
                    event.set()
                    root.destroy()

                def on_reject():
                    result[0] = False
                    event.set()
                    root.destroy()

                accept_btn = tk.Button(
                    btn_frame,
                    text="Accept",
                    bg="#a6e3a1",
                    fg="#11111b",
                    font=title_font,
                    width=10,
                    relief="flat",
                    cursor="hand2",
                    command=on_accept
                )
                accept_btn.pack(side="left", padx=10)

                reject_btn = tk.Button(
                    btn_frame,
                    text="Reject",
                    bg="#f38ba8",
                    fg="#11111b",
                    font=title_font,
                    width=10,
                    relief="flat",
                    cursor="hand2",
                    command=on_reject
                )
                reject_btn.pack(side="left", padx=10)

                start_time = time.time()

                def update_countdown():
                    remaining = int(timeout_seconds - (time.time() - start_time))
                    if remaining <= 0:
                        countdown_var.set("Request expired.")
                        on_reject()
                    else:
                        countdown_var.set(f"Auto-rejecting in {remaining}s...")
                        root.after(1000, update_countdown)

                update_countdown()
                root.mainloop()
            except Exception as e:
                print(f"[ApprovalUI] Tkinter GUI failed: {e}. Falling back to CLI.")
                event.set()

        gui_thread = threading.Thread(target=run_gui, daemon=True)
        gui_thread.start()

        # Wait for GUI event or timeout
        finished = event.wait(timeout=timeout_seconds + 2)
        if not finished:
            print(f"[ApprovalUI] Request from {controller_name} ({controller_ip}) timed out.")
            return False

        return result[0]

    def show_active_banner(self, controller_name: str, controller_ip: str, on_disconnect: Callable[[], None]):
        """Displays a floating on-screen banner indicating that remote access is active."""
        def run_banner():
            try:
                import tkinter as tk
                root = tk.Tk()
                root.title("LAN Remote Control Active")
                root.geometry("380x60")
                root.resizable(False, False)
                root.attributes("-topmost", True)
                root.configure(bg="#11111b")

                # Position in top right corner
                screen_width = root.winfo_screenwidth()
                root.geometry(f"380x60+{screen_width - 400}+40")

                frame = tk.Frame(root, bg="#11111b")
                frame.pack(fill="both", expand=True, padx=10, pady=8)

                indicator = tk.Label(frame, text="●", fg="#a6e3a1", bg="#11111b", font=("Segoe UI", 14))
                indicator.pack(side="left", padx=5)

                msg = tk.Label(
                    frame,
                    text=f"Connected: {controller_name}\n({controller_ip})",
                    fg="#cdd6f4",
                    bg="#11111b",
                    font=("Segoe UI", 9),
                    justify="left"
                )
                msg.pack(side="left", padx=5)

                def do_disconnect():
                    root.destroy()
                    on_disconnect()

                disconnect_btn = tk.Button(
                    frame,
                    text="Disconnect",
                    bg="#f38ba8",
                    fg="#11111b",
                    font=("Segoe UI", 9, "bold"),
                    relief="flat",
                    cursor="hand2",
                    command=do_disconnect
                )
                disconnect_btn.pack(side="right", padx=5)

                self.active_banner = root
                root.mainloop()
            except Exception as e:
                print(f"[ApprovalUI] Banner error: {e}")

        self.banner_thread = threading.Thread(target=run_banner, daemon=True)
        self.banner_thread.start()

    def hide_active_banner(self):
        if self.active_banner:
            try:
                self.active_banner.destroy()
            except Exception:
                pass
            self.active_banner = None
