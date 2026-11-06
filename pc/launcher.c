/*
 * BOARDVERSE for Windows — native launcher.
 * The whole game (single HTML file) is embedded as a resource. On start it is unpacked to
 * %LOCALAPPDATA%\BOARDVERSE and opened in its own app window (Edge/Chrome "--app" mode with a
 * private profile, so saves persist and no browser UI is shown). Falls back to the default browser.
 */
#include <windows.h>
#include <shlobj.h>
#include <stdio.h>
#include <wchar.h>

#define IDR_GAME 101

static int file_exists(const wchar_t *p) { DWORD a = GetFileAttributesW(p); return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY); }

/* Writes the game to dir\boardverse.html. Returns 1 if a usable copy is there afterwards. */
static int unpack_to(const wchar_t *dir, const void *data, DWORD size, wchar_t *html, DWORD *err) {
  wchar_t tmp[MAX_PATH];
  CreateDirectoryW(dir, NULL);
  swprintf(html, MAX_PATH, L"%s\\boardverse.html", dir);
  WIN32_FILE_ATTRIBUTE_DATA fa;
  if (GetFileAttributesExW(html, GetFileExInfoStandard, &fa) && fa.nFileSizeLow == size && fa.nFileSizeHigh == 0) return 1; /* up to date */
  swprintf(tmp, MAX_PATH, L"%s\\boardverse.tmp", dir);
  HANDLE f = CreateFileW(tmp, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
  if (f == INVALID_HANDLE_VALUE) { *err = GetLastError(); return file_exists(html); }
  DWORD w = 0;
  BOOL ok = WriteFile(f, data, size, &w, NULL) && w == size;
  CloseHandle(f);
  if (!ok) { *err = GetLastError(); DeleteFileW(tmp); return file_exists(html); }
  if (!MoveFileExW(tmp, html, MOVEFILE_REPLACE_EXISTING)) { *err = GetLastError(); DeleteFileW(tmp); return file_exists(html); } /* old copy still in use: keep using it */
  return 1;
}

int WINAPI wWinMain(HINSTANCE hInst, HINSTANCE hPrev, PWSTR cmd, int show) {
  wchar_t base[MAX_PATH], html[MAX_PATH], profile[MAX_PATH], url[MAX_PATH * 2], args[MAX_PATH * 4];

  HRSRC r = FindResourceW(hInst, MAKEINTRESOURCEW(IDR_GAME), (LPCWSTR)RT_RCDATA);
  if (!r) { MessageBoxW(NULL, L"Game data missing.", L"BOARDVERSE", MB_ICONERROR); return 1; }
  DWORD size = SizeofResource(hInst, r);
  const void *data = LockResource(LoadResource(hInst, r));

  /* candidate folders: LocalAppData, Temp, next to the exe */
  wchar_t dirs[3][MAX_PATH]; int nd = 0;
  if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, dirs[nd]))) { wcscat(dirs[nd], L"\\BOARDVERSE"); nd++; }
  if (GetTempPathW(MAX_PATH, dirs[nd])) { wcscat(dirs[nd], L"BOARDVERSE"); nd++; }
  if (GetModuleFileNameW(NULL, dirs[nd], MAX_PATH)) { wchar_t *sl = wcsrchr(dirs[nd], L'\\'); if (sl) { wcscpy(sl, L"\\BOARDVERSE-data"); nd++; } }
  int ok = 0; DWORD err = 0;
  for (int i = 0; i < nd && !ok; i++) { if (unpack_to(dirs[i], data, size, html, &err)) { wcscpy(base, dirs[i]); ok = 1; } }
  if (!ok) {
    wchar_t msg[512];
    swprintf(msg, 512, L"Cannot write game files (Windows error %lu).\nTry running from another folder (e.g. Desktop) or allow BOARDVERSE in your antivirus.", err);
    MessageBoxW(NULL, msg, L"BOARDVERSE", MB_ICONERROR);
    return 1;
  }
  swprintf(profile, MAX_PATH, L"%s\\profile", base);

  /* file:///C:/Users/... */
  wcscpy(url, L"file:///");
  wcscat(url, html);
  for (wchar_t *p = url; *p; p++) if (*p == L'\\') *p = L'/';

  const wchar_t *candidates[] = {
    L"%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe",
    L"%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe",
    L"%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe",
    L"%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe",
    L"%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe",
  };
  wchar_t exe[MAX_PATH];
  for (int i = 0; i < 5; i++) {
    ExpandEnvironmentStringsW(candidates[i], exe, MAX_PATH);
    if (!file_exists(exe)) continue;
    swprintf(args, MAX_PATH * 4,
      L"\"%s\" --app=\"%s\" --user-data-dir=\"%s\" --window-size=1366,820 --no-first-run --no-default-browser-check "
      L"--autoplay-policy=no-user-gesture-required --allow-file-access-from-files --disable-features=Translate",
      exe, url, profile);
    STARTUPINFOW si = { sizeof(si) }; PROCESS_INFORMATION pi;
    if (CreateProcessW(NULL, args, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) { CloseHandle(pi.hThread); CloseHandle(pi.hProcess); return 0; }
  }
  /* fallback: default browser */
  if ((INT_PTR)ShellExecuteW(NULL, L"open", url, NULL, NULL, SW_SHOWNORMAL) > 32) return 0;
  MessageBoxW(NULL, L"Please install Microsoft Edge or Google Chrome to play BOARDVERSE.", L"BOARDVERSE", MB_ICONWARNING);
  return 1;
}
