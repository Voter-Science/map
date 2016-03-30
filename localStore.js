// TypeScript
/// <reference path="typings\trc\trc.ts" />
// Provides a caching wrapper over an ISheetContents.
// Exposes get/set calls which will push updates to the server, but also maintain a cachin in LocalStore 
var SheetCache = (function () {
    function SheetCache(sheetRef, data) {
        this._sheetRef = sheetRef;
        this._data = data;
        this._counter = 0;
        this._modified = new Array(data["RecId"].length);
        this._totalUploaded = 0;
        // Initial from previous offline 
        for (var i = 0; i < localStorage.length; i++) {
            var x = SheetCache.fromLocalStorageKey(i);
            if (x != null) {
                this._counter++;
            }
        }
    }
    SheetCache.prototype.getTotalUploaded = function () {
        return this._totalUploaded;
    };
    SheetCache.prototype.getTotalNotYetUploaded = function () {
        return this._counter;
    };
    SheetCache.prototype.hasUnsavedChanges = function () {
        return this._counter > 0;
    };
    // Local keys have format:
    // {prefix}:{version}:{recId}:{columnName} = {newValue}
    SheetCache.toKey = function (recId, columnName) {
        var key = "_xsave:1:" + recId + ":" + columnName;
        return key;
    };
    // inverse of toKey()
    // null if no match 
    SheetCache.fromLocalStorageKey = function (i) {
        if (!SheetCache.startsWith(localStorage.key(i), "_xsave:1")) {
            return null;
        }
        var key = localStorage.key(i);
        var parts = key.split(':'); // _prefix:ver:recId:columnName                
        var x = {
            key: key,
            recId: parts[2],
            columnName: parts[3],
            newValue: localStorage[key]
        };
        return x;
    };
    // Either post to server, or save to local storage
    SheetCache.prototype.save = function (recId, columnName, newValue) {
        // Save to LocalStorage. When successfully uploaded to server, remove. 
        var key = SheetCache.toKey(recId, columnName);
        // If already exists, don't bump up count. 
        // Overwrite the value so we only send up the latest result. 
        if (localStorage.getItem(key) == null) {
            this._counter++;
        }
        localStorage.setItem(key, newValue);
        // Timer will flush to the server.
        this.create_timer();
        // Optimistically try to save ahead of the background flusher
        // USe exact same logic as background flusher.
        this.save_to_trc(function (success) { });
    };
    // Helper. 
    SheetCache.startsWith = function (x, searchString) {
        return x.indexOf(searchString, 0) === 0;
    };
    SheetCache.prototype.getRecIdByIndex = function (iRow) {
        return this._data["RecId"][iRow];
    };
    SheetCache.prototype.isModifiedByIndex = function (iRow) {
        return this._modified[iRow];
    };
    // TODO - add a callback so we know when it's successfully on the server. 
    SheetCache.prototype.updateValueByIndex = function (iRow, columnName, newValue) {
        var oldVal = this.getValueByIndex(iRow, columnName);
        if (oldVal != newValue) {
            this._modified[iRow] = true;
            var recId = this.getRecIdByIndex(iRow);
            this._data[columnName][iRow] = newValue; // update local cache
            this.save(recId, columnName, newValue); // push to server
        }
    };
    // Get the value of the data from the row index
    SheetCache.prototype.getValueByIndex = function (iRow, columnName) {
        return this._data[columnName][iRow];
    };
    // Create background time to drain 
    SheetCache.prototype.create_timer = function () {
        var _this = this;
        if (this._timerStarted) {
            return;
        }
        this._timerStarted = true;
        setInterval(function () {
            _this.save_to_trc(function (success) { });
        }, 60000 /* 60000 ms = 60 sec */);
    };
    // Public entry point to request immediate flush of offline data. 
    // Invoke the callback(true) if successfully flushed. callback(false) if errors, such as offline.  
    SheetCache.prototype.flush = function (doneFunc) {
        this.save_to_trc(doneFunc);
    };
    // Attempt to flush outstanding local changes to the server
    SheetCache.prototype.save_to_trc = function (doneFunc) {
        var l = [];
        for (var i = 0; i < localStorage.length; i++) {
            var x = SheetCache.fromLocalStorageKey(i);
            if (x != null) {
                l.push(x);
            }
        }
        // Flush all until we get a failure
        this.flush_worker(l, 0, doneFunc);
    };
    SheetCache.prototype.flush_worker = function (l, // list of possible keys to flush. 
        i, // index into l 
        doneFunc) {
        var _this = this;
        if (i >= l.length) {
            doneFunc(true);
            return;
        }
        var x = l[i];
        // Somebody already flushed this item. Cancel the chain and wait for the next sweep.
        if (localStorage.getItem(x.key) == null) {
            doneFunc(false);
            return;
        }
        trcPostSheetUpdateCell2(this._sheetRef, x.recId, x.columnName, x.newValue, function () {
            _this._totalUploaded++;
            if (localStorage.getItem(x.key) != null) {
                _this._counter--; // don't double-delete
            }
            localStorage.removeItem(x.key);
            // Try the next one 
            _this.flush_worker(l, i + 1, doneFunc);
        }, function () {
            // On network failure, stop trying to flush. 
            doneFunc(false);
        });
    };
    return SheetCache;
})();
// Update a single cell in the sheet. 
function trcPostSheetUpdateCell2(sheetRef, recId, colName, newValue, successFunc, failureFunc) {
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
            failureFunc();
        }
    });
}
