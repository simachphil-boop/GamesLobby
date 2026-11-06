/*
 * BOARDVERSE for Windows — native launcher (no files are written by the launcher).
 * The whole game (single HTML file) is embedded as a resource and served from memory by a tiny
 * HTTP server bound to 127.0.0.1 only. The game opens in its own app window (Edge/Chrome "--app"),
 * falling back to the default browser. A fixed port keeps saves (localStorage) between launches.
 */
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shlobj.h>
#include <stdio.h>
#include <wchar.h>

#define IDR_GAME 101
static const char *g_data; static DWORD g_size; static SOCKET g_srv = INVALID_SOCKET;

static int file_exists(const wchar_t *p) { DWORD a = GetFileAttributesW(p); return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY); }

static DWORD WINAPI serve(LPVOID unused) {
  for (;;) {
    SOCKET c = accept(g_srv, NULL, NULL);
    if (c == INVALID_SOCKET) return 0;
    char req[2048]; int n = recv(c, req, sizeof(req) - 1, 0);
    if (n <= 0) { closesocket(c); continue; }
    req[n] = 0;
    char head[256];
    if (strncmp(req, "GET / ", 6) != 0 && strncmp(req, "GET /index.html", 15) != 0) {
      const char *nf = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
      send(c, nf, (int)strlen(nf), 0); closesocket(c); continue;
    }
    int hl = sprintf(head, "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: %lu\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n", (unsigned long)g_size);
    send(c, head, hl, 0);
    DWORD off = 0;
    while (off < g_size) { int k = send(c, g_data + off, (int)((g_size - off) > 65536 ? 65536 : (g_size - off)), 0); if (k <= 0) break; off += k; }
    shutdown(c, SD_SEND); closesocket(c);
  }
}

int WINAPI wWinMain(HINSTANCE hInst, HINSTANCE hPrev, PWSTR cmd, int show) {
  HRSRC r = FindResourceW(hInst, MAKEINTRESOURCEW(IDR_GAME), (LPCWSTR)RT_RCDATA);
  if (!r) { MessageBoxW(NULL, L"Game data missing.", L"BOARDVERSE", MB_ICONERROR); return 1; }
  g_size = SizeofResource(hInst, r);
  g_data = (const char *)LockResource(LoadResource(hInst, r));

  WSADATA wsa;
  if (WSAStartup(MAKEWORD(2, 2), &wsa)) { MessageBoxW(NULL, L"Network init failed.", L"BOARDVERSE", MB_ICONERROR); return 1; }
  g_srv = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  struct sockaddr_in a = { 0 }; a.sin_family = AF_INET; a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  int port = 0;
  for (int p = 48765; p < 48780; p++) { a.sin_port = htons((u_short)p); if (bind(g_srv, (struct sockaddr *)&a, sizeof(a)) == 0) { port = p; break; } }
  if (!port || listen(g_srv, 16)) {
    wchar_t msg[200]; swprintf(msg, 200, L"Cannot start BOARDVERSE (error %d).", WSAGetLastError());
    MessageBoxW(NULL, msg, L"BOARDVERSE", MB_ICONERROR); return 1;
  }
  CreateThread(NULL, 0, serve, NULL, 0, NULL);

  wchar_t url[64]; swprintf(url, 64, L"http://127.0.0.1:%d/", port);
  /* private browser profile so the window looks like an app; Edge creates it itself */
  wchar_t profile[MAX_PATH] = L"";
  if (SUCCEEDED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, profile))) wcscat(profile, L"\\BOARDVERSE\\profile");

  const wchar_t *candidates[] = {
    L"%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe",
    L"%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe",
    L"%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe",
    L"%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe",
    L"%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe",
  };
  wchar_t exe[MAX_PATH], args[MAX_PATH * 4];
  for (int i = 0; i < 5; i++) {
    ExpandEnvironmentStringsW(candidates[i], exe, MAX_PATH);
    if (!file_exists(exe)) continue;
    swprintf(args, MAX_PATH * 4,
      L"\"%s\" --app=%s %s%s%s --window-size=1366,820 --no-first-run --no-default-browser-check --autoplay-policy=no-user-gesture-required",
      exe, url, profile[0] ? L"--user-data-dir=\"" : L"", profile, profile[0] ? L"\"" : L"");
    STARTUPINFOW si = { sizeof(si) }; PROCESS_INFORMATION pi;
    if (CreateProcessW(NULL, args, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
      CloseHandle(pi.hThread);
      /* keep serving while the game window is open (+ grace period for reloads) */
      WaitForSingleObject(pi.hProcess, INFINITE);
      CloseHandle(pi.hProcess);
      Sleep(5000);
      return 0;
    }
  }
  /* fallback: default browser; keep the server alive until the user closes this box */
  ShellExecuteW(NULL, L"open", url, NULL, NULL, SW_SHOWNORMAL);
  MessageBoxW(NULL, L"BOARDVERSE is running in your browser.\nClose this window when you finish playing.", L"BOARDVERSE", MB_ICONINFORMATION);
  return 0;
}
