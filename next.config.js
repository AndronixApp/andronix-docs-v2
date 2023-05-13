const withNextra = require('nextra')({
    theme: 'nextra-theme-docs',
    themeConfig: './theme.config.tsx',
    async redirects() {
        return [
            {
                source: '/blog/v7-0/',
                destination: '/blog/andronix-v7',
                permanent: true,
            },
            {
                source: '/blog/v6-0/',
                destination: '/blog/andronix-v6',
                permanent: true,
            },
            {
                source: '/blog/andronix-termux-and-f-droid/',
                destination: '/blog/andronix-termux-and-f-droid',
                permanent: true,
            },
        ];
    },
})

module.exports = withNextra()
