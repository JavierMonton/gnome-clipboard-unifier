# Clipboard Unifier

An opinionated GNOME Shell extension that makes Linux behave as if it had one
clipboard.

Annoyed by your paste shortcuts pasting something you didn't copy? 
Or by copying something you selected by error on a random application? 

This extension keeps your buffers in sync and allows you to enable/disable copy-on-select for specific applications.



## Features

- Keep the two copy&paste buffers **in sync**, so all **paste shortcuts** always pastes what
  you copied.
- **Copy on select** enabled/disabled only for applications you choose.
- Optionally, **Turn off middle-click paste**.

## The short version

This has been designed to unify the clipboard experience in Linux, 
and to enable the copy-on-select feature only for applications where it is useful, like terminals.
Middle-click for paste is disabled by default, as it improves the experience (see details below), but it can be enabled.


The default configurations are **Mirror** with **middle-click paste disabled**.
You can also add applications to the list, and copy-on-select will be enabled for them, and disabled for all others. 
It's designed to be used with terminals, so you can autodetect them easily.

With this configuration:

- All copy&paste shortcuts work the same way everywhere. One clipboard.
- Select text with the mouse **in a terminal** (or the applications you chose) and it is copied.
- Select text with the mouse **anywhere else** and nothing happens to your
  clipboard. Your selection also stays selected, so you can edit it, delete it
  or copy it, exactly as you would without the extension.
- The mouse wheel does not paste anything.

## Why?

Linux carries two independent text buffers:

| Buffer | Written by | Pasted with |
| --- | --- | --- |
| `PRIMARY` | every application, automatically, as soon as you select text with the mouse | middle-click, and `Shift+Insert` in some apps |
| `CLIPBOARD` | an explicit copy: `Ctrl+C`, or a menu entry | `Ctrl+V`, `Shift+Insert` |

Two buffers means two things to keep track of, and I kept losing that race
several times a day:

1. I select some text in a terminal. It goes to `PRIMARY` only.
2. I switch to a browser and click the address bar. The browser selects the
   URL, overwriting `PRIMARY`.
3. `Ctrl+V` pastes something stale from `CLIPBOARD`, and middle-click pastes
   the URL I just clicked on. Neither is what I selected in the terminal.

In my opinion, copy on select is really useful in a terminal and a nuisance
everywhere else. Linux has no way to set that per application, so this
extension adds it, and keeps the two buffers in sync.

## Modes

### Mirror (the default)

Perfect if middle-click paste is disabled. It unifies the two buffers.

### Strict

If middle-click paste is enabled, there are some situations where middle-click could paste
something different from the regular clipboard. Strict closes that gap, but it has a side effect:
it could deselect text you selected with the mouse in some applications.

### Off

Middle-click works as usual and pastes whatever you last selected. Copy on
select still works for the applications on your list.

## Middle-click paste, and the gap

With middle-click paste **disabled** (the default), Mirror is all you need and
you can skip this section.

If you turn middle-click paste back on, Mirror leaves a gap. The wheel pastes
what you last copied, until you select some text with the mouse in an
application that is not on your list: a file name in Nautilus, a sentence in
a browser or a text editor. From then on the wheel pastes *that* instead,
until you copy something again.

**Strict closes that gap.** It puts your last copy back immediately, so the
wheel always pastes what you copied, whatever you have selected since.

The downside shows up in those same applications: text you select with the
mouse **deselects itself** a moment after you select it. 

This happens because only one application can own the selection at a time.
Taking it back hands it to the extension, and GTK applications clear their
highlight when that happens. There is no way to ask them not to.

Applications **on your list** are not affected in either mode. Their
selections are copied, not undone.

## The other settings

**Copy selected text**

| Option | What it does |
| --- | --- |
| Never | Selecting text never copies it |
| Only in listed applications | The usual choice: terminals, and nothing else |
| Everywhere except listed applications | The other way round, to leave out a few applications |
| Everywhere | Every selection is copied |

**Applications**: desktop file IDs such as `org.gnome.Terminal.desktop`, or
window classes (`WM_CLASS`). Both are compared with the focused window,
ignoring case. *Detect* adds every installed terminal.

**Enable middle-click paste**: off by default. This is GNOME's own
`gtk-enable-primary-paste` setting. The extension turns it off, and turns it
back on when you enable this switch or disable the extension. It only affects
GTK applications;

**Minimum length** and **Ignore selections that are only spaces** stop a
stray click or drag from replacing your clipboard.

## Install

From extensions.gnome.org, or from source:

```sh
git clone https://github.com/JavierMonton/gnome-clipboard-unifier
cd gnome-clipboard-unifier
make install
```

## Development

```sh
make install   # Install extension locally
make package   # Build the ZIP for extensions.gnome.org
make test      # Run basic validation
make dev       # Watch for changes and auto-install
```

## Notes

- Text only. Images and other non-text selections are ignored rather than
  mangled.
- Do not run it alongside another clipboard synchroniser. GPaste's
  "synchronize clipboards" option and this extension will fight each other.
  Clipboard *history* managers are fine.
- Strict does nothing while your clipboard is empty, so after login it only
  starts undoing selections once you have copied something.
- Disabling the extension turns middle-click paste back on, if the extension
  was the one that turned it off.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
