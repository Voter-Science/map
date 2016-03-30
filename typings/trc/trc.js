// TypeScript
// General purpose TypeScript definitions for using TRC
// Update a single cell in the sheet. 
function trcPostSheetUpdateCell(sheetRef, recId, colName, newValue, successFunc) {
    // We can post either application/json or text/csv
    var url = sheetRef.Server + "/sheets/" + sheetRef.SheetId;
    var body = {};
    body["RecId"] = [recId];
    body[colName] = [newValue];
    $.ajax({
        url: url,
        type: 'POST',
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + sheetRef.AuthToken);
        },
        contentType: "application/json",
        data: JSON.stringify(body),
        success: function () {
            successFunc();
        },
        error: function (data) {
            alert("Failed to Update cell (" + recId + ", " + colName + ") to value '" + newValue + "'.");
        }
    });
}
// Get metadata information about the sheet (such as name). 
// This is separate from retrieving the actual contents. 
function trcGetSheetInfo(sheetRef, successFunc) {
    var url = sheetRef.Server + "/sheets/" + sheetRef.SheetId + "/info";
    $.ajax({
        url: url,
        type: 'GET',
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + sheetRef.AuthToken);
        },
        success: function (info) {
            successFunc(info);
        },
        error: function (data) {
            alert("Failed to get sheet Info");
        }
    });
}
// Get sheet contents as a JSon object. 
function trcGetSheetContents(sheetRef, successFunc) {
    var url = sheetRef.Server + "/sheets/" + sheetRef.SheetId;
    $.ajax({
        url: url,
        type: 'GET',
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + sheetRef.AuthToken);
            // include the accept json header to get a response as ISheetContents. 
            // If we omit this, we get it back as a CSV. 
            xhr.setRequestHeader("accept", "application/json");
        },
        success: function (sheet) {
            successFunc(sheet);
        },
        error: function (data) {
            alert("Failed to get sheet contents");
        }
    });
}
function trcGetSheetDeltas(sheetRef, successFunc) {
    var url = sheetRef.Server + "/sheets/" + sheetRef.SheetId + "/deltas";
    $.ajax({
        url: url,
        type: 'GET',
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + sheetRef.AuthToken);
        },
        success: function (segment) {
            successFunc(segment);
        },
        error: function (data) {
            alert("Failed to get history Info");
        }
    });
}
// Attempt to get the TRC error message from the response.
function _getErrorMsg(error) {
    try {
        var p2 = JSON.parse(error.responseText);
        return "(" + p2.Code + ") " + p2.Message;
    }
    catch (err) {
        return error.responseText;
    }
}
// Do a login to convert a canvas code to a sheet reference. 
function trcPostLogin(loginUrl, canvasCode, successFunc) {
    var url = loginUrl + "/login/code2";
    var loginBody = {
        Code: canvasCode,
        AppName: "Demo"
    };
    $.support.cors = true;
    $.ajax({
        url: url,
        type: 'POST',
        contentType: "application/json",
        data: JSON.stringify(loginBody),
        success: function (sheetRef) {
            successFunc(sheetRef);
        },
        error: function (e1) {
            var msg = _getErrorMsg(e1);
            alert("Failed to do initial login at: " + loginUrl + " for code " + canvasCode + ": " + msg);
        }
    });
}
// Get a sheet ref given a sheet ID and auth token. 
function trcGetSheetRef(sheetId, original) {
    return {
        AuthToken: original.AuthToken,
        Server: original.Server,
        SheetId: sheetId
    };
}
// Create new Walklist for an explicit set of RecIds
function trcCreateChildSheet(sheetRef, name, recIds, successFunc) {
    // We can post either application/json or text/csv
    var url = sheetRef.Server + "/sheets/" + sheetRef.SheetId + "/child";
    var body = {
        Name: name,
        RecIds: recIds,
        ShareSandbox: true
    };
    $.ajax({
        url: url,
        type: 'POST',
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + sheetRef.AuthToken);
        },
        contentType: "application/json",
        data: JSON.stringify(body),
        success: function (sheet) {
            var childSheetRef = trcGetSheetRef(sheet.Id, sheetRef);
            successFunc(childSheetRef);
        },
        error: function (data) {
            alert("Failed to Create child sheet " + name);
        }
    });
}
// Delete a child sheet
function trcDeleteChildSheet(sheetRef, sheetIdChild, successFunc) {
    var url = sheetRef.Server + "/sheets/" + sheetRef.SheetId + "/child/"
        + sheetIdChild;
    $.ajax({
        url: url,
        type: 'DELETE',
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + sheetRef.AuthToken);
        },
        contentType: "application/json",
        success: function () {
            successFunc();
        },
        error: function (data) {
            alert("Failed to Update child sheet " + name);
        }
    });
}
// Limited patch operation to child sheet. 
// Update the RecIds on a child sheet. 
function trcPatchChildSheetRecIds(sheetRef, sheetIdChild, recIds, successFunc) {
    var url = sheetRef.Server + "/sheets/" + sheetRef.SheetId + "/child/"
        + sheetIdChild;
    var body = {
        RecIds: recIds,
        ShareSandbox: true
    };
    $.ajax({
        url: url,
        type: 'PATCH',
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + sheetRef.AuthToken);
        },
        contentType: "application/json",
        data: JSON.stringify(body),
        success: function () {
            successFunc();
        },
        error: function (data) {
            alert("Failed to Update child sheet " + name);
        }
    });
}
// Get the record Ids in this sheet. 
// This can be more optimized than getting the entire sheet
function trcGetRecIds(sheetRef, successFunc) {
    var filter = "Select=RecId";
    var url = sheetRef.Server + "/sheets/" + sheetRef.SheetId + "?" + filter;
    $.ajax({
        url: url,
        type: 'GET',
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + sheetRef.AuthToken);
            // include the accept json header to get a response as ISheetContents. 
            // If we omit this, we get it back as a CSV. 
            xhr.setRequestHeader("accept", "application/json");
        },
        success: function (sheet) {
            var recIds = sheet["RecId"];
            successFunc(recIds);
        },
        error: function (data) {
            alert("Failed to get recIds");
        }
    });
}
// Get metadata information about the sheet (such as name). 
// This is separate from retrieving the actual contents. 
function trcGetChildSheetInfo(sheetRef, successFunc) {
    var url = sheetRef.Server + "/sheets/" + sheetRef.SheetId + "/childsummary";
    $.ajax({
        url: url,
        type: 'GET',
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + sheetRef.AuthToken);
        },
        success: function (info) {
            successFunc(info);
        },
        error: function (data) {
            alert("Failed to get child sheet Info");
        }
    });
}
function trcCreateShareCode(sheetRef, email, successFunc) {
    $.ajax({
        url: sheetRef.Server + "/sheets/" + sheetRef.SheetId + "/share?email=" + email,
        type: 'POST',
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + sheetRef.AuthToken);
        },
        success: function (sheet) {
            // Sheet was created            
            successFunc(sheet.Code);
        },
        error: function (data) {
            alert("Failed to create a login code for sheet");
        }
    });
}
