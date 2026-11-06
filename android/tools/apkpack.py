#!/usr/bin/env python3
"""
BOARDVERSE APK packer (no Android SDK required).

Produces an *unsigned* APK containing:
  - AndroidManifest.xml encoded in Android's binary XML (AXML) format,
  - resources.arsc with a single drawable resource (the launcher icon),
  - classes.dex,
  - res/drawable/icon.png,
  - assets/www/** (the game).

The encoders below implement the documented ResChunk formats from
frameworks/base/libs/androidfw/include/androidfw/ResourceTypes.h.
Signing (v1 + v2) is done afterwards by Sign.java using Google's apksig library.
"""
import os
import struct
import sys
import zipfile

ANDROID_NS = "http://schemas.android.com/apk/res/android"

# Framework attribute resource ids (android.R.attr.*)
ATTR_IDS = {
    "theme": 0x01010000, "label": 0x01010001, "icon": 0x01010002, "name": 0x01010003,
    "exported": 0x01010010, "launchMode": 0x0101001d, "screenOrientation": 0x0101001e,
    "configChanges": 0x0101001f, "minSdkVersion": 0x0101020c, "versionCode": 0x0101021b,
    "versionName": 0x0101021c, "targetSdkVersion": 0x01010270, "allowBackup": 0x01010280,
    "glEsVersion": 0x01010281, "required": 0x0101028e, "hardwareAccelerated": 0x010102d3,
    "largeHeap": 0x0101035a, "usesCleartextTraffic": 0x010104ec,
    "compileSdkVersion": 0x01010572, "compileSdkVersionCodename": 0x01010573,
}

T_REF, T_STRING, T_INT_DEC, T_INT_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12


def pad4(b):
    return b + b"\x00" * ((4 - len(b) % 4) % 4)


def string_pool(strings, utf8=False):
    """RES_STRING_POOL_TYPE chunk (UTF-16 or UTF-8 encoded)."""
    data = b""
    offsets = []
    for s in strings:
        offsets.append(len(data))
        if utf8:
            enc = s.encode("utf-8")
            def ln(n):
                return bytes([n]) if n < 0x80 else bytes([0x80 | (n >> 8), n & 0xFF])
            data += ln(len(s)) + ln(len(enc)) + enc + b"\x00"
        else:
            enc = s.encode("utf-16-le")
            data += struct.pack("<H", len(s)) + enc + b"\x00\x00"
    data = pad4(data)
    header_size = 28
    strings_start = header_size + 4 * len(strings)
    body = b"".join(struct.pack("<I", o) for o in offsets) + data
    flags = 0x100 if utf8 else 0
    hdr = struct.pack("<HHIIIIII", 0x0001, header_size, header_size + len(body),
                      len(strings), 0, flags, strings_start, 0)
    return hdr + body


class Node:
    def __init__(self, tag, attrs=None, children=None):
        self.tag = tag
        self.attrs = attrs or []   # list of (ns_is_android, name, type, value)
        self.children = children or []


def encode_axml(root):
    # Collect strings: attribute names with resource ids must come first, in resource-map order.
    res_names = []
    others = []

    def walk(n):
        for (is_android, name, typ, val) in n.attrs:
            if is_android and name in ATTR_IDS:
                if name not in res_names:
                    res_names.append(name)
            elif name not in others:
                others.append(name)
            if typ == T_STRING and val not in others:
                others.append(val)
        if n.tag not in others:
            others.append(n.tag)
        for c in n.children:
            walk(c)
    walk(root)
    for s in ("android", ANDROID_NS):
        if s not in others:
            others.append(s)
    others = [s for s in others if s not in res_names]
    strings = res_names + others
    idx = {s: i for i, s in enumerate(strings)}

    pool = string_pool(strings)
    resmap_body = b"".join(struct.pack("<I", ATTR_IDS[n]) for n in res_names)
    resmap = struct.pack("<HHI", 0x0180, 8, 8 + len(resmap_body)) + resmap_body

    chunks = []
    ns_prefix, ns_uri = idx["android"], idx[ANDROID_NS]
    chunks.append(struct.pack("<HHIIIII", 0x0100, 16, 24, 1, 0xFFFFFFFF, ns_prefix, ns_uri))
    line = [1]

    def emit(n):
        line[0] += 1
        attrs = []
        for (is_android, name, typ, val) in n.attrs:
            ns = ns_uri if is_android else 0xFFFFFFFF
            if typ == T_STRING:
                raw, data = idx[val], idx[val]
            else:
                raw, data = 0xFFFFFFFF, val & 0xFFFFFFFF
            rid = ATTR_IDS.get(name, 0xFFFFFFFF) if is_android else 0xFFFFFFFF
            attrs.append((rid, struct.pack("<IIIHBBI", ns, idx[name], raw, 8, 0, typ, data)))
        # aapt sorts attributes by resource id (framework attrs first)
        attrs.sort(key=lambda a: a[0])
        attr_bytes = b"".join(a[1] for a in attrs)
        ext = struct.pack("<IIHHHHHH", 0xFFFFFFFF, idx[n.tag], 20, 20, len(attrs), 0, 0, 0)
        body = ext + attr_bytes
        chunks.append(struct.pack("<HHIII", 0x0102, 16, 16 + len(body), line[0], 0xFFFFFFFF) + body)
        for c in n.children:
            emit(c)
        line[0] += 1
        chunks.append(struct.pack("<HHIIIII", 0x0103, 16, 24, line[0], 0xFFFFFFFF, 0xFFFFFFFF, idx[n.tag]))
    emit(root)
    chunks.append(struct.pack("<HHIIIII", 0x0101, 16, 24, line[0] + 1, 0xFFFFFFFF, ns_prefix, ns_uri))

    body = pool + resmap + b"".join(chunks)
    return struct.pack("<HHI", 0x0003, 8, 8 + len(body)) + body


def encode_arsc(package_name, pkg_id=0x7F):
    """resources.arsc with: drawable/icon -> res/drawable/icon.png (resource id 0x7f010000)."""
    global_pool = string_pool(["res/drawable/icon.png"], utf8=True)
    type_pool = string_pool(["drawable"], utf8=True)
    key_pool = string_pool(["icon"], utf8=True)

    entry_count = 1
    type_spec = struct.pack("<HHIBBHI", 0x0202, 16, 16 + 4 * entry_count, 1, 0, 0, entry_count)
    type_spec += struct.pack("<I", 0)

    config = struct.pack("<I", 64) + b"\x00" * 60          # ResTable_config: default config
    entries = struct.pack("<HHI", 8, 0, 0)                  # ResTable_entry: size, flags, key=0
    entries += struct.pack("<HBBI", 8, 0, T_STRING, 0)      # Res_value -> global string 0
    header_size = 20 + len(config)
    entries_start = header_size + 4 * entry_count
    type_chunk = struct.pack("<HHIBBHII", 0x0201, header_size, entries_start + len(entries),
                             1, 0, 0, entry_count, entries_start)
    type_chunk += config + struct.pack("<I", 0) + entries

    name = package_name.encode("utf-16-le")[:254]
    name += b"\x00" * (256 - len(name))
    pkg_header_size = 288
    type_strings_off = pkg_header_size
    key_strings_off = type_strings_off + len(type_pool)
    pkg_body = type_pool + key_pool + type_spec + type_chunk
    pkg = struct.pack("<HHII", 0x0200, pkg_header_size, pkg_header_size + len(pkg_body), pkg_id)
    pkg += name + struct.pack("<IIIII", type_strings_off, 1, key_strings_off, 1, 0)
    pkg += pkg_body

    body = global_pool + pkg
    return struct.pack("<HHII", 0x0002, 12, 12 + len(body), 1) + body


def build_manifest(pkg, version_code, version_name, min_sdk, target_sdk):
    A = True
    activity = Node("activity", [
        (A, "name", T_STRING, pkg + ".MainActivity"),
        (A, "label", T_STRING, "BOARDVERSE"),
        (A, "exported", T_BOOL, 0xFFFFFFFF),
        (A, "launchMode", T_INT_DEC, 2),                 # singleTask
        (A, "screenOrientation", T_INT_DEC, 10),         # fullSensor (portrait + landscape)
        (A, "configChanges", T_INT_HEX, 0x3BB0),         # handle rotation/resizing ourselves
        (A, "theme", T_REF, 0x01030007),                 # @android:style/Theme.Black.NoTitleBar.Fullscreen
        (A, "hardwareAccelerated", T_BOOL, 0xFFFFFFFF),
    ], [Node("intent-filter", [], [
        Node("action", [(A, "name", T_STRING, "android.intent.action.MAIN")]),
        Node("category", [(A, "name", T_STRING, "android.intent.category.LAUNCHER")]),
    ])])
    app = Node("application", [
        (A, "label", T_STRING, "BOARDVERSE"),
        (A, "icon", T_REF, 0x7F010000),
        (A, "theme", T_REF, 0x01030007),
        (A, "allowBackup", T_BOOL, 0xFFFFFFFF),
        (A, "hardwareAccelerated", T_BOOL, 0xFFFFFFFF),
        (A, "largeHeap", T_BOOL, 0xFFFFFFFF),
        (A, "usesCleartextTraffic", T_BOOL, 0xFFFFFFFF),
    ], [activity])
    root = Node("manifest", [
        (A, "versionCode", T_INT_DEC, version_code),
        (A, "versionName", T_STRING, version_name),
        (A, "compileSdkVersion", T_INT_DEC, target_sdk),
        (A, "compileSdkVersionCodename", T_STRING, "14"),
        (False, "package", T_STRING, pkg),
    ], [
        Node("uses-sdk", [(A, "minSdkVersion", T_INT_DEC, min_sdk), (A, "targetSdkVersion", T_INT_DEC, target_sdk)]),
        Node("uses-permission", [(A, "name", T_STRING, "android.permission.INTERNET")]),
        Node("uses-feature", [(A, "glEsVersion", T_INT_HEX, 0x00020000), (A, "required", T_BOOL, 0xFFFFFFFF)]),
        app,
    ])
    return encode_axml(root)


def main():
    if len(sys.argv) < 6:
        print("usage: apkpack.py OUT.apk classes.dex icon.png assets_www_dir versionCode versionName")
        sys.exit(1)
    out, dex, icon, www, vcode, vname = sys.argv[1:7]
    pkg = "com.boardverse.app"
    manifest = build_manifest(pkg, int(vcode), vname, 24, 34)
    arsc = encode_arsc(pkg)
    with zipfile.ZipFile(out, "w") as z:
        # resources.arsc first & STORED: its data lands at offset 30+14=44 (4-byte aligned),
        # as required for targetSdk >= 30.
        zi = zipfile.ZipInfo("resources.arsc", date_time=(2026, 1, 1, 0, 0, 0))
        zi.compress_type = zipfile.ZIP_STORED
        z.writestr(zi, arsc)
        def add(name, data, compress=True):
            zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED if compress else zipfile.ZIP_STORED
            z.writestr(zi, data)
        add("AndroidManifest.xml", manifest)
        add("classes.dex", open(dex, "rb").read())
        add("res/drawable/icon.png", open(icon, "rb").read(), compress=False)
        for base, _dirs, files in os.walk(www):
            for f in sorted(files):
                p = os.path.join(base, f)
                rel = os.path.relpath(p, www).replace(os.sep, "/")
                add("assets/www/" + rel, open(p, "rb").read())
    print("packed", out)


if __name__ == "__main__":
    main()
