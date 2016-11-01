///////////////////////////////////
// Constants and global objects //
/////////////////////////////////

var CrossFadeDelay = get_config("CrossFadeDelay", 100);

var SongGapLength = get_config("SongGapLength", 2000);

var FadeOutLength = get_config("FadeOutLength", 5000);

var MaxVolume = 0;

var MinVolume = -100;

////////////////////////
// Dpi scaling     ////
//////////////////////

function dpi_scaling() {
    return get_config("DpiScaling", 1.00001);
}

function px(value) {
    return value * dpi_scaling();
}

///////////////////////////
// Path manipulation  ////
/////////////////////////


function set_current_directory(dir) {
    WshShell.CurrentDirectory = dir;
}

function add_to_path(folder) {
    var process_environment = WshShell.Environment("Process");
    var existing_path = process_environment("PATH");
    var additional_path = fb.FoobarPath + "..\\" + folder + ";";
    
    if (!contains(existing_path, additional_path)) {
        process_environment("PATH") = additional_path + existing_path;
    }
}

///////////////////////////
// Event handling     ////
/////////////////////////

var EventHandlers = {};
var OneTimeEventHandlers = {};

function register_event_handler(events, handler) {
    do_register_event_handler(events, handler, EventHandlers);
}

function register_one_time_event_handler(events, handler) {
    do_register_event_handler(events, handler, OneTimeEventHandlers);
}

function do_register_event_handler(events, handler, event_handler_dict) {
    if (!_.isArray(events)) {
        events = [events];
    }

    _.forEach(events, function(evnt) {
        var handler_list = event_handler_dict[evnt];
        if (!handler_list) {
            handler_list = event_handler_dict[evnt] = [];
        }

        handler_list.push(handler);
    }); 
}

function do_fire_event_handlers(evnt, event_handler_dict, args) {
    var handler_list = event_handler_dict[evnt];
    if (handler_list) {
        for(var i = 0; i < handler_list.length; i++) {
            handler_list[i].apply(this, args);
        }
    }
}

function fire_event_handlers(evnt, args) {
    do_fire_event_handlers(evnt, EventHandlers, args);
    do_fire_event_handlers(evnt, OneTimeEventHandlers, args);

    OneTimeEventHandlers[evnt] = [];
}

//events
function on_playlist_items_added() {
    fire_event_handlers(on_playlist_items_added, arguments);
}

function on_playback_starting() {
    fire_event_handlers(on_playback_starting, arguments);
}

function on_playback_new_track() {
    fire_event_handlers(on_playback_new_track, arguments);
}

function on_playback_seek() {
    fire_event_handlers(on_playback_seek, arguments);
}

function on_playback_pause() {
    fire_event_handlers(on_playback_pause, arguments);
}

function on_playback_stop() {
    fire_event_handlers(on_playback_stop, arguments);
}

function on_playback_time() {
    fire_event_handlers(on_playback_time, arguments);
}

function on_key_down() {
    fire_event_handlers(on_key_down, arguments);
}

function on_playlist_stop_after_current_changed() {
    fire_event_handlers(on_playlist_stop_after_current_changed, arguments);
}

function on_selection_changed() {
    fire_event_handlers(on_selection_changed, arguments);
}

function on_playlist_items_selection_change() {
    fire_event_handlers(on_playlist_items_selection_change, arguments);
}

function on_playlist_items_added(playlistIndex) {
    fire_event_handlers(on_playlist_items_added, arguments);
}

function on_playlist_items_removed(playlistIndex, new_count) {
    fire_event_handlers(on_playlist_items_removed, arguments);
}

function on_playlist_items_reordered(playlistIndex) {
    fire_event_handlers(on_playlist_items_reordered, arguments);
}

function on_playlist_switch() {
    fire_event_handlers(on_playlist_switch, arguments);
}

function on_playlists_changed() {
    fire_event_handlers(on_playlists_changed, arguments);
}

function on_item_focus_change() {
    fire_event_handlers(on_item_focus_change, arguments);
}

function on_volume_change() {
    fire_event_handlers(on_volume_change, arguments);
}

function on_fade_out_and_next() {
    fire_event_handlers(on_fade_out_and_next, arguments);
}

function on_script_unload() {
    fire_event_handlers(on_script_unload, arguments);
}

///////////////////////////
// Reload support     ////
/////////////////////////

function on_notify_data(name, info) {
    if (name == "Reload") {
        window.Reload();
    }

    fire_event_handlers(on_notify_data, arguments);
}

function reload() {
    window.NotifyOthers("Reload", null);
    window.Reload();
}

///////////////////////////
// Common functions   ////
/////////////////////////

function make_http_request(method, url, handler, timeout_handler, timeout) {
    var request = new ActiveXObject("MSXML2.XmlHttp.6.0");

    function handle_readystate() {
        if (request.readyState == 4 /* complete */) {
            try {
                handler(request);
            } catch(e) {
                fb.trace("Error while handling XMLHTTP request: " + JSON.stringify(e));
            }
        }
    }

    if (contains(url, "?")) {
        url = url + "&_=" + new Date();
    } else {
        url = url + "?_=" + new Date();
    } 

    request.open(method, url, true);
    request.onreadystatechange = handle_readystate;
    request.send();

    if (!timeout) {
        timeout = 5000;
    }

	window.SetTimeout(function() {
        if (request.readyState != 4) {
            try {
                request.abort();

                if (timeout_handler) {
                    timeout_handler(request);
                }
            } catch(e) {
                fb.trace("Error while handling XMLHTTP request timeout: " + JSON.stringify(e));
            }
        }
    }, timeout);
    
}

function round(number, precision) {
    var factor = 1/Math.abs(precision);

    var tempNumber = number * factor;
    var roundedTempNumber = Math.round(tempNumber);

    return roundedTempNumber / factor;
}

function parse_iso_date(str, default_time) {
    var parts = str.split(" ");

    var date_str = parts[0];
    var date_parts = date_str.split("-");

    var year = new Number(date_parts[0]);
    var month = new Number(date_parts[1]);
    var day = new Number(date_parts[2]);

    var time_str = default_time;
    if (parts.length > 1) {
        time_str = parts[1];
    }
    var time_parts = time_str.split(":");

    var hours = new Number(time_parts[0]);
    var minutes = new Number(time_parts[1]);

    var seconds = 0;
    if (time_parts.length > 2) {
        seconds = new Number(time_parts[2]);
    }

    if (_.isNaN(year) || _.isNaN(month) || _.isNaN(day) || _.isNaN(hours) || _.isNaN(minutes) || _.isNaN(seconds)) {
        return null;
    }

    return new Date(year, month - 1, day, hours, minutes, seconds);
}

function pad_zero(value) {
    var str = value.toString();

    if (str.length < 2) {
        str = "0" + str;
    }

    return str;
}

function format_iso_date(date) {
    var result = 
        date.getYear() + "-" +
        pad_zero(date.getMonth() + 1) + "-" + 
        pad_zero(date.getDate()) + " " +
        pad_zero(date.getHours()) + ":" +
        pad_zero(date.getMinutes()) + ":" +
        pad_zero(date.getSeconds());

    return result;
}

function format_time(date) {
    return pad_zero(date.getHours()) + ":" + pad_zero(date.getMinutes());
}

function contains(str) {
    if (!str) {
        return false;
    }

    str = str.toLowerCase();

    for(var i = 1; i < arguments.length; i++) {
        if (str.indexOf(arguments[i].toLowerCase()) != -1) {
            return true;
        }
    }

    return false;
}

function replace(str, replacement) {
    function regex_escape(regex_str) {
        var specials = /[.*+?|()\[\]{}\\$^]/g; //chars are .*+?|()[]{}\$^
        return regex_str.replace(specials, "\\$&");
    }

    for(var i = 2; i < arguments.length; i++) {
        var regex = new RegExp("(" + regex_escape(arguments[i]) + ")", "gi");
        str = str.replace(regex, replacement);
    }

    return str;
}

function is_dj_foobar() {
    return contains(fb.ComponentPath, "\\foobar2000dj\\");
}

function set_config(name, value) {
    window.SetProperty(name, value);
}

function get_config(name, default_value) {
    return window.GetProperty(name, default_value);
}

function default_config(name, value) {
    window.GetProperty(name, value);
}

function toggle_config(name) {
    var result = !get_config(name);
    set_config(name, result);

    return result;
}

function is_playing(consider_loading_equal_to_playing) {
    return fb.IsPlaying && !fb.IsPaused && (consider_loading_equal_to_playing || fb.GetNowPlaying());
}

function tf(format, item) {
    var title_format = fb.TitleFormat(format);
    var result = title_format.EvalWithMetadb(item);

    title_format.Dispose();
    return result;
}

function get_item_info(item) {
    if (!item) {
        return null;
    }

    return {
        item: item,
        artist: tf("[%artist%]", item),
        title: tf("[%title%]", item),
        genre: tf("[%genre%]", item),
        directory: tf("$directory_path(%path%)", item),
        filename: tf("%filename_ext%", item),
        path: item.Path,
        length: item.Length
    };
}

function is_network_file(item) {
    return !!get_network_path(item);
}

function get_network_path(item) {
    var raw_path = tf("%_path_raw%", item);
    if (_.startsWith(raw_path, "file://")) {
        return null;
    }

    return replace(raw_path, "https://", "3dydfy://")
}

function extract_domain(url) {
    var domain_start = url.indexOf("://") + 3;
    url = url.slice(domain_start);

    var first_slash = url.indexOf("/");
    if (first_slash != -1) {
        url = url.slice(0, first_slash);
    }

    return url;
}

//////////////////////////////
// Volume, fading, etc...  //
////////////////////////////

var VolumeKnob = (function() {
    default_config("CurrentReferenceVolume", MaxVolume);

    function get_reference_volume_cfg() {
        return get_config("CurrentReferenceVolume");
    }

    function set_reference_volume_cfg(value) {
        return set_config("CurrentReferenceVolume", value);
    }

    function adjust_reference_volume() {
        if (fb.Volume > get_reference_volume_cfg()) {
            set_reference_volume_cfg(fb.Volume);
        }
    }

    return {
        getVolume: function getVolume() {
            adjust_reference_volume();

            return pos2vol(vol2pos(fb.Volume)/vol2pos(get_reference_volume_cfg()));
        },

        setVolume: function setVolume(vol) {
            fb.Volume =  pos2vol(vol2pos(get_reference_volume_cfg()) * vol2pos(vol));
        },

        setReferenceVolume: function setReferenceVolume(vol) {
            var relative_volume = getVolume();

            set_reference_volume_cfg(vol);
            
            setVolume(relative_volume);
        },

        compare: function compare(vol, delta) {
            var diff = vol - getVolume();

            if (Math.abs(diff) <= delta) {
                return 0;
            }

            if (diff < 0) {
                return -1;
            }

            return 1;
        }
    }
})();

function get_fade_out_delay(original_volume, target_volume, delta, current_volume, duration) {
    delta = Math.abs(delta);

    var original_pos = vol2pos(original_volume);
    var target_pos = vol2pos(target_volume);
    
    var current_pos = vol2pos(current_volume);
    var next_pos = vol2pos(current_volume - (target_volume < original_volume ? -delta : delta));
    
    var result = duration * Math.abs(current_pos - next_pos)/Math.abs(original_pos - target_pos);

    if (result < 1) {
        result = 1;
    }

    return result;
}

function delay_after_crossfade(callback) {
	window.SetTimeout(callback, CrossFadeDelay);
}

var global_fade_id = 0;
function fade_to(target_volume, duration, terminate_on_playing_change, faded_callback) {
    if (!is_playing() && terminate_on_playing_change) {
        return;
    }

    var precision = 0.5;
    var delta = VolumeKnob.compare(target_volume, precision) * precision;

    if (delta == 0) {
        faded_callback && faded_callback(VolumeKnob.getVolume());
        return;
    }

    global_fade_id++;
    
    var original_volume = VolumeKnob.getVolume();
    var fade_id = global_fade_id;
    var now_playing = fb.GetNowPlaying();

    function should_terminate_fading() {
        return fade_id != global_fade_id || 
               (terminate_on_playing_change &&
                (!is_playing() || fb.GetNowPlaying().RawPath != now_playing.RawPath));
    }
    
    (function do_fade_out() {
        if (should_terminate_fading()) {
            return;
        }
                
        if (VolumeKnob.compare(target_volume, precision) * delta > 0) {
            VolumeKnob.setVolume(VolumeKnob.getVolume() + delta);

            var delay = get_fade_out_delay(original_volume, target_volume, delta, VolumeKnob.getVolume(), duration);

            window.SetTimeout(do_fade_out, delay);
        } else {
            window.SetTimeout(function() {
                if (should_terminate_fading()) {
                    return;
                }

                faded_callback && faded_callback(original_volume);
            }, SongGapLength);
        }
    })();
}

function fade_out_and_next(finished_callback) {
    fade_to(MinVolume, FadeOutLength, true, function(original_volume) {
        var now_playing = fb.GetNowPlaying();

        if (fb.StopAfterCurrent) {
			var playing_item_location = plman.GetPlayingItemLocation();
			
			if (!playing_item_location.IsValid || (playing_item_location.PlaylistItemIndex == plman.PlaylistItemCount(playing_item_location.PlaylistIndex) - 1)) {
				fb.Stop();
				
				delay_after_crossfade(function() {
                    VolumeKnob.setVolume(original_volume);

					finished_callback && finished_callback(now_playing);
					on_fade_out_and_next(now_playing);
				});
			} else {
				fb.Next();

				register_one_time_event_handler(on_playback_new_track, function() {
					fb.Stop();
					
					delay_after_crossfade(function() {
                        VolumeKnob.setVolume(original_volume);

						finished_callback && finished_callback(now_playing);
						on_fade_out_and_next(now_playing);
					});
				});
			}
        } else {
            fb.Stop();
			
			delay_after_crossfade(function() {
                VolumeKnob.setVolume(original_volume);
				fb.Next();

				finished_callback && finished_callback(now_playing);
				on_fade_out_and_next(now_playing);
			});
        }
    });
}

//////////////////////////////
// Playlist manipulation   //
////////////////////////////

function get_last_playlist_selected_item(playlist_index) {
    var playlist_item_count = plman.PlaylistItemCount(playlist_index);

    for(var i = playlist_item_count - 1; i >= 0; i--) {
        if (plman.IsPlaylistItemSelected(playlist_index, i)) {
            return i;
        }
    }

    return null;
}

function get_playlist_selection(playlist_index) {
    var result = [];

    var playlist_item_count = plman.PlaylistItemCount(playlist_index);
    var selection_count = plman.GetPlaylistSelectedItems(playlist_index).Count;

    if (selection_count == 0) {
        return result;
    }
    
    for(var i = 0; i < playlist_item_count; i++) {
        if (plman.IsPlaylistItemSelected(playlist_index, i)) {
            result.push(i);

            if (result.length == selection_count) {
                break;
            }
        }
    }

    return result;
}

function restore_selection(playlist_index, playlist_selection) {
    plman.ClearPlaylistSelection(playlist_index);

    for(var i = 0; i < playlist_selection.length; i++) {
        var item_index = playlist_selection[i];
        plman.SetPlaylistSelectionSingle(playlist_index, item_index, true);
    }
}

function add_locations_to_playlist(playlist_index, locations, callback) {
    var location_counts = _.countBy(locations);

    register_one_time_event_handler(on_playlist_items_added, function() {
        var playlist_selection = get_playlist_selection(playlist_index);
        var playlist_items = plman.GetPlaylistItems(playlist_index);

        var items_to_insert = plman.GetPlaylistItems(-1);

        for(var i = playlist_selection.length - 1; i >= 0; i--) {
            var item_index = playlist_selection[i];
            var item = playlist_items.Item(item_index);

            for(var counter = 0; counter < location_counts[item.Path] - 1; counter++) {
                items_to_insert.Add(item);
            }

            location_counts[item.path] = 0;
        }

        plman.InsertPlaylistItems(playlist_index, plman.PlaylistItemCount(playlist_index), items_to_insert, true);
                
        callback();
    });

    plman.AddLocations(playlist_index, locations, true);
}

function replace_playlist_selected_items(playlist_index, replacement_func) {
    var original_playlist_selection = get_playlist_selection(playlist_index);
    var playlist_items = plman.GetPlaylistItems(playlist_index);

    var replacements = [];

    for(var i = 0; i < original_playlist_selection.length; i++) {
        var item_index = original_playlist_selection[i];
        var item = playlist_items.Item(item_index);

        var replacement_path = replacement_func(item, playlist_items, item_index);

        if (replacement_path) {
            replacements.push({index: item_index, path: replacement_path});
        }
    }

    if (replacements.length == 0) {
        return;
    }

    plman.UndoBackup(playlist_index);

    plman.ClearPlaylistSelection(playlist_index);

    add_locations_to_playlist(playlist_index, _.map(replacements, 'path'), function() {
        var playlist_selection = get_playlist_selection(playlist_index);
        playlist_items = plman.GetPlaylistItems(playlist_index);

        for(var i = playlist_selection.length - 1; i >= 0; i--) {
            var item_index = playlist_selection[i];
            var item = playlist_items.Item(item_index);

            var replacement = _.find(replacements, function(rep) {return rep.path == item.Path});

            if (replacement) {
                plman.ClearPlaylistSelection(playlist_index);
                plman.SetPlaylistSelectionSingle(playlist_index, item_index, true);
                plman.MovePlaylistSelection(playlist_index, -item_index + replacement.index + 1);

                plman.ClearPlaylistSelection(playlist_index);
                plman.SetPlaylistSelectionSingle(playlist_index, replacement.index, true);
                plman.RemovePlaylistSelection(playlist_index);

                _.remove(replacements, function(rep) {return rep == replacement});
            }
        }

        restore_selection(playlist_index, original_playlist_selection);
    });
}

//////////////////////////////
// Playstamp manipulation  //
////////////////////////////

function get_play_stamps(item) {
    function can_parse(stamp) {
        try {
            return !!parse_iso_date(stamp)
        } catch(e) {
            return false;
        }
    }

    var item_play_stamp = tf("[%play_stamp%]", item);

    if (item_play_stamp && item_play_stamp.length) {
        var item_play_stamps = item_play_stamp.split(", ");

        return _.filter(item_play_stamps, function(stamp) {
            return stamp && stamp.length && stamp != "?" && can_parse(stamp);
        });
    }

    return [];
}

function save_play_stamps(item, play_stamps) {
    play_stamps = _.sortBy(_.uniq(play_stamps));

    var play_count = play_stamps.length;

    var first_played = "";
    var last_played = "";

    if (play_count > 0) {
        var first_played = _.first(play_stamps);
        var last_played = _.last(play_stamps);
    }

    item.UpdateFileInfoSimple(
            "FIRST_PLAYED", first_played,
            "LAST_PLAYED", last_played,
            "PLAY_COUNTER", play_count,
            "PLAY_STAMP", play_stamps.join(";"),
            "PLAY_STAMP");
}

function merge_playstamps(item_infos) {
    var play_stamps = _.map(item_infos, function(item_info) {return get_play_stamps(item_info.item)});
    play_stamps = _.flatten(play_stamps);

    for(var i = 0; i < item_infos.length; i++) {
        save_play_stamps(item_infos[i].item, play_stamps);
    }
}

///////////////////////////
// Component manager  ////
/////////////////////////

var Components = {};

var ComponentMouseOver = null;
var ComponentMouseDown = null;

var ComponentState = {
    Normal: 0,
    Hover: 1,
    MouseDown: 2
}

function ComponentContainer(w, h, components) {
    init_component(this, w, h);

    this.components = components;

    this.getComponents = function() {
        return this.components;
    }
}

function for_each_component(func) {
    function for_each_component_in(components, func) {
        for(i in components) {
            var c = components[i];

            if (c instanceof ComponentContainer) {
                for_each_component_in(c.getComponents(), func);
            } else {
                func(c);
            }
        }
    }

    return for_each_component_in(Components, func);
}

function set_components(components) {
    var marginSize = 6;

    function min_width(component) {
        if (!component.width()) {
            return 10;
        }

        return component.width();
    }

    function set_coordinates(ww, hh, top, left, components) {
        var maxHeight = 0;

        var marginX = 0;
        var marginY = 0;

        for(i in components) {
            var component = components[i];

            if (marginX + min_width(component) >= ww && maxHeight != 0) {
                marginX = 0;
                marginY += (maxHeight + marginSize);
            }

            if (!component.width()) {
                var width = Math.floor(ww - marginX - 1);
                component.setSize(width, component.height());
            }

            if (component instanceof ComponentContainer) {
                set_coordinates(component.width(), component.height(), top + marginY, left + marginX, component.getComponents());
            } else {
                component.setCoordinates(left + marginX, top + marginY);
            }

            marginX += component.width() + marginSize;

            if (component.height() > maxHeight) {
                maxHeight = component.height();
            }
        }
    }

    Components = components;
    set_coordinates(window.Width, window.Height, marginSize, marginSize, Components);
}

function set_component_state(c, state) {
    var result = false;
    if (c) {
        result = c.setState(state);
        c.update();
    }

    return result;
}

function on_mouse_leave() {
    on_mouse_move(-10, -10);
}

function on_mouse_move(x, y) {
    function find_mouse_over_component() {
        var result = null;

        for_each_component(function(c) {
            if (x > c.left() && x < c.left() + c.width() && y > c.top() && y < c.top() + c.height()) {
                result = c;
            }
        });

        return result;
    }

    var component = find_mouse_over_component();

    if (component != ComponentMouseOver) {
        set_component_state(ComponentMouseOver, ComponentState.Normal);

        ComponentMouseOver = component;
    }

    if (component) {
        var set_state_result = set_component_state(component, component == ComponentMouseDown ? ComponentState.MouseDown : ComponentState.Hover);

        if (set_state_result) {
            window.SetCursor(IDC_HAND);
        } else {
            window.SetCursor(IDC_ARROW);
        }
    } else {
        window.SetCursor(IDC_ARROW);
    }
            
}

function on_mouse_lbtn_down(x, y) {
    ComponentMouseDown = ComponentMouseOver;
    set_component_state(ComponentMouseDown, ComponentState.MouseDown);
}

function on_mouse_lbtn_up(x, y) {
    if (ComponentMouseOver && ComponentMouseDown == ComponentMouseOver) {
        try {
            ComponentMouseOver.onClick(x, y);
        } catch(e) {
            fb.trace("Exception: " + JSON.stringify(e));
        }

        set_component_state(ComponentMouseDown, ComponentState.Hover);
    } else {
        set_component_state(ComponentMouseDown, ComponentState.Normal);
    }

    ComponentMouseDown = null;
}

function on_paint(gr) {
    if (window.Height < 5 || window.Width < 5) {
        gr.FillSolidRect(0, 0, window.Width, window.Height, Colors.LightGray);
        return;
    }

    gr.SetTextRenderingHint(5); // clear type
    gr.SetSmoothingMode(4); // Anti-Alias

    gr.FillSolidRect(0, 0, window.Width, window.Height, window.GetColorDUI(ColorTypeDUI.background));

    for_each_component(function(component) {
        component.draw(gr);
    });
}

////////////////////////
// GUI Library     ////
//////////////////////

function input(prompt, title, value) {
    prompt = prompt.replace(/"/g, _.q(" + Chr(34) + ")).replace(/\n/g, _.q(" + Chr(13) + "));
    title = title.replace(/"/g, _.q(" + Chr(34) + "));
    value = value.replace(/"/g, _.q(" + Chr(34) + "));

    var return_value = vb.eval("InputBox(" + _.q(prompt) + ", " + _.q(title) + ", " + _.q(value) + ")");
    return _.isUndefined(return_value) ? null : _.trim(return_value);
}

function dim_color(color, factor) {
    function dim(value) {
        return Math.round(value * factor);
    }

    if (!factor) {
        factor = 0.8;
    }

    return RGB(dim(getRed(color)), dim(getGreen(color)), dim(getBlue(color)));
}

function mix_colors(color1, color2) {
    function mix(value1, value2) {
        return Math.round((value1 + value2) / 2);
    }

    return RGB(mix(getRed(color1), getRed(color2)), mix(getGreen(color1), getGreen(color2)), mix(getBlue(color1), getBlue(color2)));
}

function init_component(self, w, h) {
    function do_init_component(w, h) {
        this.w = w;
        this.h = h;

        this.componentState = ComponentState.Normal;
        
        this.update = function() {
            if (this.x && this.y && this.w && this.h) {
                window.RepaintRect(this.x, this.y, this.x + this.w, this.y + this.h);
            }
        }

        this.setCoordinates = function(x, y) {
            this.x = x;
            this.y = y;
        }

        this.setSize = function(w, h) {
            this.w = w;
            this.h = h;
        }

        this.top = function() {
            return this.y;
        }

        this.left = function() {
            return this.x;
        }
        
        this.width = function() {
            return this.w;
        }

        this.height = function() {
            return this.h;
        }

        this.setState = function(componentState) {
            return false;
        }

        this.draw = function(gr) {
        }

        this.onClick = function(x, y) {
        }
    }

    do_init_component.call(self, w, h);
}

function Button(w, h, font, caption, func) {
    init_component(this, w, h);

    this.toggled = false;

    if (_.isString(caption)) {
        this.caption = caption;
        this.image = null;
    } else {
        this.caption = null;
        this.image = gdi.Image(caption.normal);
    }

    this.draw = function(gr) {
        if (this.caption) {
            if (this.componentState == ComponentState.Hover || this.componentState == ComponentState.MouseDown) {
                var hover_background = window.GetColorDUI(ColorTypeDUI.background); 
                hover_background = dim_color(hover_background, 0.6);
                gr.FillRoundRect(this.x, this.y, this.w, this.h, px(3), px(3), hover_background);
            }
    
            var border_color = mix_colors(window.GetColorDUI(ColorTypeDUI.selection), window.GetColorDUI(ColorTypeDUI.highlight));
            gr.DrawRoundRect(this.x + px(1), this.y + px(1), this.w - px(2), this.h - px(2), px(3), px(3), this.toggled ? px(3) : px(1), border_color);

            var offset = this.componentState == ComponentState.MouseDown ? px(2) : 0;
            var text_color = window.GetColorDUI(ColorTypeDUI.text);
            gr.DrawString(this.caption, font, text_color, this.x + offset, this.y + offset, this.w, this.h, 0x11005000);
        } else {
            _.drawImage(gr, this.image, this.x, this.y, this.w, this.h);
        }
    }

    this.setState = function(componentState) {
        this.componentState = componentState;
        return true;
    }

    this.setToggled = function(value) {
        this.toggled = value;
        this.update();
    }

    this.onClick = function(x, y) {
        func && func(x, y);
    }
}

function toggle_button(button, config_property) {
    var value = toggle_config(config_property);

    button.setToggled(value);
}

var MenuVisible = false;

function create_popup_menu() {
    var menuItems = [];

    return {
        appendSeparator: function() {
            menuItems.push({type: "Separator"});
        },

        appendMenuItem: function(text, handler, checked) {
            menuItems.push({
                type: arguments.length > 2 ? "Checkbox" : "Standard",
                text: text,
                handler: handler,
                checked: checked
            });
        },

        show: function(x, y) {
            if (MenuVisible) {
                return;
            }

            var popupMenu = window.CreatePopupMenu();

            _.forEach(menuItems, function(menuItem, i) {
                if (menuItem.type == "Separator") {
                    popupMenu.AppendMenuSeparator();

                    for(var i = 2; i < dpi_scaling(); i++) {
                        popupMenu.AppendMenuSeparator();
                    }
                } else {
                    popupMenu.AppendMenuItem(MF_STRING, i + 1, menuItem.text);

                    if (menuItem.type == "Checkbox") {
                        popupMenu.CheckMenuItem(i + 1, menuItem.checked);
                    }
                }
            });

            MenuVisible = true;
            window.SetCursor(IDC_ARROW);

            var selectedMenuItemId = popupMenu.TrackPopupMenu(x, y);

            if (selectedMenuItemId != 0) {
                var clickedMenuItem = menuItems[selectedMenuItemId - 1];
                clickedMenuItem.handler(!clickedMenuItem.checked);
            }
            
            window.setTimeout(function() {MenuVisible = false}, 50);

            popupMenu.Dispose();
        }
    }
}

