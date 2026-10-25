# Clipboard Unifier

An opinionated GNOME Shell extension that makes Linux behave as if it had one
clipboard.

## Features

- Pick the applications where **select to copy** works, usually terminals.
- Keep the two copy&paste buffers **in sync**, so `Ctrl+V` always pastes what
  you copied.
- **Turn off middle-click paste**, which it does by default.

## The short version

Install it, add your terminal, and leave the two settings alone. The defaults
are **Mirror** with **middle-click paste disabled**, which is the combination
worth recommending:

- `Ctrl+C` anywhere, `Ctrl+V` anywhere. One clipboard.
- Select text with the mouse **in a terminal** and it is copied, so `Ctrl+V`
  pastes it.
- Select text with the mouse **anywhere else** and nothing happens to your
  clipboard. Your selection also stays selected, so you can edit it, delete it
  or copy it, exactly as you would without the extension.
- The mouse wheel does not paste anything.

The rest of this file explains the settings and why these are the defaults.

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

## Paste what you copied

This setting decides what middle-click pastes. It has three values.

### Mirror (the default)

Every time you copy something, middle-click pastes it too. Text you select
with the mouse is never touched, so nothing deselects itself in any
application. That is why it is the default.

### Strict

Same as Mirror, plus: when you select text with the mouse in an application
that is not on your list, the extension puts your last copy back right away,
undoing that selection.

Read the comparison below before picking it.

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
mouse **deselects itself** a moment after you select it. In Nautilus that
means:

- When renaming a file, you cannot select part of the name to fix it. The
  selection disappears and `Backspace` has nothing to delete.
- You cannot select text with the mouse and then press `Ctrl+C`. By the time
  you press it nothing is selected, so nothing is copied.
- Text you highlight just to read it stops looking highlighted.

This happens because only one application can own the selection at a time.
Taking it back hands it to the extension, and GTK applications clear their
highlight when that happens. There is no way to ask them not to.

Applications **on your list** are not affected in either mode. Their
selections are copied, not undone.

### At a glance

The middle-click rows assume you turned middle-click paste back on.

| What you do | Mirror | Strict | Off |
| --- | --- | --- | --- |
| Select in a terminal, `Ctrl+V` elsewhere | pastes it | pastes it | pastes it |
| Select part of a file name to rename it | stays selected | deselects itself | stays selected |
| Select in a help page, then `Ctrl+C` | copies it | copies nothing | copies it |
| Middle-click after `Ctrl+C` | pastes what you copied | pastes what you copied | pastes your last selection |
| Middle-click after selecting in Nautilus | pastes that selection | pastes what you copied | pastes that selection |

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
GTK applications; Firefox, Qt and Electron applications have their own
settings.

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
  was the one that turned it off. This also happens while the screen is
  locked.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
