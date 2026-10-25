import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const CopyOnSelectMode = {
    OFF: 'off',
    ALLOWLIST: 'allowlist',
    BLOCKLIST: 'blocklist',
    ALL: 'all',
};

const UnifyMode = {
    OFF: 'off',
    MIRROR: 'mirror',
    STRICT: 'strict',
};

const INTERFACE_SCHEMA = 'org.gnome.desktop.interface';
const PRIMARY_PASTE_KEY = 'gtk-enable-primary-paste';

// Wait for a drag selection to settle, so it costs a single read.
const READ_DEBOUNCE_MS = 150;

// The mimetypes st_clipboard_get_text() can convert.
const TEXT_MIMETYPES = [
    'text/plain;charset=utf-8',
    'UTF8_STRING',
    'text/plain',
    'STRING',
];

export default class ClipboardUnifierExtension extends Extension {
    // Bumped on disable() so a read still in flight knows it is obsolete.
    _epoch = 0;

    enable() {
        this._settings = this.getSettings();
        this._clipboard = St.Clipboard.get_default();
        this._selection = global.display.get_selection();
        this._tracker = Shell.WindowTracker.get_default();

        // Last known contents of each buffer, so handling one never reads the other.
        this._text = new Map();

        this._dirty = new Set();
        this._reading = null;
        this._timeoutId = 0;

        this._interfaceSettings = new Gio.Settings({ schema_id: INTERFACE_SCHEMA });
        this._middleClickId = this._settings.connect(
            'changed::enable-middle-click-paste', () => this._onMiddleClickSettingChanged());
        if (!this._settings.get_boolean('enable-middle-click-paste')) {
            this._disableMiddleClickPaste();
        }

        this._ownerChangedId = this._selection.connect('owner-changed',
            (_selection, type) => this._onOwnerChanged(type));

        this._queueRead(St.ClipboardType.PRIMARY);
        this._queueRead(St.ClipboardType.CLIPBOARD);
    }

    disable() {
        if (this._middleClickId) {
            this._settings.disconnect(this._middleClickId);
            this._middleClickId = null;
        }

        // This also runs on screen lock, so middle-click paste comes back while
        // the screen is locked and goes away again on unlock.
        this._restoreMiddleClickPaste();

        if (this._ownerChangedId) {
            this._selection.disconnect(this._ownerChangedId);
            this._ownerChangedId = null;
        }

        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }

        // get_text() takes no cancellable, so pending reads run to completion.
        this._epoch++;
        this._reading = null;

        this._dirty.clear();
        this._dirty = null;
        this._text.clear();
        this._text = null;
        this._selection = null;
        this._clipboard = null;
        this._tracker = null;
        this._interfaceSettings = null;
        this._settings = null;
    }

    get _active() {
        return !!this._settings;
    }

    _isStale(epoch) {
        return !this._active || epoch !== this._epoch;
    }

    _onOwnerChanged(type) {
        if (type === Meta.SelectionType.SELECTION_PRIMARY) {
            this._queueRead(St.ClipboardType.PRIMARY);
        } else if (type === Meta.SelectionType.SELECTION_CLIPBOARD) {
            this._queueRead(St.ClipboardType.CLIPBOARD);
        }
    }

    _queueRead(type) {
        if (!this._active) {
            return;
        }

        this._dirty.add(type);
        this._scheduleRead();
    }

    _scheduleRead() {
        if (this._timeoutId || this._reading !== null || this._dirty.size === 0) {
            return;
        }

        const epoch = this._epoch;

        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, READ_DEBOUNCE_MS, () => {
            this._timeoutId = 0;

            if (!this._isStale(epoch)) {
                this._startRead();
            }

            return GLib.SOURCE_REMOVE;
        });
    }

    _startRead() {
        const [type] = this._dirty;
        if (type === undefined || this._reading !== null) {
            return;
        }

        this._dirty.delete(type);

        // get_text() runs its callback synchronously when there is no text to
        // read. Check first so every read completes the same way.
        if (!this._hasText(type)) {
            this._text.set(type, '');
            this._handleChange(type, '');
            this._scheduleRead();
            return;
        }

        this._reading = type;

        const epoch = this._epoch;

        this._clipboard.get_text(type, (_clipboard, text) => {
            if (this._isStale(epoch)) {
                return;
            }

            this._reading = null;
            this._text.set(type, text ?? '');
            this._handleChange(type, text ?? '');

            this._scheduleRead();
        });
    }

    _hasText(type) {
        const mimetypes = this._clipboard.get_mimetypes(type) ?? [];

        return mimetypes.some(mimetype => TEXT_MIMETYPES.includes(mimetype));
    }

    _handleChange(type, text) {
        if (type === St.ClipboardType.PRIMARY) {
            this._onPrimaryChanged(text);
        } else {
            this._onClipboardChanged(text);
        }
    }

    _onPrimaryChanged(text) {
        if (this._shouldForward()) {
            if (this._isAcceptable(text)) {
                this._write(St.ClipboardType.CLIPBOARD, text);
            }
        } else if (this._settings.get_string('unify-mode') === UnifyMode.STRICT) {
            this._write(St.ClipboardType.PRIMARY, this._text.get(St.ClipboardType.CLIPBOARD));
        }
    }

    _onClipboardChanged(text) {
        if (this._settings.get_string('unify-mode') !== UnifyMode.OFF) {
            this._write(St.ClipboardType.PRIMARY, text);
        }
    }

    // Wayland and XWayland clients report different identifiers, so try both.
    _focusedWindowIds() {
        const window = global.display.focus_window;
        if (!window) {
            return [];
        }

        const ids = [];
        const appId = this._tracker.get_window_app(window)?.get_id();

        if (appId) {
            ids.push(appId);
        }

        const wmClass = window.get_wm_class();
        if (wmClass) {
            ids.push(wmClass);
        }

        return ids;
    }

    _shouldForward() {
        const mode = this._settings.get_string('copy-on-select-mode');
        if (mode === CopyOnSelectMode.OFF) {
            return false;
        }
        if (mode === CopyOnSelectMode.ALL) {
            return true;
        }

        const ids = this._focusedWindowIds();
        const list = this._settings.get_strv('app-list');
        const listed = ids.some(id =>
            list.some(entry => entry.toLowerCase() === id.toLowerCase()));

        return mode === CopyOnSelectMode.BLOCKLIST ? !listed : listed;
    }

    _onMiddleClickSettingChanged() {
        if (this._settings.get_boolean('enable-middle-click-paste')) {
            this._settings.set_boolean('restore-middle-click-paste', false);
            this._interfaceSettings.set_boolean(PRIMARY_PASTE_KEY, true);
        } else {
            this._disableMiddleClickPaste();
        }
    }

    // This is a GNOME setting, not ours. Remember when we were the ones who
    // turned it off, so disable() only undoes our own change.
    _disableMiddleClickPaste() {
        if (this._interfaceSettings.get_boolean(PRIMARY_PASTE_KEY)) {
            this._settings.set_boolean('restore-middle-click-paste', true);
            this._interfaceSettings.set_boolean(PRIMARY_PASTE_KEY, false);
        }
    }

    _restoreMiddleClickPaste() {
        if (this._settings.get_boolean('restore-middle-click-paste')) {
            this._settings.set_boolean('restore-middle-click-paste', false);
            this._interfaceSettings.set_boolean(PRIMARY_PASTE_KEY, true);
        }
    }

    _isAcceptable(text) {
        if (!text) {
            return false;
        }
        if (this._settings.get_boolean('ignore-whitespace-only') && !text.trim()) {
            return false;
        }

        return text.length >= this._settings.get_int('min-selection-length');
    }

    // Skipping no-op writes is what keeps our own echo from looping.
    _write(type, text) {
        if (!text || this._text.get(type) === text) {
            return;
        }

        this._text.set(type, text);
        this._clipboard.set_text(type, text);
    }
}
