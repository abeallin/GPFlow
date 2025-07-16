import os
import time
import ctypes
import platform
import threading
from pynput.mouse import Controller

class Screensaver:
    def __init__(self):
        self.os_name = platform.system()
        self.mouse = Controller()

    def disable_screensaver(self):
        if self.os_name == "Windows":
            self._disable_screensaver_windows()
        elif self.os_name == "Linux":
            self._disable_screensaver_linux()
        else:
            print("⚠️ Unsupported OS. Screensaver prevention not applied.")

    def enable_screensaver(self):
        if self.os_name == "Windows":
            self._enable_screensaver_windows()
        elif self.os_name == "Linux":
            self._enable_screensaver_linux()

    def _disable_screensaver_windows(self):
        print("🛑 Disabling screensaver & sleep on Windows...")
        os.system("powercfg -change -monitor-timeout-ac 0")
        os.system("powercfg -change -standby-timeout-ac 0")
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000002)  # Prevent sleep

    def _enable_screensaver_windows(self):
        print("✅ Restoring screensaver settings on Windows...")
        os.system("powercfg -change -monitor-timeout-ac 5")  # Restore timeout
        os.system("powercfg -change -standby-timeout-ac 10")  # Restore timeout
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)  # Allow sleep

    def _disable_screensaver_linux(self):
        print("🛑 Disabling screensaver & sleep on Linux...")
        os.system("xset s off -dpms")

    def _enable_screensaver_linux(self):
        print("✅ Restoring screensaver settings on Linux...")
        os.system("xset s on +dpms")

    def move_mouse_periodically(self):
        while True:
            self.mouse.move(1, 1)  # Small movement to prevent screen lock
            time.sleep(60)  # Move every 60 seconds
    
    def start_mouse_movement(self):
        """Start the mouse movement in a background thread."""
        thread = threading.Thread(target=self.move_mouse_periodically, daemon=True)
        thread.start()