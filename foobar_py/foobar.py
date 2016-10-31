import string
import json
import uuid
import time
import threading
import os
import sys
import posixpath
import urllib
import traceback

from urlparse import urlparse, parse_qs
from collections import namedtuple
from ctypes import windll, CFUNCTYPE, POINTER, c_int, c_void_p, byref
from timeit import default_timer as timer

import win32com.server.register
import win32clipboard
import win32con, win32api, win32gui, atexit

import Queue
import BaseHTTPServer
import SimpleHTTPServer

log = ["Initialized FoobarPy module with guid: " + str(uuid.uuid4()) + ", executable: " + sys.executable + ", script: " + __file__ + " at CWD: " + os.getcwd()]

foobarLogCallback = None

def appendLog(entry):
    log.append(str(entry))
    try:
        invokeCallback(foobarLogCallback, str(entry))
    except:
        pass

def invokeCallback(callback, *args):
    if callback:
        return callback.Invoke(0, 0x0800, 0x1, 1, *args)

    return None

hookCallbacks = [] #To prevent garbage collection

def installHook(hookType, hookCallbackPtr):
    hookCallbacks.append(hookCallbackPtr)

    currentThreadId = threading.current_thread().ident
    hookId = windll.user32.SetWindowsHookExA(hookType, hookCallbackPtr, win32api.GetModuleHandle(None), currentThreadId)

    atexit.register(windll.user32.UnhookWindowsHookEx, hookId)

    appendLog("Hook (type: " + str(hookType) + ") installed, hook id: " + str(hookId) + " for thread: " + str(currentThreadId))

    return hookId

class Singleton:
    """
    A non-thread-safe helper class to ease implementing singletons.
    This should be used as a decorator -- not a metaclass -- to the
    class that should be a singleton.

    The decorated class can define one `__init__` function that
    takes only the `self` argument. Other than that, there are
    no restrictions that apply to the decorated class.

    To get the singleton instance, use the `Instance` method. Trying
    to use `__call__` will result in a `TypeError` being raised.

    Limitations: The decorated class cannot be inherited from.
    """

    def __init__(self, decorated):
        self._decorated = decorated

    def Instance(self):
        try:
            return self._instance
        except AttributeError:
            self._instance = self._decorated()
            return self._instance

    def __call__(self):
        raise TypeError('Singletons must be accessed through `Instance()`.')

    def __instancecheck__(self, inst):
        return isinstance(inst, self._decorated)

@Singleton
class KeyboardHook:
    pasteCallback = None

    CFSTR_INETURL = win32clipboard.RegisterClipboardFormat("UniformResourceLocator")
    CFSTR_FoobarPlayableLocationFormat = win32clipboard.RegisterClipboardFormat("foobar2000_playable_location_format")

    def __init__(self):
        def keyboard_hook(nCode, wParam, lParam):
            try:
                if not self.pasteCallback:
                    return 0

                if wParam == 0x56 and not self.getBit(lParam, 31):
                    if self.keyDown(win32con.VK_CONTROL) and not self.keyDown(win32con.VK_SHIFT) and not self.keyDown(win32con.VK_MENU):
                        if not self.isClipboardEmpty():
                            invokeCallback(self.pasteCallback)

                # Be a good neighbor and call the next hook.
                #windll.user32.CallNextHookEx(hookId, nCode, wParam, lParam)
                return 0
            except Exception as inst:
                appendLog("Error in keyboard hook: " + str(inst))
                return 0

        hookCallbackPtr = CFUNCTYPE(c_int, c_int, c_int, c_int)(keyboard_hook)
        installHook(win32con.WH_KEYBOARD, hookCallbackPtr)

    def setPasteCallback(self, callback):
        self.pasteCallback = callback

    def isClipboardEmpty(self):
        try:
            win32clipboard.OpenClipboard()

            return (not win32clipboard.IsClipboardFormatAvailable(win32con.CF_HDROP) and
                    not win32clipboard.IsClipboardFormatAvailable(self.CFSTR_FoobarPlayableLocationFormat) and
                    not win32clipboard.IsClipboardFormatAvailable(self.CFSTR_INETURL))
        finally:
            win32clipboard.CloseClipboard()

    def getBit(self, byteval, idx):
        return (byteval & (1<<idx)) != 0

    def keyDown(self, key):
        return self.getBit(win32api.GetAsyncKeyState(key), 15)

@Singleton
class MouseHook:
    doubleClickCallback = None

    def __init__(self):
        def mouse_hook(nCode, wParam, lParam):
            try:
                if wParam == win32con.WM_LBUTTONDBLCLK:
                    if invokeCallback(self.doubleClickCallback):
                        return 1

                return 0
            except Exception as inst:
                appendLog("Error in mouse hook: " + str(inst))
                return 0

        hookCallbackPtr = CFUNCTYPE(c_int, c_int, c_int, c_void_p)(mouse_hook)
        installHook(win32con.WH_MOUSE, hookCallbackPtr)

    def setDoubleClickCallback(self, callback):
        self.doubleClickCallback = callback

class MyHttpServer(BaseHTTPServer.HTTPServer):
    haltRequestProcessing = False
    lock = threading.Lock()
    queue = Queue.Queue()

    def handle_error(self, request, client_address):
        appendLog("Error happened during processing of http request: " + traceback.format_exc())

class MyHttpHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
    def do_GET(self):
        try:
            with self.server.lock:
                if self.server.haltRequestProcessing:
                    self.send_response(500)
                    self.end_headers()
                    return

            if self.path.startswith("/api/"):
                url = urlparse(urllib.unquote(self.path))
                query = parse_qs(url.query)

                queueItem = {'result': None, 'action': url.path[5:], 'query': json.dumps(query)}

                with self.server.lock:
                    if self.server.haltRequestProcessing:
                        self.send_response(500)
                        self.end_headers()
                        return

                    self.server.queue.put(queueItem)

                self.server.queue.join()

                if queueItem['result']:
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(queueItem['result'])
                else:
                    self.send_response(404)
                    self.end_headers()
            else:
                SimpleHTTPServer.SimpleHTTPRequestHandler.do_GET(self)

        except Exception as inst:
            appendLog("Error processing http request: " + str(inst))
            raise

    def handle(self):
        self.handle_one_request()

    def translate_path(self, path):
        path = posixpath.normpath(urllib.unquote(path))
        words = path.split('/')
        words = filter(None, words)
        path = os.path.dirname(__file__)

        for word in words:
            drive, word = os.path.splitdrive(word)
            head, word = os.path.split(word)
            if word in (os.curdir, os.pardir):
                continue
            path = os.path.join(path, word)

        return path

    def log_message(self, format, *args):
        pass

@Singleton
class FoobarHttpServer:
    httpServer = None
    httpCallback = None

    def startOrStop(self, port, callback):
        self.httpCallback = callback

        if self.httpServer:
            if not callback:
                self.stopServer()
            elif port != self.httpServer.server_port:
                self.stopServer()
                self.startServer(port, callback)
        elif callback:
            self.startServer(port, callback)

    def startServer(self, port, callback):
        try:
            appendLog("Starting web server: " + str(id(self.httpServer)))

            self.httpServer = MyHttpServer(('', port), MyHttpHandler)

            thread = threading.Thread(target = lambda: self.httpServer.serve_forever(0.1))
            thread.daemon = True
            thread.start()
        except Exception as inst:
            self.httpServer = None
            appendLog("Error starting web server: " + str(inst))

    def stopServer(self):
        try:
            appendLog("Stopping web server: " + str(id(self.httpServer)))

            with self.httpServer.lock:
                self.httpServer.haltRequestProcessing = True

            self.processRequests()

            self.httpServer.shutdown()
            self.httpServer.server_close()

            self.httpServer = None
        except Exception as inst:
            appendLog("Error stopping web server: " + str(inst))

    def processRequests(self):
        if self.httpServer:
            try:
                while True:
                    item = self.httpServer.queue.get_nowait()

                    result = invokeCallback(self.httpCallback, item["action"], item["query"])
                    item["result"] = result

                    self.httpServer.queue.task_done()
            except Queue.Empty:
                pass

class PythonUtilities:
    _public_methods_ = ["SetPasteCallback", "GetLog", "SetLogCallback", "SetMouseDoubleClickCallback", "StartWebServer", "ProcessHttpRequests"]
    _reg_progid_ = "PythonServer.Utilities"
    _reg_clsid_ = "{41E24E95-D45A-11D2-852C-204C4F4F5020}"

    def __init__(self):
        appendLog("Initialized PythonUtilities COM object with guid: " + str(uuid.uuid4()))

    def GetLog(self):
        return json.dumps(log)

    def SetLogCallback(self, callback):
        global foobarLogCallback
        foobarLogCallback = callback

    def SetPasteCallback(self, callback):
        KeyboardHook.Instance().setPasteCallback(callback)

    def SetMouseDoubleClickCallback(self, callback):
        MouseHook.Instance().setDoubleClickCallback(callback)

    def ProcessHttpRequests(self):
        FoobarHttpServer.Instance().processRequests()

    def StartWebServer(self, port, callback):
        FoobarHttpServer.Instance().startOrStop(port, callback)

# Add code so that when this script is run by Python.exe, it self-registers.
if __name__ == "__main__":
    print "Performing COM server registration..."

    try:
        win32com.server.register.UseCommandLine(PythonUtilities)
    except:
        print("Exception occurred:")
        traceback.print_exc()
    finally:
        if not '--non-interactive' in sys.argv[1:]:
            raw_input("Press enter to continue...")

