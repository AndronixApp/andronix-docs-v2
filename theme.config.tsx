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
      Andronix Documentation {new Date().getFullYear()} © <a href="https://andronix.app"
                                                             target="_blank">Andronix App</a>.
    </span>,
    },
    sidebar: {
        titleComponent({ title, type }) {
            if (type === 'separator') {
                return <span className="cursor-default">{title}</span>
            }
            return <>{title}</>
        },
        defaultMenuCollapseLevel: 1,
        toggleButton: true,
    },
    head: (
        <>
            <title>Andronix Documentation</title>
            <meta name="title" content="Andronix Documentation"/>
            <meta name="description"
                  content="Andronix lets you install Linux distributions like Ubuntu, Debian, and Manjaro on non-rooted Android devices. Read our documentation for step-by-step instructions."/>

            {/*FB*/}
            <meta property="og:type" content="website"/>
            <meta property="og:url" content="https://docs.andronix.app/"/>
            <meta property="og:title" content="Andronix Documentation"/>
            <meta property="og:description"
                  content="Andronix lets you install Ubuntu, Debian, and Manjaro on non-rooted Android devices. Our documentation provides step-by-step instructions and troubleshooting tips to help you set up your Linux environment quickly and easily. Experience the power of Linux on your mobile device with Andronix."/>
            <meta property="og:image" content="https://docs.andronix.app/og.png"/>

            {/*Twitter*/}
            <meta property="twitter:card" content="summary_large_image"/>
            <meta property="twitter:url" content="https://docs.andronix.app/"/>
            <meta property="twitter:title" content="Andronix Documentation"/>
            <meta property="twitter:description"
                  content="Andronix lets you install Ubuntu, Debian, and Manjaro on non-rooted Android devices. Our documentation provides step-by-step instructions and troubleshooting tips to help you set up your Linux environment quickly and easily. Experience the power of Linux on your mobile device with Andronix."/>
            <meta property="twitter:image" content="https://docs.andronix.app/og.png"/>

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
