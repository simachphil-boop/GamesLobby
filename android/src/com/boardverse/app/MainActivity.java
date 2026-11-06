package com.boardverse.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.view.HapticFeedbackConstants;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.lang.reflect.Method;

/**
 * BOARDVERSE native shell.
 *
 * The whole game (3D scene, rules, bots, UI) runs inside a hardware-accelerated
 * WebView from bundled assets (assets/www). This activity only provides:
 *  - an immersive full-screen surface that survives rotation without reloading,
 *  - a small JS bridge (window.BoardverseNative) for haptics, exit and native prefs backup,
 *  - back-button routing into the game UI.
 */
public class MainActivity extends Activity {

    private WebView web;
    private final Handler handler = new Handler();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Draw under display cutouts on Android 9+ (LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES = 1)
        if (Build.VERSION.SDK_INT >= 28) {
            try {
                WindowManager.LayoutParams lp = getWindow().getAttributes();
                lp.getClass().getField("layoutInDisplayCutoutMode").setInt(lp, 1);
                getWindow().setAttributes(lp);
            } catch (Throwable ignored) { }
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(10, 12, 32));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        callOptional(s, "setAllowFileAccessFromFileURLs", boolean.class, Boolean.TRUE);
        callOptional(s, "setAllowUniversalAccessFromFileURLs", boolean.class, Boolean.TRUE);
        callOptional(s, "setMediaPlaybackRequiresUserGesture", boolean.class, Boolean.FALSE);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // Keep all navigation inside the bundled game.
                return !url.startsWith("file:///android_asset/");
            }
        });
        web.addJavascriptInterface(new Bridge(), "BoardverseNative");
        setContentView(web);
        hideSystemUi();

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl("file:///android_asset/www/index.html");
        }
    }

    private static void callOptional(Object target, String name, Class<?> type, Object value) {
        try {
            Method m = target.getClass().getMethod(name, type);
            m.invoke(target, value);
        } catch (Throwable ignored) { }
    }

    private void hideSystemUi() {
        // LAYOUT_STABLE | LAYOUT_HIDE_NAVIGATION | LAYOUT_FULLSCREEN | HIDE_NAVIGATION | FULLSCREEN | IMMERSIVE_STICKY
        int flags = 0x00000100 | 0x00000200 | 0x00000400 | 0x00000002 | 0x00000004 | 0x00001000;
        web.setSystemUiVisibility(flags);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.loadUrl("javascript:window.BV&&BV.onPause&&BV.onPause()");
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.loadUrl("javascript:window.BV&&BV.onResume&&BV.onResume()");
        hideSystemUi();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            // The game decides what "back" means (close dialog, pause menu, previous screen...).
            web.loadUrl("javascript:(window.BV&&BV.onBack)?BV.onBack():BoardverseNative.exitApp()");
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
        }
        super.onDestroy();
    }

    /** Methods callable from JavaScript as window.BoardverseNative.*. */
    public class Bridge {
        @JavascriptInterface
        public void exitApp() {
            handler.post(new Runnable() {
                public void run() { finish(); }
            });
        }

        @JavascriptInterface
        public void haptic() {
            handler.post(new Runnable() {
                public void run() {
                    web.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
                }
            });
        }

        /** Native backup of the save file (survives WebView storage clears). */
        @JavascriptInterface
        public void backupSave(String json) {
            SharedPreferences p = getSharedPreferences("boardverse", Context.MODE_PRIVATE);
            p.edit().putString("save", json).commit();
        }

        @JavascriptInterface
        public String restoreSave() {
            SharedPreferences p = getSharedPreferences("boardverse", Context.MODE_PRIVATE);
            return p.getString("save", "");
        }

        @JavascriptInterface
        public String platform() {
            return "android-" + Build.VERSION.SDK_INT;
        }
    }
}
