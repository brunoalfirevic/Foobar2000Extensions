///////////////////////////////////
// Constants and global objects ///
///////////////////////////////////

var QuietVolume = pos2vol(get_config("QuietVolume", 0.4));

var CortinasReferenceVolume = pos2vol(get_config("CortinasReferenceVolume", 0.8));

var CutCortinaLength = get_config("CutCortinaLength", 30);

var SameEveningToleranceInMilliseconds = get_config("SameEveningToleranceInHours", 8) * 60 * 60 * 1000;

var PyUtils = null;

try {
    PyUtils = new ActiveXObject("PythonServer.Utilities");

    set_config("DisablePythonIntegration", false);
} catch(e) {
    if (!get_config("DisablePythonIntegration", false)) {
        try {
            var python_script_path = fb.FoobarPath + "..\\foobar_py\\foobar.py";
            var command_line = 'python.exe "' + python_script_path + '" --non-interactive';

            fb.trace("Exception while creating PyUtils: " + JSON.stringify(e));
            fb.trace("Trying to register python server with command line: " + command_line);

            WshShell.Run(command_line, 1, true);

            PyUtils = new ActiveXObject("PythonServer.Utilities");
        } catch(e2) {
            set_config("DisablePythonIntegration", true);

            fb.trace("Exception while registering python server: " + JSON.stringify(e2));
        }
    }
}

function get_real_time_python_logging_enabled() {
    return get_config("RealTimePythonLogging");
}

function set_real_time_python_logging_enabled(value) {
    if (!PyUtils) {
        return;
    }

    if (value) {
        PyUtils.SetLogCallback(function(s) {
            fb.trace("Python: " + s);
        });

        set_config("RealTimePythonLogging", true);
    } else {
        PyUtils.SetLogCallback(null);

        set_config("RealTimePythonLogging", false);
    }
}

///////////////////
// Http server  //
/////////////////

var HttpHandlers = {
    nowPlaying: function(path) {
        return {
            nowPlaying: get_item_info(fb.GetNowPlaying()),
            showNowPlaying: get_show_now_playing_over_http_enabled()
        };
    }
}

function get_show_now_playing_over_http_enabled() {
    return get_config("ShowNowPlayingOverHttp");
}

function set_show_now_playing_over_http_enabled(value) {
    set_config("ShowNowPlayingOverHttp", value);
}

function get_http_server_enabled(value) {
    return get_config("EnableHttpServer");
}

function proces_http_requests() {
    if (!get_http_server_enabled()) {
        return;
    }

    try {
        PyUtils.ProcessHttpRequests();
    } catch(e) {
        fb.trace("Error processing http requests: " + JSON.stringify(e))
    }

	window.SetTimeout(proces_http_requests, 200);
}

function set_http_server_enabled(value) {
    if (!PyUtils) {
        return;
    }

    if (value) {
        var port = get_config("HttpServerPort");

        PyUtils.StartWebServer(port, function(path, query) {
            var result = null;
            var handler = HttpHandlers[path];

            if (!handler) {
                return null;
            }

            result = handler(path, query);
            return JSON.stringify(result);
        });

        set_config("EnableHttpServer", true);

        proces_http_requests();
    } else {
        set_config("EnableHttpServer", false);

        PyUtils.StartWebServer(port, null);
    }
}

/////////////////////////////////////
// Disable playlist double click  //
///////////////////////////////////

function get_disable_playlist_double_click_enabled() {
    return get_config("DisablePlaylistDoubleClick");
}

function set_disable_playlist_double_click_enabled(value) {
    if (!PyUtils) {
        return;
    }

    if (value) {
        PyUtils.SetMouseDoubleClickCallback(function() {
            var selection_type = fb.GetSelectionType();
            return selection_type == 1 && is_playing(true);
        });

        set_config("DisablePlaylistDoubleClick", true);
    } else {
        PyUtils.SetMouseDoubleClickCallback(null);

        set_config("DisablePlaylistDoubleClick", false);
    }
}

////////////////////////
// Enhanced pasting  //
//////////////////////

function get_enhance_paste_enabled() {
    return get_config("EnhancePaste");
}

function set_enhance_paste_enabled(value) {
    if (!PyUtils) {
        return;
    }

    if (value) {
        PyUtils.SetPasteCallback(prepare_for_paste);

        set_config("EnhancePaste", true);
    } else {
        PyUtils.SetPasteCallback(null);

        set_config("EnhancePaste", false);
    }
}

function prepare_for_paste() {
    var selection = fb.GetSelections(1);
    var selection_type = fb.GetSelectionType();

    var new_focus_item;
    if (selection_type != 1 && !fb.GetFocusItem()) {
        return;
    } else if (selection.Count == 0) {
        new_focus_item = -1;
    } else {
        var focus_item = get_last_playlist_selected_item(plman.ActivePlaylist);

        new_focus_item = focus_item == (plman.PlaylistItemCount(plman.ActivePlaylist) - 1) ? -1 : focus_item + 1;
    }

    plman.SetPlaylistFocusItem(plman.ActivePlaylist, new_focus_item);
}

//////////////////////
// Talk over ////////
////////////////////

var TalkOverStateEnum = {
    Normal: 0,
    TalkingOver: 1
}

var TalkOverState = TalkOverStateEnum.Normal;

function handle_talk_over() {
    if (!get_talk_over_enabled()) {
        return;
    }

    var fade_interval = 900;

    if (utils.IsKeyPressed(226)) {
        if (TalkOverState == TalkOverStateEnum.Normal) {
            TalkOverState = TalkOverStateEnum.TalkingOver;
            fade_to(QuietVolume, fade_interval);
        }
    } else if (TalkOverState == TalkOverStateEnum.TalkingOver) {
        TalkOverState = TalkOverStateEnum.Normal;
        fade_to(MaxVolume, fade_interval);
    }
}

var TalkOverIntervalID = null

function get_talk_over_enabled() {
    return get_config("EnableTalkOver");
}

function set_talk_over_enabled(value) {
    if (TalkOverIntervalID) {
        window.ClearInterval(TalkOverIntervalID);
        TalkOverIntervalID = null;
    }

    if (value) {
        TalkOverIntervalID = window.SetInterval(handle_talk_over, 100);
    }

    set_config("EnableTalkOver", value);
}

//////////////////////////////////
// Cortina volume adjustment ////
////////////////////////////////

function get_adjust_cortinas_volume() {
    return get_config("AdjustCortinasVolume");
}

function set_adjust_cortinas_volume(value) {
    if (!value) {
        VolumeKnob.setReferenceVolume(MaxVolume);
    } else {
        adjust_volume_of_current_song();
    }

    set_config("AdjustCortinasVolume", value);
}

function adjust_volume_of_current_song() {
    var item_info = get_item_info(fb.GetNowPlaying());

    if (item_info) {
        var reference_volume = is_loud_cortina(item_info.item) ? CortinasReferenceVolume : MaxVolume;
        VolumeKnob.setReferenceVolume(reference_volume);
    }
}

register_event_handler(on_playback_new_track, function() {
    if (!get_adjust_cortinas_volume()) {
        return;
    }

    adjust_volume_of_current_song();
});

////////////////////////
// Fade out and skip //
//////////////////////

var AutoFadeOutAndSkipStateEnum = {
    Started: 0,
    FadingOut: 1,
    ShouldNotFadeOut: 2
}

var AutoFadeOutAndSkipState = AutoFadeOutAndSkipStateEnum.Started;

register_event_handler(on_playback_time, function(time) {
    function should_skip_cortina(item_info) {
        var playing_item_location = plman.GetPlayingItemLocation();
        var playlist_items = plman.GetPlaylistItems(playing_item_location.PlaylistIndex);

        return !is_among_first_or_last_cortinas(item_info.item, playlist_items, playing_item_location.PlaylistItemIndex);
    }

    if (!get_config("AutoFadeOutAndSkipEnabled", false)) {
        return;
    }

    if (AutoFadeOutAndSkipState == AutoFadeOutAndSkipStateEnum.Started && time >= CutCortinaLength - 5) {
        var item_info = get_item_info(fb.GetNowPlaying());
        if (!item_info) {
            return;
        }

        if (is_long_cortina(item_info.item) && should_skip_cortina(item_info)) {
            AutoFadeOutAndSkipState = AutoFadeOutAndSkipStateEnum.FadingOut;
            fade_out_and_next();
        } else {
            AutoFadeOutAndSkipState = AutoFadeOutAndSkipStateEnum.ShouldNotFadeOut;
        }
    }
});

register_event_handler(on_playback_new_track, function() {
    AutoFadeOutAndSkipState = AutoFadeOutAndSkipStateEnum.Started;
});

/////////////////////////////
// Cortina manipulation   //
///////////////////////////

function is_long_cortina(item) {
    return contains(item.Path, "Cortinas\\Originals");
}

function is_premade_cortina(item) {
    return contains(item.Path, "Cortinas\\Premade");
}

function is_loud_cortina(item) {
    return is_long_cortina(item) || is_premade_cortina(item);
}

function is_among_first_or_last_cortinas(item, playlist_items, index) {
    var is_among_first = true;
    var is_among_last = true;

    for(var i = index - 1; i >= 0; i--) {
        if (get_item_info(playlist_items.Item(i)).genre != "Cortina") {
            is_among_first = false;
            break;
        }
    }

    for(var i = index + 1; i < playlist_items.Count; i++) {
        if (get_item_info(playlist_items.Item(i)).genre != "Cortina") {
            is_among_last = false;
            break;
        }
    }

    return is_among_first || is_among_last;
}

function shorten_cortinas() {
    replace_playlist_selected_items(plman.ActivePlaylist, function(item, playlist_items, index) {
        var item_info = get_item_info(item);

        if (item_info.genre == "Cortina" && !is_among_first_or_last_cortinas(item, playlist_items, index)) {
            if (contains(item_info.directory, "Cortinas\\Active", "Cortinas\\Originals")) {
                var replacement_path = replace(item_info.directory, "Cortinas\\Cut", "Cortinas\\Active", "Cortinas\\Originals") + "\\" + item_info.filename;

                if (utils.FileTest(replacement_path, "e")) {
                    return replacement_path;
                }
            }
        }

        return null;
    });
}

function lengthen_cortinas() {
    replace_playlist_selected_items(plman.ActivePlaylist, function(item, playlist_items, index) {
        var item_info = get_item_info(item);

        if (item_info.genre == "Cortina" && !is_among_first_or_last_cortinas(item, playlist_items, index)) {
            if (contains(item_info.directory, "Cortinas\\Active", "Cortinas\\Cut")) {
                var replacement_path = replace(item_info.directory, "Cortinas\\Originals", "Cortinas\\Active", "Cortinas\\Cut") + "\\" + item_info.filename;
                
                if (utils.FileTest(replacement_path, "e")) {
                    return replacement_path;
                }
            }
        }

        return null;
    });
}

//////////////////////////////
// Playstamp manipulation  //
////////////////////////////

function is_playstamp_in_the_same_evening_as_date(stamp, evening_date) {
    var stamp_date = parse_iso_date(stamp);
    stamp_date = new Date(stamp_date.valueOf() - SameEveningToleranceInMilliseconds);

    var evening_date = new Date(evening_date.valueOf() - SameEveningToleranceInMilliseconds);

    var result = 
        stamp_date.getYear() == evening_date.getYear() &&
        stamp_date.getMonth() == evening_date.getMonth() &&
        stamp_date.getDate() == evening_date.getDate();

    return result;
}

function remove_playstamps_on_date() {
    var remove_date = input("Date to remove playstamps?", "Remove playstamps", "2010-10-10");
    if (!remove_date) {
        return;
    }

    remove_date = parse_iso_date(remove_date, "21:00");

    playlist_selection = get_playlist_selection(plman.ActivePlaylist);
    playlist_items = plman.GetPlaylistItems(plman.ActivePlaylist);
    
    var playlist_selection_info = _.map(playlist_selection, function(index) {
        var item = playlist_items.Item(index);
        return get_item_info(item)
    });

    _.forEach(playlist_selection_info, function(item_info) {
        var play_stamps = get_play_stamps(item_info.item);

        _.remove(play_stamps, function(stamp) {
            return is_playstamp_in_the_same_evening_as_date(stamp, remove_date);
        });       

        save_play_stamps(item_info.item, play_stamps);
    });
}

function merge_playstamps_in_selection() {
    playlist_selection = get_playlist_selection(plman.ActivePlaylist);
    playlist_items = plman.GetPlaylistItems(plman.ActivePlaylist);

    var playlist_selection_info = _.map(playlist_selection, function(index) {
        var item = playlist_items.Item(index);
        return get_item_info(item)
    });

    var grouped_infos = _.groupBy(playlist_selection_info, function(info) {return info.artist + "#" + info.title;});

    for(var group in grouped_infos) {
        var group_item_infos = grouped_infos[group];
        merge_playstamps(group_item_infos);
    }
}

/////////////////////////////
// Playlist simulation   ///
///////////////////////////

function simulate_playlist() {
    var start = input("Start of playtime?", "Simulate playlist", "2010-10-10");
    if (!start) {
        return;
    }

    var current_time = parse_iso_date(start, "21:00");

    if (!current_time || _.isNaN(current_time)) {
        return;
    }

    playlist_items = plman.GetPlaylistItems(plman.ActivePlaylist);

    for(var i = 0; i < playlist_items.Count; i++) {
        var item = playlist_items.Item(i);
        var play_stamps = get_play_stamps(item);

        _.remove(play_stamps, function(stamp) {
            return is_playstamp_in_the_same_evening_as_date(stamp, current_time);
        });
        
        var new_play_stamp = format_iso_date(current_time);
        play_stamps.push(new_play_stamp);

        save_play_stamps(item, play_stamps);
        
        var duration = is_long_cortina(item) ? CutCortinaLength : item.Length;

        current_time = new Date(current_time.valueOf() + duration*1000 + 2000);
    }
}

////////////////////////
// Playback history ///
//////////////////////

var TrackPlaybackHistoryKeepingStatusEnum = {
    TrackStarted: 0,
    TimestampWritten: 1
}

var TrackPlaybackHistoryKeepingStatus = null;
var TrackPlaybackStartTime = null;

function add_play_stamp(item) {
    if (!TrackPlaybackStartTime) {
        return;
    }

    if (TrackPlaybackHistoryKeepingStatus != TrackPlaybackHistoryKeepingStatusEnum.TrackStarted) {
        return;
    }

    if (is_network_file(item)) {
        return;
    }

    var item_info = get_item_info(item);
    if (!item_info) {
        return;
    }

    var play_stamps = get_play_stamps(item_info.item);

    var new_play_stamp = format_iso_date(TrackPlaybackStartTime);
    play_stamps.push(new_play_stamp);

    save_play_stamps(item_info.item, play_stamps);

    TrackPlaybackHistoryKeepingStatus = TrackPlaybackHistoryKeepingStatusEnum.TimestampWritten;
}

register_event_handler(on_playback_new_track, function() {
    TrackPlaybackStartTime = new Date();
    TrackPlaybackHistoryKeepingStatus = TrackPlaybackHistoryKeepingStatusEnum.TrackStarted;
});

register_event_handler(on_fade_out_and_next, function(item) {
    if (!get_config("PlaybackHistoryKeepingEnabled", false)) {
        return;
    }

    add_play_stamp(item, TrackPlaybackStartTime);
});

register_event_handler(on_playback_time, function(time) {
    if (!get_config("PlaybackHistoryKeepingEnabled", false)) {
        return;
    }

    if (!is_playing()) {
        return;
    }

    var item_info = get_item_info(fb.GetNowPlaying());
    if (!item_info) {
        return;
    }

    if (time > item_info.length*0.85) {
        add_play_stamp(item_info.item);
    }
});

////////////////////////
// Selection info   ///
//////////////////////

function selection_type_to_desc(selection_type) {
    switch (selection_type) {
        case 0:
            return "No selection";
        case 1:
            return "Active playlist";
        case 2:
            return "Entire playlist";
        case 3:
            return "Playlist manager";
        case 4:
            return "Now playing";
        case 5:
            return "Keyboard shortcut list";
        case 6:
            return "Media library";
    }
}

function get_selection_info() {
    function get_cut_duration(item, playlist_items, item_index) {
        if (is_long_cortina(item) && !is_among_first_or_last_cortinas(item, playlist_items, item_index)) {
            return CutCortinaLength;
        } else {
            return item.Length;
        } 
    }

    var selection = fb.GetSelections(1);
    var selection_type = fb.GetSelectionType();
    var selection_type_desc = selection_type_to_desc(selection_type);

    if (selection_type == 0 && selection.Count != 0) {
        selection_type_desc = "Other";
    } else if (selection_type == 0 || selection_type == 1 || selection_type == 4 || selection_type == 5) {
        selection_type_desc = "Active playlist";
        selection = plman.GetPlaylistSelectedItems(plman.ActivePlaylist);
    }

    var raw_duration = selection.CalcTotalDuration();
    var selection_count = selection.Count;
    var duration = null;
    var comming_in = null;
    var finishing_in = null;

    var file_names = [];
    var folder_names = [];
    var size = selection.CalcTotalSize();

    var tag_type = null;
    var bitrate = null;
    var sample_rate = null;
    var channels = null;
    var codec = null;

    var track_replay_gain = null;
    var track_replay_peak = null;
    var album_replay_gain = null;
    var album_replay_peak = null;

    if (selection_count == 1) {
        var item = selection.Item(0);

        tag_type = tf("$info(tagtype)", item);
        channels = tf("$channels()", item);
        bitrate = tf("$info(bitrate) kbps", item);
        sample_rate = tf("$info(samplerate) Hz", item);
        codec = tf("$info(codec)", item);

        track_replay_gain = tf("[%replaygain_track_gain%]", item);
        track_replay_peak = tf("[%replaygain_track_peak%]", item);
        album_replay_gain = tf("[%replaygain_album_gain%]", item);
        album_replay_peak = tf("[%replaygain_album_peak%]", item);
    }

    if (selection_count > 0) {
        for(var i = 0; i < Math.min(selection_count, 10); i++) {
            var item = selection.Item(i);

            var network_path = get_network_path(item);
            if (network_path) {
                file_names.push(network_path);
                folder_names.push(extract_domain(network_path));
            } else {
                file_names.push(tf("%filename_ext%", item));

                var folder_name = fb.GetLibraryRelativePath(item);

                if (folder_name) {
                    var last_backslash = folder_name.lastIndexOf("\\");
                    if (last_backslash != -1) {
                        folder_name = folder_name.slice(0, last_backslash);
                    } else {
                        folder_name = "";
                    }

                    folder_name = "\\" + folder_name;
                } else {
                    folder_name = tf("$directory_path(%path%)", item);
                }

                folder_names.push(folder_name);
            }
        }
    }

    if (selection_count > 0 && selection_count <= 1000 && (selection_type_desc == "Active playlist" || selection_type_desc == "Entire playlist")) {
        var playlist_items = plman.GetPlaylistItems(plman.ActivePlaylist);

        var playlist_selection = selection_type_desc == "Active playlist" 
            ? get_playlist_selection(plman.ActivePlaylist)
            : _.range(0, playlist_items.Count);

        duration = 0;
        _.forEach(playlist_selection, function(item_index) {
            var item = playlist_items.Item(item_index);

            duration += get_cut_duration(item, playlist_items, item_index);
        });

        if (selection_type_desc == "Active playlist" && fb.IsPlaying && plman.ActivePlaylist == plman.PlayingPlaylist) {
            var playing_item_location = plman.GetPlayingItemLocation();

            if (playing_item_location.IsValid) {
                var first_selected = _.first(playlist_selection);
                if (first_selected > playing_item_location.PlaylistItemIndex) {
                    comming_in = -fb.PlaybackTime;

                    for(var i = playing_item_location.PlaylistItemIndex; i < first_selected; i++) {
                        var item_cut_duration = get_cut_duration(playlist_items.Item(i), playlist_items, i);
                        comming_in += item_cut_duration;
                    }
                }

                var last_selected = _.last(playlist_selection);
                if (last_selected >= playing_item_location.PlaylistItemIndex) {
                    finishing_in = -fb.PlaybackTime;

                    for(var i = playing_item_location.PlaylistItemIndex; i <= last_selected; i++) {
                        var item_cut_duration = get_cut_duration(playlist_items.Item(i), playlist_items, i);
                        finishing_in += item_cut_duration;
                    }
                }
            }
        }
    }

    return {
        selection_type: selection_type,
        selection_type_desc: selection_type_desc,
        selection_count: selection_count,

        duration: duration,
        raw_duration: raw_duration,
        comming_in: comming_in,
        finishing_in: finishing_in,

        file_names: file_names,
        folder_names: folder_names,
        size: size,

        tag_type: tag_type,
        channels: channels,
        bitrate: bitrate,
        sample_rate: sample_rate,
        codec: codec,

        track_replay_gain: track_replay_gain,
        track_replay_peak: track_replay_peak,
        album_replay_gain: album_replay_gain,
        album_replay_peak: album_replay_peak
    };
}

function SelectionInfoPanel(w, h, font, drawBorder) {
    init_component(this, w, h);

    this.selectionInfo = null;
    this.drawBorder = drawBorder;

    this.setSelectionInfo = function(selectionInfo) {
        this.selectionInfo = selectionInfo;
    }

    this.draw = function(gr) {
        var self = this;

        var selection_info = this.selectionInfo;

        if (!selection_info || selection_info.selection_count == 0) {
            return;
        }

        if (this.drawBorder) {
            gr.DrawRoundRect(this.x, this.y, this.w, this.h, px(3), px(3), px(1), Colors.Gray);
        }

        var vertical_spacing = px(15);
        var label_offset = px(85);

        drawText("Item count:", 0, vertical_spacing * 0);
        drawText(selection_info.selection_count + " (" + selection_info.selection_type_desc + ")", label_offset, vertical_spacing * 0);

        drawText("File size:", 0, vertical_spacing * 1);
        drawText(utils.FormatFileSize(selection_info.size), label_offset, vertical_spacing * 1);

        drawText("Duration:", 0, vertical_spacing * 2);

        var duration_text = utils.FormatDuration(selection_info.raw_duration);
        if (selection_info.duration) {
            duration_text += (" (" + utils.FormatDuration(selection_info.duration) + " Cut)");
        }

        drawText(duration_text, label_offset, vertical_spacing * 2);

        if (selection_info.comming_in || selection_info.finishing_in) {
            var comming_in = selection_info.comming_in && selection_info.comming_in > 0 ? utils.FormatDuration(selection_info.comming_in) : " - ";
            var comming_at = calculate_time(selection_info.comming_in);
            var finishing_at = calculate_time(selection_info.finishing_in);

            drawText("Comming in:", 0, vertical_spacing * 3);
            drawText(comming_in + " (" + comming_at + " - " + finishing_at + ")", label_offset, vertical_spacing * 3);
        }

        function calculate_time(milliseconds_until) {
            return milliseconds_until ? format_time(new Date(new Date().valueOf() + milliseconds_until*1000)) + "h" : "Now";
        }

        function drawText(text, offset_x, offset_y) {
            var border_offset = self.drawBorder ? 5 : 0;
            var color = window.GetColorDUI(ColorTypeDUI.text);
            gr.DrawString("" + text, font, color, self.x + offset_x + border_offset, self.y + offset_y + border_offset, self.w, self.h);
        }
    }
}

function SelectionFilesInfoPanel(w, h, font) {
    init_component(this, w, h);

    this.selectionInfo = null;

    this.setSelectionInfo = function(selectionInfo) {
        this.selectionInfo = selectionInfo;
    }

    this.draw = function(gr) {
        var self = this;

        if (!this.selectionInfo || this.selectionInfo.selection_count == 0) {
            return;
        }

        var vertical_spacing = px(16);
        var label_offset = px(90);

        drawText("File names:", 0, vertical_spacing * 0);
        drawText(format_array(this.selectionInfo.file_names), label_offset, vertical_spacing * 0);

        drawText("Folder names:", 0, vertical_spacing * 1);
        drawText(format_array(this.selectionInfo.folder_names), label_offset, vertical_spacing * 1);

        function drawText(text, offset_x, offset_y) {
            var color = window.GetColorDUI(ColorTypeDUI.text);
            gr.DrawString("" + text, font, color, self.x + offset_x, self.y + offset_y, 0, 0);
        }

        function format_array(array) {
            return array.join(", ")
        }
    }
}

function AdditionalSelectionInfoPanel(w, h, font) {
    init_component(this, w, h);

    this.selectionInfo = null;

    this.setSelectionInfo = function(selectionInfo) {
        this.selectionInfo = selectionInfo;
    }

    this.draw = function(gr) {
        var self = this;
        var line = 0;

        if (!this.selectionInfo || this.selectionInfo.selection_count == 0 || !this.selectionInfo.codec) {
            return;
        }

        gr.DrawRoundRect(this.x, this.y, this.w, this.h, px(3), px(3), px(1), Colors.Gray);

        var vertical_spacing = px(16);
        var label_offset = px(75);

        drawDatum("Audio info:", format_array([this.selectionInfo.codec, this.selectionInfo.bitrate, this.selectionInfo.sample_rate, this.selectionInfo.channels]));

        drawDatum("Tag type:", this.selectionInfo.tag_type, 1);

        if (this.selectionInfo.track_replay_gain) {
            drawDatum("Track gain:", this.selectionInfo.track_replay_gain + ", " + this.selectionInfo.track_replay_peak + " peak");
        }

        if (this.selectionInfo.album_replay_gain) {
            drawDatum("Album gain:", this.selectionInfo.album_replay_gain + ", " + this.selectionInfo.album_replay_peak + " peak");
        }

        function drawDatum(label, datum) {
            if (datum) {
                drawText(label, 0, vertical_spacing * line);
                drawText(datum, label_offset, vertical_spacing * line);

                line++;
            }
        }

        function drawText(text, offset_x, offset_y) {
            var color = window.GetColorDUI(ColorTypeDUI.text);
            gr.DrawString("" + text, font, color, self.x + offset_x + 5, self.y + offset_y + 5, 0, 0);
        }

        function format_array(array) {
            return array.join(", ");
        }
    }
}

