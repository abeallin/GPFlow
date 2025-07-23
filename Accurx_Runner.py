import os
import re
import glob
import platform
import time
import tkinter as tk
import logging
from tkinter import messagebox
from tkinter import ttk
import pandas as pd
from screens.login_screen import LoginScreen
from screens.data_preview_screen import DataPreviewScreen
from screens.template_screen import TemplateScreen
from screens.welcome_screen import WelcomeScreen
from create_template import CreateTemplate
from utils.data_parser import DataParser
from delete_template import DeleteTemplate
from utils.screen_saver import Screensaver
from utils.helpers import create_template_object
from utils.login import get_credentials, get_license_key
from utils.selenium_runner import SeleniumRunner
from tkinter import font as tkFont
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, WebDriverException, InvalidSessionIdException

from accurx_gui import AccurxRunner
from accurx_gui import main

if __name__ == "__main__":
    main()