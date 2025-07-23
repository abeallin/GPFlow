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
from create_template import CreateTemplate
from data_parser import DataParser
from delete_template import DeleteTemplate
from screen_saver import Screensaver
from helpers import create_template_object
from login import parse_env_file
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from tkinter import font as tkFont
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import TimeoutException, WebDriverException, InvalidSessionIdException
from accurx_gui import AccurxRunner
from accurx_gui import main

if __name__ == "__main__":
    main()