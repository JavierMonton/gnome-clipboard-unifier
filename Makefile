# Clipboard Unifier - run `make help` for the targets.

UUID = clipboard-unifier@javiermonton.github.io
NAME = clipboard-unifier
VERSION = 1

SRC_DIR = src
SCHEMA_DIR = schemas
BUILD_DIR = build
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SCHEMA_XML = $(SCHEMA_DIR)/org.gnome.shell.extensions.$(NAME).gschema.xml

.PHONY: all build install uninstall package clean test enable prefs dev help

all: build

build:
	@echo "Building extension..."
	@glib-compile-schemas $(SCHEMA_DIR)
	@echo "Build complete"

install: build
	@echo "Installing extension to $(INSTALL_DIR)..."
	@mkdir -p $(INSTALL_DIR)/schemas
	@cp metadata.json $(INSTALL_DIR)/
	@cp $(SRC_DIR)/extension.js $(INSTALL_DIR)/
	@cp $(SRC_DIR)/prefs.js $(INSTALL_DIR)/
	@cp $(SCHEMA_DIR)/*.xml $(INSTALL_DIR)/schemas/
	@glib-compile-schemas $(INSTALL_DIR)/schemas/
	@echo "Installation complete"
	@echo "Log out and back in to load it, then run: make enable"

uninstall:
	@echo "Uninstalling extension..."
	@rm -rf $(INSTALL_DIR)
	@echo "Extension uninstalled"

# metadata.json must be at the root of the ZIP.
package: build
	@echo "Creating extension package..."
	@rm -rf $(BUILD_DIR)/$(UUID)
	@mkdir -p $(BUILD_DIR)/$(UUID)/schemas
	@cp metadata.json $(BUILD_DIR)/$(UUID)/
	@cp $(SRC_DIR)/extension.js $(BUILD_DIR)/$(UUID)/
	@cp $(SRC_DIR)/prefs.js $(BUILD_DIR)/$(UUID)/
	@cp LICENSE $(BUILD_DIR)/$(UUID)/
	@cp $(SCHEMA_DIR)/*.xml $(BUILD_DIR)/$(UUID)/schemas/
	@cd $(BUILD_DIR)/$(UUID) && zip -qr ../../$(NAME)-v$(VERSION).zip .
	@rm -rf $(BUILD_DIR)/$(UUID)
	@echo "Package created: $(NAME)-v$(VERSION).zip"

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(BUILD_DIR)
	@rm -f $(SCHEMA_DIR)/gschemas.compiled
	@rm -f $(NAME)-*.zip
	@echo "Clean complete"

test: build
	@echo "Validating metadata.json..."
	@python3 -m json.tool metadata.json > /dev/null && echo "  ok: valid JSON"
	@python3 -c "import json,sys; m=json.load(open('metadata.json')); \
		sys.exit('  FAIL: version field is set by extensions.gnome.org' \
		if 'version' in m else 0)" && echo "  ok: no version field"
	@python3 -c "import json,sys; m=json.load(open('metadata.json')); \
		sys.exit('  FAIL: uuid must not use the gnome.org namespace' \
		if 'gnome.org' in m['uuid'].split('@')[-1] else 0)" && echo "  ok: uuid namespace"
	@echo "Checking JavaScript syntax..."
	@for f in $(SRC_DIR)/extension.js $(SRC_DIR)/prefs.js; do \
		if command -v node > /dev/null; then \
			node --check $$f && echo "  ok: $$f"; \
		else \
			echo "  skipped: node not installed"; \
		fi; \
	done
	@echo "Checking review guidelines..."
	@! grep -qE "^import (Gtk|Adw|Gdk) " $(SRC_DIR)/extension.js \
		&& echo "  ok: no Gtk/Adw/Gdk in extension.js"
	@! grep -qE "^import (Clutter|Meta|St|Shell) " $(SRC_DIR)/prefs.js \
		&& echo "  ok: no Clutter/Meta/St/Shell in prefs.js"
	@! grep -qE "ByteArray|imports\.lang|imports\.mainloop" $(SRC_DIR)/*.js \
		&& echo "  ok: no deprecated imports"
	@echo "Validating schema..."
	@echo "  ok: compiled by glib-compile-schemas"
	@if command -v xmllint > /dev/null; then \
		xmllint --noout $(SCHEMA_XML) && echo "  ok: schema XML is well formed"; \
	else \
		echo "  skipped: xmllint not installed"; \
	fi
	@echo "Validation complete"

enable:
	@gnome-extensions enable $(UUID)
	@gnome-extensions info $(UUID)

prefs:
	@gnome-extensions prefs $(UUID)

dev: install
	@echo "Development mode: watching for changes. Ctrl+C to stop."
	@while true; do \
		inotifywait -qre modify,create,delete $(SRC_DIR) $(SCHEMA_DIR) metadata.json 2>/dev/null; \
		echo "Changes detected, reinstalling..."; \
		$(MAKE) --no-print-directory install; \
	done

help:
	@echo "Clipboard Unifier - Build System"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build      Compile GSettings schemas"
	@echo "  install    Install to ~/.local/share/gnome-shell/extensions/"
	@echo "  uninstall  Remove the installed extension"
	@echo "  package    Create the ZIP for extensions.gnome.org"
	@echo "  clean      Remove build artifacts"
	@echo "  test       Validate metadata, syntax, schema and review guidelines"
	@echo "  enable     Enable the installed extension"
	@echo "  prefs      Open the preferences window"
	@echo "  dev        Reinstall automatically on every change"
