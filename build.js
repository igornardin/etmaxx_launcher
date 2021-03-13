const builder = require('electron-builder')
const Platform = builder.Platform

builder.build({
    targets: Platform.WINDOWS.createTarget(),
    config: {
        appId: 'etmaxxlauncher',
        productName: 'EtMaXx_Launcher',
        artifactName: '${productName}-setup.${ext}',
        copyright: 'Copyright © 2021 EtMaXx FunServer. Todos os direitos reservados',
        directories: {
            buildResources: 'build',
            output: 'dist'
        },
        win: {
            target: [
                {
                    target: 'nsis',
                    arch: 'x64'
                },
                {
                    target: 'nsis',
                    arch: 'ia32'
                }
            ]
        },
        portable: {
            artifactName: "etmaxx_portable.exe"
        },
        nsis: {
            oneClick: false,
            perMachine: false,
            allowElevation: true,
            allowToChangeInstallationDirectory: true
        },
        mac: {
            "category": "public.app-category.games",
            "icon": "build/icon.icns",
            "target": [
                "dmg"
            ],
            "electronLanguages": [
                "en"
            ]
        },
        compression: 'maximum',
        files: [
            '!{dist,.gitignore,.vscode,docs,dev-app-update.yml,.travis.yml,.nvmrc,.eslintrc.json,build.js}'
        ],
        asar: true
    }
}).then(() => {
    console.log('Build complete!')
}).catch(err => {
    console.error('Error during build!', err)
})