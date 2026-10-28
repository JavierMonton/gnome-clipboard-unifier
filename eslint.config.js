import {defineConfig} from 'eslint/config';
import gnome from 'eslint-config-gnome';

export default defineConfig([
    gnome.configs.recommended,
    {
        languageOptions: {
            globals: {
                global: 'readonly',
            },
        },
    },
]);
