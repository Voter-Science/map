// TypeScript
// JScript functions for BasicList.Html.
// This calls TRC APIs and binds to specific HTML elements from the page.
/// <reference path="typings\trc\trc.ts" />
/// <reference path="localStore.ts" />
var _sheetCache;
var noshowColumns = ["Lat", "Long", "RecId", "City", "Zip", "PrecinctName"];
var fixLabelsColumns = { FirstName: "First Name", LastName: "Last Name", ResultOfContact: "Result Of Contact", Birthday: "Age" };
var watchId;
var timer_started = false;
////take this out in production
$('#one').css('display', 'none');
////
$(window).bind('beforeunload', function () {
    return 'Leaving the application now might result in loosing unsaved data.';
});
var fixValuesColumns = { Birthday: function (val) {
        var d = new Date(Date.parse(val));
        return _calculateAge(d);
    }
};
// Startup function called by the plugin
function PluginMain(sheet) {
    // clear previous results
    $('#one').css('display', 'block');
    $.mobile.loading('show', {
        text: 'Populating map',
        textVisible: true,
        theme: 'e',
        html: ""
    });
    trcGetSheetInfo(sheet, function (info) {
        if (info.CountRecords > 1000) {
            alert("Sheet has too many voters. Select a precinct or use geofencing to break into a smaller region. ");
        }
        trcGetSheetContents(sheet, function (data) {
            $('#map_canvas').gmap();
            _sheetCache = new SheetCache(sheet, data);
            mapSheet(info, data);
        });
    });
}
function save_entry(prefix, iRow, data, info) {
    var change_was_made = false;
    for (var i = 0; i < info.Columns.length; i++) {
        if (!info.Columns[i].IsReadOnly) {
            var columnName = info.Columns[i].Name;
            if ($.inArray(columnName, noshowColumns) == -1) {
                var _newvalue = $("#" + prefix + columnName).val();
                if (columnName == 'Party') {
                    _newvalue = $("#details_Party :radio:checked").data('selected_value');
                }
                else if (columnName == 'Supporter') {
                    _newvalue = $("#details_Supporter :radio:checked").data('selected_value');
                }
                else if (columnName == 'ResultOfContact') {
                    _newvalue = $("#details_ResultOfContact").val();
                }
                if (_newvalue != undefined) {
                    _sheetCache.updateValueByIndex(iRow, columnName, _newvalue);
                    if (data[columnName][iRow] != _newvalue) {
                        change_was_made = true;
                    }
                }
            }
        }
    }
    if (change_was_made) {
        $('#map_canvas').gmap('find', 'markers', {}, function (marker) {
            if ($.inArray(parseInt(iRow), marker.iRow) > -1) {
                marker.setIcon('marker_grey.png');
            }
        });
    }
    back_to_list();
}
function parse2(x) {
    if (x == "") {
        return 0;
    }
    return parseFloat(x);
}
// Represent combined party code at a household
var HouseholdPartyCode;
(function (HouseholdPartyCode) {
    HouseholdPartyCode[HouseholdPartyCode["Unknown"] = 0] = "Unknown";
    HouseholdPartyCode[HouseholdPartyCode["AllGop"] = 1] = "AllGop";
    HouseholdPartyCode[HouseholdPartyCode["AllDem"] = 2] = "AllDem";
    HouseholdPartyCode[HouseholdPartyCode["Mixed"] = 3] = "Mixed";
})(HouseholdPartyCode || (HouseholdPartyCode = {}));
function getPartyImage(x) {
    if (x == HouseholdPartyCode.AllDem) {
        return "marker_Blue.png";
    }
    if (x == HouseholdPartyCode.AllGop) {
        return "marker_Red.png";
    }
    if (x == HouseholdPartyCode.Mixed) {
        return "marker_Purple.png";
    }
    if (x == HouseholdPartyCode.Unknown) {
        return "marker_Unknown.png";
    }
}
function getPartyCode(party) {
    if (party == '1' || party == '2') {
        return HouseholdPartyCode.AllGop;
    }
    if (party == '4' || party == '5') {
        return HouseholdPartyCode.AllDem;
    }
    return HouseholdPartyCode.Unknown;
}
function mergePartyCode(a, b) {
    if (a == HouseholdPartyCode.Unknown) {
        return b;
    }
    if (b == HouseholdPartyCode.Unknown) {
        return a;
    }
    if (a == HouseholdPartyCode.Mixed || b == HouseholdPartyCode.Mixed) {
        return HouseholdPartyCode.Mixed;
    }
    if (a == b) {
        return a;
    }
    return HouseholdPartyCode.Mixed;
}
function mapSheet(info, data) {
    populate_info_screen(info);
    populate_local_storage_screen("");
    var numRows = info.CountRecords;
    {
        for (var i = 0; i < info.Columns.length; i++) {
            var columnInfo = info.Columns[i];
            if (columnInfo.Name == "Party") {
                // Touchup party possible values if missing. 
                if (columnInfo.PossibleValues == null) {
                    columnInfo.PossibleValues = ['0', '1', '2', '3', '4', '5'];
                }
            }
            else if (columnInfo.Name == "Supporter") {
            }
            else if (columnInfo.PossibleValues != null) {
                // Any multiple-choice question is optional.                 
                columnInfo.PossibleValues.unshift("");
            }
        }
    }
    var houseHolds = [];
    for (var iRow = 0; iRow < numRows; iRow++) {
        var party = data["Party"][iRow];
        var itm = {
            lat: parse2(data["Lat"][iRow]),
            long: parse2(data["Long"][iRow]),
            address: data["Address"][iRow],
            irows: [iRow],
            partyX: getPartyCode(party),
            altered: !(!data["ResultOfContact"][iRow])
        };
        var allready_in_idx = -1;
        var i = 0;
        // TODO - N^2 search, replace with hash
        houseHolds.forEach(function (entry) {
            if (entry.lat == itm.lat && entry.long == itm.long) {
                allready_in_idx = i;
                if (itm.altered) {
                    houseHolds[allready_in_idx].altered = true;
                    houseHolds[allready_in_idx].partyX = mergePartyCode(houseHolds[allready_in_idx].partyX, itm.partyX);
                }
                return;
            }
            i++;
        });
        if (allready_in_idx >= 0) {
            houseHolds[allready_in_idx].irows.push(iRow);
        }
        else {
            houseHolds.push(itm);
        }
    }
    $("#set_in_search").html('');
    var nextId = 1;
    houseHolds.forEach(function (entry) {
        var x2 = entry; // TODO ?x2
        var last_address = data["Address"][x2];
        entry.irows.forEach(function (entry) {
            var content = '';
            if (last_address != data["Address"][entry]) {
                last_address = data["Address"][entry];
                content += ' <li data-role="list-divider">Address: ' + last_address + '</li>';
            }
            var d = new Date(Date.parse(data["Birthday"][entry]));
            content += '<li id="' + entry + '"><a href="#">' + data["FirstName"][entry] + " " + data["LastName"][entry] + ', ' + _calculateAge(d) + data["Gender"][entry] + '</a></li>';
            $("#set_in_search").append(content);
            nextId++;
        });
    });
    $('#set_in_search').listview();
    $('#set_in_search').listview('refresh');
    $('#set_in_search').delegate('li', 'click', function () {
        if ($(this).prop('id') != 'NaN') {
            var id = $(this).prop('id');
            $("#the_search_list").hide();
            $("#the_details_search").show();
            $("#the_details_form_search").html("");
            $.each(info.Columns, function (key, ivalue) {
                $("#the_details_form_search").append(create_field("searchdetails_", ivalue.Name, ivalue.DisplayName, data[ivalue.Name][id], ivalue.IsReadOnly, ivalue.Type, ivalue.PossibleValues));
                initialize_field("searchdetails_", ivalue.Name, ivalue.Type, ivalue.PossibleValues);
            });
        }
    });
    houseHolds.forEach(function (entry) {
        if (entry.lat != 0 && entry.long != 0) {
            $('#map_canvas').gmap('addMarker', {
                'position': new google.maps.LatLng(entry.lat, entry.long),
                'bounds': true,
                'icon': (entry.altered ? 'marker_grey.png' : getPartyImage(entry.partyX)),
                'iRow': entry.irows
            }).click(function () {
                var nextId = 1;
                $.mobile.loading('show');
                $.mobile.navigate("#p");
                $("#set").html('');
                var x2 = entry; // TODO ?x2
                var last_address = data["Address"][x2];
                this.iRow.forEach(function (entry) {
                    var content = '';
                    if (last_address != data["Address"][entry]) {
                        last_address = data["Address"][entry];
                        content += ' <li data-role="list-divider">Address: ' + last_address + '</li>';
                    }
                    var _imgPartyMap = {
                        '0': "PartyLabel-0.png",
                        '1': "GopLogo.png",
                        '2': "GopLogoSoft.png",
                        '3': "PartyLabel-3.png",
                        '4': "DemLogoSoft.png",
                        '5': "DemLogo.png"
                    };
                    var d = new Date(Date.parse(data["Birthday"][entry]));
                    content += '<li id="' + entry + '"><a href="#">' + data["FirstName"][entry] + " " + data["LastName"][entry] + ', ' + _calculateAge(d) + data["Gender"][entry] + '' +
                        '<img src="' + (!(!data["ResultOfContact"][entry]) ? 'marker_grey.png' : _imgPartyMap[data["Party"][entry]]) + '"></a>' +
                        '</li>';
                    $("#set").append(content);
                    nextId++;
                });
                $('#household_fields').html('');
                $.each(info.Columns, function (key, ivalue) {
                    if (ivalue.Name == "ResultOfContact") {
                        $('#household_fields').append(create_field("household_", ivalue.Name, ivalue.DisplayName, "", ivalue.IsReadOnly, ivalue.Type, ivalue.PossibleValues));
                        initialize_field("household_", ivalue.Name, ivalue.Type, ivalue.PossibleValues);
                    }
                });
                $('#set').listview();
                if (nextId < 10) {
                    $("#set").prev("form.ui-filterable").hide();
                }
                else {
                    $("#set").prev("form.ui-filterable").show();
                }
                $('#set').listview('refresh');
                $('#set').delegate('li', 'click', function () {
                    if ($(this).prop('id') != 'NaN') {
                        ///var id=$(this).attr('id');
                        var id = $(this).prop('id');
                        $("#the_list").hide();
                        $("#the_details").show();
                        $("#the_details_form").html("");
                        $("#details_save_button").unbind();
                        $('#details_save_button').addClass('ui-disabled');
                        $("#details_save_button").click(function () {
                            save_entry("details_", id, data, info);
                        });
                        $.each(info.Columns, function (key, ivalue) {
                            $("#the_details_form").append(create_field("details_", ivalue.Name, ivalue.DisplayName, data[ivalue.Name][id], ivalue.IsReadOnly, ivalue.Type, ivalue.PossibleValues));
                            initialize_field("details_", ivalue.Name, ivalue.Type, ivalue.PossibleValues);
                        });
                    }
                });
                back_to_list();
                $("input[data-type='search']").val('').keyup();
                $.mobile.loading('hide');
            });
        }
    });
    $.mobile.loading('hide');
    initGeolocation();
}
function back_to_list() {
    $("#the_details").hide();
    $("#the_list").show();
}
function back_to_search_list() {
    $("#the_details_search").hide();
    $("#the_search_list").show();
}
function multiple_choise_widget(name, label, value, PossibleValues) {
    var ret = '<div class="field-contain">';
    ret += '      <label for="' + name + '">' + label + ':</label>';
    ret += '<select name="' + name + '" id="' + name + '" data-iconpos="left">';
    $.each(PossibleValues, function (key, ivalue) {
        ret += '  <option value="' + ivalue + '" ' + (ivalue == value ? 'selected="selected"' : '') + '>' + ivalue + ' </option>';
    });
    ret += '</select> </div>';
    return ret;
}
function multiple_choise_widget_horizontal(name, label, value, // current value 
    PossibleValues, images // map of values --> Image name 
    ) {
    var ret = '<fieldset id="' + name + '" data-role="controlgroup" data-type="horizontal" >';
    ret += '        <legend>' + label + ':</legend>';
    $.each(PossibleValues, function (key, ivalue) {
        var imgHtml = "";
        var img = images[ivalue];
        if (img != undefined) {
            imgHtml = "<img src='" + img + "'/>";
        }
        ret += ' <input type="radio" ' +
            'data-selected_value="' + ivalue + '"' +
            'name="' + name + '-choice" id="' + name + key + '" ' + (ivalue == value ? 'value="on" checked="checked"' : '') + '>';
        ret += ' <label for="' + name + key + '">' + ivalue + imgHtml + '</label>';
    });
    ret += ' </fieldset>';
    return ret;
}
function initialize_field(prefix, name, type, PossibleValues) {
    if (name == 'Lat' || name == 'Long') {
    }
    else if (name == 'Party' || name == 'Supporter') {
        $("#" + prefix + name).controlgroup();
        $("#" + prefix + name).change(function () {
            $('#details_save_button').removeClass('ui-disabled');
        });
    }
    else if (type == 'Text') {
        if (PossibleValues == null) {
            $("#" + prefix + name).textinput();
            $("#" + prefix + name).change(function () {
                $('#details_save_button').removeClass('ui-disabled');
            });
        }
        else {
            $("#" + prefix + name).selectmenu();
            $("#" + prefix + name).change(function () {
                $('#details_save_button').removeClass('ui-disabled');
            });
        }
    }
}
// Logos for standard party Id. 
var _imgPartyMap = {
    '0': "PartyLabel-0.png",
    '1': "GopLogo.png",
    '2': "GopLogoSoft.png",
    '3': "PartyLabel-3.png",
    '4': "DemLogoSoft.png",
    '5': "DemLogo.png"
};
function create_field(prefix, name, label, value, readonly, type, PossibleValues) {
    if (fixValuesColumns[label] != null) {
        value = fixValuesColumns[label](value);
    }
    if (fixLabelsColumns[label] != null) {
        label = fixLabelsColumns[label];
    }
    if ($.inArray(name, noshowColumns) > -1) {
        var _return = '';
    }
    else if (name == 'Party' || name == 'Supporter') {
        var _return = multiple_choise_widget_horizontal(prefix + name, label, value, PossibleValues, _imgPartyMap);
    }
    else if (type == 'Text') {
        if (PossibleValues == null) {
            if (readonly) {
                var _return = ' <div data-role="fieldcontain">' + label + ': <strong>' + value + '    </strong></div>';
            }
            else {
                var _return = ' <div data-role="fieldcontain">    <label for="' + prefix + name + '">' + label + ': </label><input id="' + prefix + name + '" ' + (readonly ? 'readonly ' : '') + ' type="text" value="' + value + '"></div>';
            }
        }
        else {
            var _return = multiple_choise_widget(prefix + name, label, value, PossibleValues);
        }
    }
    else if (type == "Boolean") {
        var _return = multiple_choise_widget(prefix + name, label, value, PossibleValues);
    }
    else if (type == "MultipleChoice") {
        var _return = multiple_choise_widget(prefix + name, label, value, PossibleValues);
    }
    return _return;
}
function refresh_populate_local_storage_screen() {
    _sheetCache.flush(function (success) {
        var msg = success ? "Successfully connected to server." : "Can't connect to server. Are you online?";
        populate_local_storage_screen(msg);
    });
}
function populate_local_storage_screen(msg) {
    var x = _sheetCache.getTotalNotYetUploaded();
    var y = _sheetCache.getTotalUploaded();
    // var label = x + " results not yet uploaded. (" + y + " results uploaded)";
    $("#local_storage_sheet_form").html('');
    $("#local_storage_sheet_form").append(create_field("local_", "LocalChanges", "Number of changes not yet uploaded:", x, true, "Text", null));
    $("#local_storage_sheet_form").append(create_field("local_", "SavedChanges", "Number of changes uploaded:", y, true, "Text", null));
    $("#local_storage_sheet_form").append(create_field("local_", "LastStatus", "Last upload attempt:", msg, true, "Text", null));
}
function populate_info_screen(info) {
    $("#sheet_info_form").html('');
    $("#sheet_info_form").append(create_field("info_", "CountRecords", "Records Count", info.CountRecords, true, "Text", null));
    initialize_field("info_", "CountRecords", "Text", null);
    $("#sheet_info_form").append(create_field("info_", "Name", "Name", info.Name, true, "Text", null));
    initialize_field("info_", "Name", "Text", null);
    $("#sheet_info_form").append(create_field("info_", "ParentName", "Parent Name", info.ParentName, true, "Text", null));
    initialize_field("info_", "ParentName", "Text", null);
    var m = moment(info.LastModified);
    $("#sheet_info_form").append(create_field("info_", "LastModified", "Last Modfied", m.format('LLL'), true, "Text", null));
    initialize_field("info_", "LastModified", "Text", null);
}
function toTitleCase(str) {
    return str.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}
function _calculateAge(birthday) {
    var ageDifMs = Date.now() - birthday.getTime();
    var ageDate = new Date(ageDifMs); // miliseconds from epoch
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}
// new ken functions
$('#flip-location').click(function () {
    var curVal = $("#flip-location").val();
    if (curVal == "on") {
        initGeolocation();
    }
    else {
    }
});
function disableGeolocation() {
    if (navigator && navigator.geolocation) {
        if (watchId != null) {
            navigator.geolocation.clearWatch(watchId);
        }
    }
}
function initGeolocation() {
    if (navigator && navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(successCallback, errorCallback, { enableHighAccuracy: true, timeout: 60000, maximumAge: 60000 });
    }
    else {
        console.log('Geolocation is not supported');
    }
}
function errorCallback() { }
function successCallback(position) {
    var myLatlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
    console.log(myLatlng);
    var position_not_found = true;
    $('#map_canvas').gmap('find', 'markers', {}, function (marker) {
        if (marker.iRow[0] == -1) {
            marker.setPosition(myLatlng);
            position_not_found = false;
        }
    });
    if (position_not_found) {
        $('#map_canvas').gmap('addMarker', { 'position': myLatlng, 'bounds': false, 'icon': 'me.png', 'iRow': [-1] });
    }
}
//# sourceMappingURL=MobileMapView.js.map