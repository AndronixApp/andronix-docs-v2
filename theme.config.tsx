import React from 'react'
import {DocsThemeConfig} from 'nextra-theme-docs'

const config: DocsThemeConfig = {
    logo: <span>Andronix Documentation</span>,
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
}

export default config
