import React from 'react'
import {DocsThemeConfig} from 'nextra-theme-docs'
import Logo from "./components/logo";

const config: DocsThemeConfig = {
    primaryHue: 34,
    project: {
        link: 'https://github.com/andronixApp',
    },
    chat: {
        link: 'https://chat.andronix.app',
    },
    docsRepositoryBase: 'https://github.com/andronixApp/andronix-docs-v2',
    footer: {
        text: <span>
      Andronix Documentation {new Date().getFullYear()} © <a href="https://andronix.app" target="_blank">Andronix App</a>.
    </span>,
    },
    head: (
        <>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta property="og:title" content="Andronix Documentation" />
            <meta property="og:description" content="Install Linux distributions like Ubuntu, Manjaro, Debian on Android without root." />
        </>
    ),
    logo: Logo,
    banner: {
        key: 'phantom-process-banner/',
        text: <a href="/android-12/andronix-on-android-12-and-beyond" target="_blank">
            🚨 Resolve <strong>Process completed (signal 9) - press Enter</strong> error now →
        </a>,
    },
}

export default config
