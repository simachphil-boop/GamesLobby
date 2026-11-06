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

int WINAPI wWinMain(HINSTANCE hInst, HINSTANCE hPrev, PWSTR cmd, int show) {
  wchar_t base[MAX_PATH], html[MAX_PATH], profile[MAX_PATH], url[MAX_PATH * 2], args[MAX_PATH * 4];
  if (FAILED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, base))) { MessageBoxW(NULL, L"Cannot find AppData folder.", L"BOARDVERSE", MB_ICONERROR); return 1; }
  wcscat(base, L"\\BOARDVERSE");
  CreateDirectoryW(base, NULL);
  swprintf(html, MAX_PATH, L"%s\\boardverse.html", base);
  swprintf(profile, MAX_PATH, L"%s\\profile", base);

  /* unpack the embedded game (rewritten when the size differs, i.e. after an update) */
  HRSRC r = FindResourceW(hInst, MAKEINTRESOURCEW(IDR_GAME), (LPCWSTR)RT_RCDATA);
  if (!r) { MessageBoxW(NULL, L"Game data missing.", L"BOARDVERSE", MB_ICONERROR); return 1; }
  DWORD size = SizeofResource(hInst, r);
  const void *data = LockResource(LoadResource(hInst, r));
  WIN32_FILE_ATTRIBUTE_DATA fa;
  if (!GetFileAttributesExW(html, GetFileExInfoStandard, &fa) || fa.nFileSizeLow != size) {
    HANDLE f = CreateFileW(html, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (f == INVALID_HANDLE_VALUE) { MessageBoxW(NULL, L"Cannot write game files.", L"BOARDVERSE", MB_ICONERROR); return 1; }
    DWORD w = 0; WriteFile(f, data, size, &w, NULL); CloseHandle(f);
  }

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
