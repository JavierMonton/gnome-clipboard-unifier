import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const COPY_ON_SELECT_MODES = ['off', 'allowlist', 'blocklist', 'all'];
const COPY_ON_SELECT_LABELS = [
    'Never',
    'Only in listed applications',
    'Everywhere except listed applications',
    'Everywhere',
];

const UNIFY_MODES = ['off', 'mirror', 'strict'];
const UNIFY_LABELS = ['Off', 'Mirror (recommended)', 'Strict'];

const TERMINAL_CATEGORY = 'TerminalEmulator';

// Entries are desktop file IDs or raw WM_CLASS strings.
function describeEntry(entry) {
    const info = entry.endsWith('.desktop') ? Gio.DesktopAppInfo.new(entry) : null;

    if (info)
        return {name: info.get_display_name(), icon: info.get_icon(), subtitle: entry};

    return {name: entry, icon: null, subtitle: 'Matched by window class'};
}

function buildAppRow(entry, onRemove) {
    const {name, icon, subtitle} = describeEntry(entry);
    const row = new Adw.ActionRow({title: name, subtitle});

    if (icon)
        row.add_prefix(new Gtk.Image({gicon: icon, pixel_size: 32}));

    const removeButton = new Gtk.Button({
        icon_name: 'user-trash-symbolic',
        valign: Gtk.Align.CENTER,
        css_classes: ['flat', 'error'],
        tooltip_text: 'Remove this application',
    });
    removeButton.connect('clicked', () => onRemove(entry));
    row.add_suffix(removeButton);

    return row;
}

function showAppChooser(parent, onChosen) {
    const dialog = new Adw.Window({
        transient_for: parent,
        modal: true,
        title: 'Add Application',
        default_width: 460,
        default_height: 560,
    });

    const search = new Gtk.SearchEntry({
        placeholder_text: 'Search applications',
        margin_top: 6,
        margin_bottom: 6,
        margin_start: 12,
        margin_end: 12,
    });

    const listBox = new Gtk.ListBox({
        selection_mode: Gtk.SelectionMode.NONE,
        css_classes: ['boxed-list'],
        margin_start: 12,
        margin_end: 12,
        margin_bottom: 12,
    });
    listBox.set_filter_func(row => {
        const query = search.get_text().trim().toLowerCase();

        return query === '' || row.searchText.includes(query);
    });
    listBox.connect('row-activated', (_list, row) => {
        onChosen(row.entryId);
        dialog.close();
    });
    search.connect('search-changed', () => listBox.invalidate_filter());

    const apps = Gio.AppInfo.get_all()
        .filter(info => info.should_show())
        .sort((a, b) => a.get_display_name().localeCompare(b.get_display_name()));

    for (const info of apps)
        listBox.append(buildChooserRow(info));

    const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
    box.append(search);
    box.append(new Gtk.ScrolledWindow({vexpand: true, child: listBox}));

    const toolbarView = new Adw.ToolbarView({content: box});
    toolbarView.add_top_bar(new Adw.HeaderBar());
    dialog.set_content(toolbarView);
    dialog.present();
}

function buildChooserRow(info) {
    const row = new Adw.ActionRow({
        title: info.get_display_name(),
        subtitle: info.get_id(),
        activatable: true,
    });

    row.entryId = info.get_id();
    row.searchText = `${info.get_display_name()} ${info.get_id()}`.toLowerCase();

    const icon = info.get_icon();
    if (icon)
        row.add_prefix(new Gtk.Image({gicon: icon, pixel_size: 32}));

    return row;
}

export default class ClipboardUnifierPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'edit-paste-symbolic',
        });

        page.add(buildCopyOnSelectGroup(window._settings));
        page.add(buildApplicationsGroup(window, window._settings));
        page.add(buildMiddleClickGroup(window._settings));

        window.add(page);
        window.set_default_size(620, 780);
    }
}

function buildCopyOnSelectGroup(settings) {
    const group = new Adw.PreferencesGroup({
        title: 'Copy on select',
        description: 'Choose where selecting text with the mouse also copies it, ' +
            'so Ctrl+V pastes it.',
    });

    group.add(buildEnumRow(settings, 'Copy selected text', null,
        'copy-on-select-mode', COPY_ON_SELECT_MODES, COPY_ON_SELECT_LABELS));

    const minLength = new Adw.SpinRow({
        title: 'Minimum length',
        subtitle: 'Shorter selections are not copied',
        adjustment: new Gtk.Adjustment({lower: 1, upper: 1000, step_increment: 1}),
    });
    settings.bind('min-selection-length', minLength, 'value', Gio.SettingsBindFlags.DEFAULT);
    group.add(minLength);

    const ignoreWhitespace = new Adw.SwitchRow({
        title: 'Ignore selections that are only spaces',
    });
    settings.bind('ignore-whitespace-only', ignoreWhitespace, 'active',
        Gio.SettingsBindFlags.DEFAULT);
    group.add(ignoreWhitespace);

    return group;
}

function buildApplicationsGroup(window, settings) {
    const group = new Adw.PreferencesGroup({
        title: 'Applications',
        description: 'Usually your terminals.',
    });

    let rows = [];

    const addRow = row => {
        group.add(row);
        rows.push(row);
    };

    const setEntries = entries => {
        settings.set_strv('app-list', entries);
        refresh();
    };

    const addEntry = entry => {
        const entries = settings.get_strv('app-list');

        if (!entries.includes(entry))
            entries.push(entry);

        setEntries(entries);
    };

    const removeEntry = entry => {
        setEntries(settings.get_strv('app-list').filter(e => e !== entry));
    };

    const addTerminals = () => {
        const entries = settings.get_strv('app-list');

        for (const info of Gio.AppInfo.get_all()) {
            const categories = info.get_categories()?.split(';') ?? [];

            if (categories.includes(TERMINAL_CATEGORY) && !entries.includes(info.get_id()))
                entries.push(info.get_id());
        }

        setEntries(entries);
    };

    const refresh = () => {
        for (const row of rows)
            group.remove(row);

        rows = [];

        const entries = settings.get_strv('app-list');

        if (entries.length === 0) {
            addRow(new Adw.ActionRow({
                title: 'No applications yet',
                subtitle: 'Use the + button, or detect your terminals below',
            }));
        } else {
            for (const entry of entries)
                addRow(buildAppRow(entry, removeEntry));
        }

        const detectRow = new Adw.ActionRow({
            title: 'Add installed terminals',
            subtitle: 'Finds every terminal app on this computer',
        });
        const detectButton = new Gtk.Button({label: 'Detect', valign: Gtk.Align.CENTER});
        detectButton.connect('clicked', addTerminals);
        detectRow.add_suffix(detectButton);
        addRow(detectRow);
    };

    const addButton = new Gtk.Button({
        icon_name: 'list-add-symbolic',
        valign: Gtk.Align.CENTER,
        css_classes: ['flat'],
        tooltip_text: 'Add an application',
    });
    addButton.connect('clicked', () => showAppChooser(window, addEntry));
    group.set_header_suffix(addButton);

    refresh();

    return group;
}

function buildMiddleClickGroup(settings) {
    const group = new Adw.PreferencesGroup({
        title: 'Configuration',
    });

    group.add(buildEnumRow(settings, 'Mode',
        'Mirror (recommended): unifies the clipboards. Best when middle-click paste is disabled.\n' +
        'Strict: recommended when middle-click paste is enabled, but it can break text selection in some apps. Check the docs.',
        'unify-mode', UNIFY_MODES, UNIFY_LABELS));

    const middleClick = new Adw.SwitchRow({
        title: 'Enable middle-click paste',
        subtitle: 'Paste with the mouse wheel. Some apps might ignore this.',
    });
    settings.bind('enable-middle-click-paste', middleClick, 'active',
        Gio.SettingsBindFlags.DEFAULT);
    group.add(middleClick);

    return group;
}

function buildEnumRow(settings, title, subtitle, key, nicks, labels) {
    const row = new Adw.ComboRow({
        title,
        model: Gtk.StringList.new(labels),
        selected: Math.max(0, nicks.indexOf(settings.get_string(key))),
    });

    if (subtitle)
        row.subtitle = subtitle;

    row.connect('notify::selected', () => settings.set_string(key, nicks[row.selected]));

    return row;
}
