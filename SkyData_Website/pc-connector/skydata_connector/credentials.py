"""Windows user-scoped DPAPI storage; never save a token in a .blend file."""
import base64
import ctypes
import os
from ctypes import wintypes

class Blob(ctypes.Structure):
    _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]

def transform(data, encrypt):
    if os.name != 'nt':
        raise OSError('Persistent credentials require Windows')
    buffer = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
    source = Blob(len(data), buffer)
    target = Blob()
    crypt = ctypes.WinDLL('crypt32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    fn = crypt.CryptProtectData if encrypt else crypt.CryptUnprotectData
    fn.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p,
                   ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    fn.restype = wintypes.BOOL
    if not fn(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(target)):
        raise OSError('Windows could not protect the connection credential')
    try:
        return ctypes.string_at(target.data, target.size)
    finally:
        kernel.LocalFree(ctypes.cast(target.data, ctypes.c_void_p))

def save(path, token):
    encrypted = base64.b64encode(transform(token.encode('ascii'), True))
    temporary = path + '.tmp'
    with open(temporary, 'wb') as file:
        file.write(encrypted)
    os.replace(temporary, path)

def read(path):
    with open(path, 'rb') as file:
        data = file.read(8192)
    token = transform(base64.b64decode(data, validate=True), False).decode('ascii')
    if len(token) != 64 or any(c not in '0123456789abcdef' for c in token):
        raise ValueError('Invalid saved credential')
    return token
