//reset stuff that should be reset on every foobar restart
default_config("AdjustCortinasVolume", true);
default_config("CutCortinaLength", 30);
default_config("EnhancePaste", true);

if (is_dj_foobar()) {
    set_config("PlaybackHistoryKeepingEnabled", true);
    set_config("AutoFadeOutAndSkipEnabled", true);
    set_config("DisablePlaylistDoubleClick", true);
    default_config("EnableTalkOver", true);
    default_config("HttpServerPort", 8000);
    set_config("EnableHttpServer", true);
    set_config("ShowNowPlayingOverHttp", true);
    set_config("RealTimePythonLogging", false);
} else {
    set_config("PlaybackHistoryKeepingEnabled", false);
    set_config("AutoFadeOutAndSkipEnabled", false);
    default_config("DisablePlaylistDoubleClick", false);
    default_config("EnableTalkOver", false);
    default_config("HttpServerPort", 8001);
    default_config("EnableHttpServer", true);
    default_config("ShowNowPlayingOverHttp", true);
    default_config("RealTimePythonLogging", false);
}

//reset stuff that should be reset once for dj foobar
if (is_dj_foobar()) {
    if (!get_config("DjFoobarInitialized")) {
        set_config("EnableTalkOver", true);
        set_config("AdjustCortinasVolume", true);
        set_config("HttpServerPort", 8000);

        set_config("DjFoobarInitialized", true);
    }
}

//////////////////////
// UI init   ////////
////////////////////

var Font = gdi.Font("Verdana", px(12));
var SelectionInfoPanelFont = gdi.Font("Verdana", px(11));

var Buttons = {
    skip: new Button(px(67), px(31), Font, "Skip", function() {
        fade_out_and_next();
    }),

    quiet: new Button(px(67), px(31), Font, "Quiet", function() {
        fade_to(QuietVolume, 2000);
    }),

    loud: new Button(px(67), px(31), Font, "Loud", function() {
        fade_to(MaxVolume, 2000);
    }),

    keepPlaybackHistory: new Button(px(67), px(31), Font, "History", function() {
        toggle_button(Buttons.keepPlaybackHistory, "PlaybackHistoryKeepingEnabled");
    }),

    autoSkipcCortinas: new Button(px(67), px(31), Font, "Skip cort.", function() {
        toggle_button(Buttons.autoSkipcCortinas, "AutoFadeOutAndSkipEnabled");
    }),

    stopAfterCurrent: new Button(px(67), px(31), Font, "Stopping", function() {
        fb.StopAfterCurrent = !fb.StopAfterCurrent;
        Buttons.stopAfterCurrent.setToggled(fb.StopAfterCurrent);
    })
};

var Menu = new Button(px(36), px(30), Font, {normal : fb.ComponentPath + "samples\\images\\cog.png"}, function (x, y) {
    popupMenu = create_popup_menu();

    popupMenu.appendMenuItem("Short Cortinas", shorten_cortinas);
    popupMenu.appendMenuItem("Long Cortinas", lengthen_cortinas);
    popupMenu.appendSeparator();

    popupMenu.appendMenuItem("Merge Playstamps", merge_playstamps_in_selection);
    popupMenu.appendMenuItem("Remove Playstamps", remove_playstamps_on_date);
    popupMenu.appendMenuItem("Simulate Playlist", simulate_playlist);
    popupMenu.appendSeparator();

    popupMenu.appendMenuItem("Talk over", set_talk_over_enabled, get_talk_over_enabled());
    popupMenu.appendMenuItem("Adjust cortinas volume", set_adjust_cortinas_volume, get_adjust_cortinas_volume());

    if (PyUtils) {
        popupMenu.appendMenuItem("Enhance paste", set_enhance_paste_enabled, get_enhance_paste_enabled());
        popupMenu.appendMenuItem("Disable playlist double click", set_disable_playlist_double_click_enabled, get_disable_playlist_double_click_enabled());

        popupMenu.appendSeparator();

        popupMenu.appendMenuItem("Enable HTTP server", set_http_server_enabled, get_http_server_enabled());
        popupMenu.appendMenuItem("Show Now Playing over HTTP", set_show_now_playing_over_http_enabled, get_show_now_playing_over_http_enabled());
    }

    popupMenu.appendSeparator();

    popupMenu.appendMenuItem("Reload", reload);
    popupMenu.appendMenuItem("Properties", function() {window.ShowProperties()});
    popupMenu.appendMenuItem("Configure", function() {window.ShowConfigure()});

    if (PyUtils) {
        popupMenu.appendSeparator();

        popupMenu.appendMenuItem("Show PyFoobar Log", function() {
            fb.ShowConsole();
            fb.trace(" ");
            fb.trace(PyUtils.GetLog());
        });

        popupMenu.appendMenuItem("Real-time pythong logging", set_real_time_python_logging_enabled, get_real_time_python_logging_enabled());
    }

    popupMenu.appendSeparator();

    popupMenu.appendMenuItem("Test", function() {
        fb.trace("Dj foobar: " + is_dj_foobar());
        return;

        var port = get_config("HttpServerPort");
        make_http_request("GET", "http://localhost:" + port + "/api/nowPlaying", function(req) {
            if (req.status == 200) {
                fb.ShowConsole();

                var response = JSON.parse(req.responseText);
                var artist = response.nowPlaying ? response.nowPlaying.artist : "None";

                fb.trace(" ");
                fb.trace("Now playing artist: " + artist);
            } else {
                fb.trace("Got status: " + req.status + " while trying to fetch 'Now playing'");
            }
        }, function(req) {
             fb.trace("XMLHTTP timeouted");
        });
    });

    popupMenu.show(x, y);
});

var SelectionInfo = new SelectionInfoPanel(px(275), px(68), SelectionInfoPanelFont, !is_dj_foobar());
var AdditionalSelectionInfo = is_dj_foobar() ? null : new AdditionalSelectionInfoPanel(px(280), px(68), SelectionInfoPanelFont);
var SelectionFilesInfo = is_dj_foobar() ? null : new SelectionFilesInfoPanel(null, px(30), SelectionInfoPanelFont);

function update_selection_info_panels(redraw) {
    var selection_info = get_selection_info();

    SelectionInfo.setSelectionInfo(selection_info);
    SelectionInfo.update();

    if (AdditionalSelectionInfo) {
        AdditionalSelectionInfo.setSelectionInfo(selection_info);

        if (redraw) {
            AdditionalSelectionInfo.update();
        }
    }

    if (SelectionFilesInfo) {
        SelectionFilesInfo.setSelectionInfo(selection_info);

        if (redraw) {
            SelectionFilesInfo.update();
        }
    }
}

register_event_handler([on_selection_changed, 
                        on_playlist_items_selection_change, on_playlist_items_added, on_playlist_items_removed, on_playlist_items_reordered, 
                        on_playlist_switch, on_playlists_changed,
                        on_playback_time, on_playback_seek, on_playback_starting, on_playback_new_track, on_playback_pause, on_playback_stop], function() {
    update_selection_info_panels(true);
});

update_selection_info_panels(false);

function on_size() {
    if (!window.Width || !window.Height) {
        return;
    }

    if (is_dj_foobar()) {
        var components = {
            buttons_container: new ComponentContainer(px(215), px(70), Buttons),
            menu_container: new ComponentContainer(null, px(70), {menu: Menu}),
            selection_info_container: new ComponentContainer(null, px(70), {sel_info: SelectionInfo})
        }
    } else {
        var components = {
            buttons_container: new ComponentContainer(px(220), px(70), Buttons),
            selection_info_container: new ComponentContainer(null, px(70), {sel_info: SelectionInfo, additional_info: AdditionalSelectionInfo}),
            bottom_line_container: new ComponentContainer(null, px(33), {menu: Menu, selections_file_info: SelectionFilesInfo})
        }
    }

    set_components(components);
}

Buttons.keepPlaybackHistory.setToggled(get_config("PlaybackHistoryKeepingEnabled"));
Buttons.autoSkipcCortinas.setToggled(get_config("AutoFadeOutAndSkipEnabled"));
Buttons.stopAfterCurrent.setToggled(fb.StopAfterCurrent);

register_event_handler(on_playlist_stop_after_current_changed, function(state) {
    Buttons.stopAfterCurrent.setToggled(state);
});

set_real_time_python_logging_enabled(get_real_time_python_logging_enabled());
set_talk_over_enabled(get_talk_over_enabled());
set_enhance_paste_enabled(get_enhance_paste_enabled());
set_disable_playlist_double_click_enabled(get_disable_playlist_double_click_enabled());
set_adjust_cortinas_volume(get_adjust_cortinas_volume());
set_http_server_enabled(get_http_server_enabled());

add_to_path("lame");
add_to_path("sox");

if (PyUtils) {
    register_event_handler(on_script_unload, function() { PyUtils.SetLogCallback(null); });
}

//UIHacks = new ActiveXObject("UIHacks");


